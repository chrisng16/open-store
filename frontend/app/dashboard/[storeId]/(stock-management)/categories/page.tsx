"use client";

import {
    BulkDeleteDialog,
} from "@/components/dashboard/common/bulk-delete-dialog";
import {
    type CategoryRow,
    getCategoriesTableColumns,
} from "@/components/dashboard/common/categories-table-columns";
import {
    CategoryDeleteDialog,
} from "@/components/dashboard/common/category-delete-dialog";
import { DataTable } from "@/components/dashboard/common/data-table";
import { Button } from "@/components/ui/button";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { useCategoryDialogActions } from "@/stores/ui-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

export default function CategoriesPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<CategoryRow | null>(null);
    const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const { openCategoryCreate, openCategoryEdit } = useCategoryDialogActions();

    const { data, isPending, refetch } = useQuery({
        queryKey: ["store-categories", storeId],
        queryFn: async () =>
            fetchWithAccessToken<CategoryRow[]>(`/stores/${storeId}/categories`),
        enabled: !!storeId,
    });

    const categories = useMemo(
        () => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        [data]
    );

    const deleteMutation = useMutation({
        mutationFn: async (categoryId: string) => {
            await fetchWithAccessToken<void>(`/stores/${storeId}/categories/${categoryId}`, {
                method: "DELETE",
            });
        },
        onSuccess: () => {
            toast.success("Category deleted");
            setIsDeleteOpen(false);
            setCategoryToDelete(null);
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to delete category");
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (categoryIds: string[]) => {
            await Promise.all(
                categoryIds.map((categoryId) =>
                    fetchWithAccessToken<void>(`/stores/${storeId}/categories/${categoryId}`, {
                        method: "DELETE",
                    })
                )
            );
        },
        onSuccess: (_data, categoryIds) => {
            toast.success(`Deleted ${categoryIds.length} categor${categoryIds.length === 1 ? "y" : "ies"}`);
            setIsBulkDeleteOpen(false);
            setBulkDeleteIds([]);
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to delete selected categories");
        },
    });

    function openCreateDialog() {
        openCategoryCreate();
    }

    function openEditDialog(category: CategoryRow) {
        openCategoryEdit({
            id: category.id,
            name: category.name,
            description: category.description ?? "",
            sortOrder: category.sortOrder,
            isActive: category.isActive,
        });
    }

    function openDeleteDialog(category: CategoryRow) {
        setCategoryToDelete(category);
        setIsDeleteOpen(true);
    }

    const columns = useMemo(
        () =>
            getCategoriesTableColumns({
                onEdit: openEditDialog,
                onDelete: openDeleteDialog,
            }),
        [openCategoryEdit]
    );

    async function handleDelete() {
        if (!categoryToDelete) return;
        await deleteMutation.mutateAsync(categoryToDelete.id);
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6">
            <div className="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={categories}
                    isLoading={isPending}
                    enableRowSelection
                    getRowId={(row) => row.id}
                    renderBulkActions={({ selectedRows }) => (
                        <Button
                            variant={selectedRows.length > 0 ? "destructive" : "outline"}
                            size="sm"
                            disabled={bulkDeleteMutation.isPending || selectedRows.length === 0}
                            onClick={() => {
                                if (!selectedRows.length) return;
                                setBulkDeleteIds(selectedRows.map((row) => row.id));
                                setIsBulkDeleteOpen(true);
                            }}
                        >
                            <Trash2 />
                            {selectedRows.length > 0 ? ` Delete ${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"}` : "Delete"}
                        </Button>
                    )}
                    loadingText="Loading categories..."
                    searchColumnId="name"
                    searchPlaceholder="Search categories by name..."
                    emptyTitle="No categories yet"
                    emptyDescription="Create your first category to organize products."
                    emptyAction={
                        <Button variant="outline" onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Category
                        </Button>
                    }
                />
            </div>

            <CategoryDeleteDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                categoryName={categoryToDelete?.name}
                isDeleting={deleteMutation.isPending}
                onConfirm={handleDelete}
            />

            <BulkDeleteDialog
                open={isBulkDeleteOpen}
                onOpenChange={setIsBulkDeleteOpen}
                itemLabel="category"
                count={bulkDeleteIds.length}
                isDeleting={bulkDeleteMutation.isPending}
                onConfirm={async () => {
                    if (!bulkDeleteIds.length) return;
                    await bulkDeleteMutation.mutateAsync(bulkDeleteIds);
                }}
            />
        </div>
    );
}
