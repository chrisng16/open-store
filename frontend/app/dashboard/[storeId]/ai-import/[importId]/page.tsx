"use client";

import { ImportReviewActionBar } from "@/components/dashboard/ai-import/import-review-action-bar";
import { createImportReviewColumns } from "@/components/dashboard/ai-import/import-review-columns";
import { BulkCategoryDialog, PublishConfirmDialog } from "@/components/dashboard/ai-import/import-review-dialogs";
import { ImportReviewHeader } from "@/components/dashboard/ai-import/import-review-header";
import type { CategoryResponse, MenuImportDetail } from "@/components/dashboard/ai-import/types";
import { useImportReviewState } from "@/components/dashboard/ai-import/use-import-review-state";
import {
    cloneModifiers,
    formDataToModifiers,
    getMutationErrorMessage,
    parseDraftPrice,
} from "@/components/dashboard/ai-import/utils";
import { DataTable } from "@/components/dashboard/common/data-table";
import {
    type ProductCategoryOption,
    type ProductFormData,
} from "@/components/dashboard/products/product-editor-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

const ProductEditorDialog = dynamic(
    () =>
        import("@/components/dashboard/products/product-editor-dialog").then(
            (module) => module.ProductEditorDialog
        ),
    { ssr: false }
);

export default function ImportReviewPage({
    params,
}: {
    params: Promise<{ storeId: string; importId: string }>;
}) {
    const router = useRouter();
    const { storeId, importId } = use(params);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const {
        data: importData,
        isPending,
        refetch,
    } = useQuery({
        queryKey: ["menu-import", storeId, importId],
        queryFn: async () =>
            fetchWithAccessToken<MenuImportDetail>(
                `/stores/${storeId}/menu-imports/${importId}`
            ),
        enabled: !!storeId && !!importId,
        refetchInterval: (query) => {
            const status = (query.state.data as MenuImportDetail | undefined)?.status;
            if (status === "processing" || status === "uploading") return 2000;
            return false;
        },
    });

    const { data: categories = [] } = useQuery({
        queryKey: ["menu-import-dialog-categories", storeId],
        queryFn: async () =>
            fetchWithAccessToken<CategoryResponse[]>(`/stores/${storeId}/categories`),
        enabled: !!storeId,
    });

    const categoryOptions = useMemo<ProductCategoryOption[]>(
        () => categories.map((category) => ({ id: category.id, name: category.name })),
        [categories]
    );

    const {
        setDrafts,
        editorItemId,
        editorFormData,
        setEditorFormData,
        statusFilter,
        setStatusFilter,
        isPublishConfirmOpen,
        setIsPublishConfirmOpen,
        isBulkCategoryDialogOpen,
        setIsBulkCategoryDialogOpen,
        bulkCategory,
        setBulkCategory,
        isPublished,
        dirtyItemIds,
        hasDirtyChanges,
        getDraft,
        updateDraft,
        effectiveItems,
        dirtyItemIdSet,
        filteredItems,
        dirtyCounts,
        applyBulkStatus,
        applyBulkCategory,
        hasBulkCategoryValue,
        openEditor,
        resetEditor,
    } = useImportReviewState({ importData, categoryOptions });

    const selectedCount = selectedItemIds.size;

    const applyMutation = useMutation({
        mutationFn: async () => {
            if (!importData) return;
            const dirtySet = new Set(dirtyItemIds);
            const items = importData.items
                .filter((item) => dirtySet.has(item.id))
                .map((item) => {
                    const draft = getDraft(item);
                    return {
                        itemId: item.id,
                        itemName: draft.name,
                        categoryName: draft.category || null,
                        description: draft.description || null,
                        price: parseDraftPrice(draft.price),
                        modifiers: draft.modifiers,
                        status: draft.status,
                    };
                });

            if (items.length === 0) return;

            await fetchWithAccessToken<void>(
                `/stores/${storeId}/menu-imports/${importId}/items:batch`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(denormalizeRequest({ items })),
                }
            );
        },
        onSuccess: async () => {
            setDrafts({});
            await refetch();
        },
        onError: (error) => {
            toast.error(getMutationErrorMessage(error, "Failed to apply changes."));
        },
    });

    const editMutation = useMutation({
        mutationFn: async (params: { itemId: string; formData: ProductFormData }) => {
            if (!importData) throw new Error("Import not loaded");
            const currentItem = importData.items.find((item) => item.id === params.itemId);
            if (!currentItem) throw new Error("Item not found");

            const currentDraft = getDraft(currentItem);
            const nextStatus = currentDraft.status === "pending" ? "edited" : currentDraft.status;
            const categoryName = params.formData.categoryName.trim();
            const description = params.formData.description.trim();
            const nextModifiers = formDataToModifiers(params.formData);

            await fetchWithAccessToken<void>(
                `/stores/${storeId}/menu-imports/${importId}/items/${params.itemId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(
                        denormalizeRequest({
                            itemName: params.formData.name,
                            categoryName: categoryName || null,
                            description: description || null,
                            price: parseDraftPrice(params.formData.basePrice),
                            modifiers: nextModifiers,
                            status: nextStatus,
                        })
                    ),
                }
            );

            return {
                itemId: params.itemId,
                nextDraft: {
                    name: params.formData.name,
                    price: params.formData.basePrice,
                    category: categoryName,
                    description,
                    modifiers: cloneModifiers(nextModifiers),
                    status: nextStatus,
                },
            };
        },
        onSuccess: async (result) => {
            setDrafts((prev) => ({
                ...prev,
                [result.itemId]: result.nextDraft,
            }));
            resetEditor();
            await refetch();
        },
        onError: (error) => {
            toast.error(getMutationErrorMessage(error, "Failed to save item changes."));
        },
    });

    const publishMutation = useMutation({
        mutationFn: async () => {
            await fetchWithAccessToken<void>(
                `/stores/${storeId}/menu-imports/${importId}/publish`,
                {
                    method: "POST",
                }
            );
        },
        onSuccess: () => {
            router.push(`/dashboard/${storeId}/products`);
        },
        onError: (error) => {
            toast.error(getMutationErrorMessage(error, "Failed to publish import."));
        },
    });

    async function handleEditorSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editorItemId) return;
        await editMutation.mutateAsync({
            itemId: editorItemId,
            formData: editorFormData,
        });
    }

    function openPublishConfirm() {
        if (isPublished) return;
        setIsPublishConfirmOpen(true);
    }

    async function confirmPublish() {
        try {
            if (hasDirtyChanges) {
                await applyMutation.mutateAsync();
            }
            await publishMutation.mutateAsync();
            setIsPublishConfirmOpen(false);
        } catch {
            return;
        }
    }

    const acceptedItems = effectiveItems.filter((item) => item.status === "approved");
    const isBulkCategoryDisabled =
        isPublished ||
        selectedCount === 0 ||
        applyMutation.isPending ||
        publishMutation.isPending ||
        editMutation.isPending;
    const isActionPending =
        applyMutation.isPending || publishMutation.isPending || editMutation.isPending;

    function applyBulkCategoryFromInput() {
        applyBulkCategory(bulkCategory.categoryName, selectedItemIds);
        setBulkCategory({ categoryName: "", categoryId: "" });
    }

    function closeBulkCategoryDialog() {
        setIsBulkCategoryDialogOpen(false);
        setBulkCategory({ categoryName: "", categoryId: "" });
    }

    function openBulkCategoryDialog() {
        if (isPublished || selectedCount === 0) return;
        setIsBulkCategoryDialogOpen(true);
    }

    function confirmBulkCategoryDialog() {
        if (!hasBulkCategoryValue) return;
        applyBulkCategoryFromInput();
        setIsBulkCategoryDialogOpen(false);
    }

    function handleBulkCategoryDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== "Enter" || event.shiftKey) return;
        if (isBulkCategoryDisabled || !hasBulkCategoryValue) return;
        event.preventDefault();
        confirmBulkCategoryDialog();
    }

    const columns = useMemo(
        () =>
            createImportReviewColumns({
                isPublished,
                dirtyItemIdSet,
                isActionPending,
                onEdit: openEditor,
                onApprove: (itemId) => {
                    updateDraft(itemId, (current) => ({
                        ...current,
                        status: "approved",
                    }));
                },
                onReject: (itemId) => {
                    updateDraft(itemId, (current) => ({
                        ...current,
                        status: "rejected",
                    }));
                },
            }),
        [
            isPublished,
            dirtyItemIdSet,
            isActionPending,
            openEditor,
            updateDraft,
        ]
    );

    if (isPending)
        return <div className="p-6 text-muted-foreground">Loading import...</div>;

    if (!importData)
        return <div className="p-6 text-destructive">Import not found</div>;

    if (importData.status === "processing" || importData.status === "uploading") {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-base font-medium text-foreground">AI is processing your menu</p>
                        <p className="text-sm">This screen updates automatically and will show review once extraction is complete.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <ImportReviewHeader
                status={importData.status}
                fileUrl={importData.fileUrl}
                isPublished={isPublished}
                hasDirtyChanges={hasDirtyChanges}
                acceptedCount={acceptedItems.length}
                applyPending={applyMutation.isPending}
                publishPending={publishMutation.isPending}
                onApply={() => applyMutation.mutate()}
                onOpenPublishConfirm={openPublishConfirm}
            />

            <div className="px-6 flex-1 min-h-0 min-w-0">
                <DataTable
                    columns={columns}
                    data={filteredItems}
                    isLoading={isPending}
                    loadingText="Loading import..."
                    enableRowSelection={true}
                    rowSelectionDisabled={isPublished || isActionPending}
                    enableDefaultActionBar={false}
                    emptyTitle="No items found for this filter"
                    getRowId={(row) => row.id}
                    onSelectionChange={({ selectedRowIds }) => {
                        setSelectedItemIds((prev) => {
                            if (prev.size !== selectedRowIds.size) return selectedRowIds;
                            for (const id of prev) {
                                if (!selectedRowIds.has(id)) return selectedRowIds;
                            }
                            return prev;
                        });
                    }}
                    actionBar={
                        <ImportReviewActionBar
                            statusFilter={statusFilter}
                            dirtyCounts={dirtyCounts}
                            isPublished={isPublished}
                            selectedCount={selectedCount}
                            isActionPending={isActionPending}
                            onStatusFilterChange={setStatusFilter}
                            onOpenBulkCategoryDialog={openBulkCategoryDialog}
                            onBulkApprove={() => applyBulkStatus("approved", selectedItemIds)}
                            onBulkReject={() => applyBulkStatus("rejected", selectedItemIds)}
                        />
                    }
                />

                <ProductEditorDialog
                    open={!isPublished && !!editorItemId}
                    onOpenChange={(open) => {
                        if (!open) {
                            resetEditor();
                        }
                    }}
                    formData={editorFormData}
                    onFormDataChange={setEditorFormData}
                    categories={categoryOptions}
                    isSaving={editMutation.isPending}
                    isUploadingImage={false}
                    onSubmit={handleEditorSubmit}
                    onUploadImage={async () => {
                        return;
                    }}
                />
                <BulkCategoryDialog
                    open={isBulkCategoryDialogOpen}
                    selectedCount={selectedCount}
                    categories={categoryOptions}
                    value={bulkCategory}
                    hasValue={hasBulkCategoryValue}
                    isDisabled={isBulkCategoryDisabled}
                    onOpenChange={(open) => {
                        if (!open) {
                            closeBulkCategoryDialog();
                            return;
                        }
                        setIsBulkCategoryDialogOpen(true);
                    }}
                    onChange={setBulkCategory}
                    onCancel={closeBulkCategoryDialog}
                    onConfirm={confirmBulkCategoryDialog}
                    onKeyDown={handleBulkCategoryDialogKeyDown}
                />
                <PublishConfirmDialog
                    open={isPublishConfirmOpen}
                    hasDirtyChanges={hasDirtyChanges}
                    isPending={publishMutation.isPending || applyMutation.isPending}
                    onOpenChange={setIsPublishConfirmOpen}
                    onCancel={() => setIsPublishConfirmOpen(false)}
                    onConfirm={confirmPublish}
                />
            </div>
        </div>
    );
}
