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
import type { PaginatedResponse } from "@/lib/pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { memo, use, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

const ProductEditorDialog = dynamic(
    () =>
        import("@/components/dashboard/products/product-editor-dialog").then(
            (module) => module.ProductEditorDialog
        ),
    { ssr: false }
);

const DEFAULT_AI_SECONDS_PER_MB = 150 * 0.85; // 150 seconds per MB with a 15% reduction based on observed performance improvements, resulting in 127.5 seconds per MB
const DEFAULT_ESTIMATED_DURATION_LABEL = "0 minutes 35 seconds";

type ImportDurationEstimateSource = Pick<
    MenuImportDetail,
    "fileSizeMb" | "fileSizeBytes"
>;

function getPredictedTotalSeconds(data?: ImportDurationEstimateSource): number | null {
    if (!data) return null;
    const fileSizeMb =
        data.fileSizeMb ??
        (typeof data.fileSizeBytes === "number" ? data.fileSizeBytes / (1024 * 1024) : null);
    if (!fileSizeMb || fileSizeMb <= 0) return null;

    const aiSecondsPerMb = DEFAULT_AI_SECONDS_PER_MB;

    if (!Number.isFinite(aiSecondsPerMb) || aiSecondsPerMb <= 0) return null;
    return Math.max(1, Math.round(fileSizeMb * aiSecondsPerMb));
}

function formatMinutesSeconds(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} seconds`;
    return `${minutes} minutes ${seconds} seconds`;
}

function buildImportDurationEstimate(data?: ImportDurationEstimateSource) {
    const predictedTotalSeconds = getPredictedTotalSeconds(data);

    return {
        predictedTotalSeconds,
        estimatedDurationLabel: predictedTotalSeconds
            ? formatMinutesSeconds(predictedTotalSeconds)
            : DEFAULT_ESTIMATED_DURATION_LABEL,
    };
}

const ImportProcessingCard = memo(function ImportProcessingCard({
    estimatedDurationLabel,
}: {
    estimatedDurationLabel: string;
}) {
    return (
        <div className="p-6">
            <Card>
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-base font-medium text-foreground">AI is processing your menu</p>
                    <p className="text-sm">This import will take approximately {estimatedDurationLabel}.</p>
                </CardContent>
            </Card>
        </div>
    );
});

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
            const data = query.state.data as MenuImportDetail | undefined;
            const status = data?.status;
            if (status === "processing" || status === "uploading") {
                const createdAtMs = data?.createdAt ? new Date(data.createdAt).getTime() : NaN;
                const { predictedTotalSeconds } = buildImportDurationEstimate(data);

                const predictedTotalMs = predictedTotalSeconds ? predictedTotalSeconds * 1000 : 35000;
                const elapsedMs = Number.isNaN(createdAtMs) ? predictedTotalMs : Date.now() - createdAtMs;
                if (elapsedMs < predictedTotalMs) {
                    return Math.max(1000, predictedTotalMs - elapsedMs);
                }
                return 2000;
            }
            return false;
        },
    });

    const processingEstimate = useMemo(
        () =>
            buildImportDurationEstimate(
                importData
                    ? {
                        fileSizeMb: importData.fileSizeMb,
                        fileSizeBytes: importData.fileSizeBytes,
                    }
                    : undefined
            ),
        [
            importData?.fileSizeMb,
            importData?.fileSizeBytes,
        ]
    );

    const { data: categoriesPage } = useQuery({
        queryKey: ["menu-import-dialog-categories", storeId],
        queryFn: async () =>
            fetchWithAccessToken<PaginatedResponse<CategoryResponse>>(
                `/stores/${storeId}/categories?page=1&page_size=500`
            ),
        enabled: !!storeId,
    });
    const categories = categoriesPage?.items ?? [];

    const categoryOptions = useMemo<ProductCategoryOption[]>(
        () => categories.map((category) => ({ id: category.id, name: category.name })),
        [categories]
    );

    const {
        setDrafts,
        editorItemId,
        editorFormData,
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
                        unitAmount: draft.price.trim() ? Math.round((parseDraftPrice(draft.price) ?? 0) * 100) : null,
                        optionLists: draft.optionLists,
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
                            unitAmount: params.formData.basePrice.trim()
                                ? Math.round((parseDraftPrice(params.formData.basePrice) ?? 0) * 100)
                                : null,
                            optionLists: nextModifiers,
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
                    optionLists: cloneModifiers(nextModifiers),
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

    async function handleEditorSubmit(formData: ProductFormData) {
        if (!editorItemId) return;
        await editMutation.mutateAsync({
            itemId: editorItemId,
            formData,
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
        return <ImportProcessingCard estimatedDurationLabel={processingEstimate.estimatedDurationLabel} />;
    }

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <ImportReviewHeader
                status={importData.status}
                fileUrl={importData.fileUrl}
                fileSizeBytes={importData.fileSizeBytes}
                fileSizeMb={importData.fileSizeMb}
                createdAt={importData.createdAt}
                showIngestInfo={true}
                processingStartedAt={importData.processingStartedAt}
                ingestedAt={importData.ingestedAt}
                ingestDurationSeconds={importData.ingestDurationSeconds}
                processingElapsedSeconds={importData.processingElapsedSeconds}
                aiProcessingSeconds={importData.aiProcessingSeconds}
                aiSecondsPerMb={importData.aiSecondsPerMb}
                aiMbPerSecond={importData.aiMbPerSecond}
                parser={importData.parsedData?.ingestionMeta?.parser ?? null}
                model={importData.parsedData?.ingestionMeta?.model ?? null}
                promptVersion={importData.parsedData?.ingestionMeta?.promptVersion ?? null}
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
                    initialFormData={editorFormData}
                    categories={categoryOptions}
                    isSaving={editMutation.isPending}
                    isUploadingImage={false}
                    onSubmit={handleEditorSubmit}
                    onUploadImage={async () => {
                        return "";
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
