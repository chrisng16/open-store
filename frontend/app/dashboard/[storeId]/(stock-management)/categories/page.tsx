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
import {
    CategoryStatusChangeDialog,
} from "@/components/dashboard/common/category-status-change-dialog";
import { DataTable } from "@/components/dashboard/common/data-table";
import { Button } from "@/components/ui/button";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { buildListQueryKey, type ListFilterConfig, useListFilters } from "@/lib/list-filters";
import {
    applyPaginationApiParams,
    applyPaginationSearchParams,
    applySortingSearchParam,
    arePaginationParamsEqual,
    areSortingParamsEqual,
    DEFAULT_PAGE,
    type PaginatedResponse,
    parsePaginationSearchParams,
    parseSortingSearchParam,
} from "@/lib/pagination";
import { useCategoryDialogActions } from "@/stores/ui-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

type CategoryFilters = {
    q: string;
    sorting: SortingState;
    page: number;
    pageSize: number;
    statusFilter: "all" | "active" | "hidden";
};

const CATEGORY_SORTABLE_COLUMNS = ["name", "description", "isActive"] as const;
const DEFAULT_CATEGORY_SORT = { id: "name", desc: false } as const;

function parseCategoryFilters(searchParams: URLSearchParams): CategoryFilters {
    const pagination = parsePaginationSearchParams(searchParams);
    const sorting = parseSortingSearchParam(
        searchParams.get("sort"),
        CATEGORY_SORTABLE_COLUMNS,
        DEFAULT_CATEGORY_SORT
    );
    const rawStatus = searchParams.get("status");
    const statusFilter =
        rawStatus === "all" || rawStatus === "active" || rawStatus === "hidden"
            ? rawStatus
            : "all";

    return {
        q: (searchParams.get("q") ?? "").trim(),
        sorting,
        page: pagination.page,
        pageSize: pagination.pageSize,
        statusFilter,
    };
}

function buildCategorySearchParams(filters: CategoryFilters): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.q) {
        params.set("q", filters.q);
    }
    if (filters.statusFilter !== "all") {
        params.set("status", filters.statusFilter);
    }
    applySortingSearchParam(params, filters.sorting, DEFAULT_CATEGORY_SORT);
    applyPaginationSearchParams(params, {
        page: filters.page,
        pageSize: filters.pageSize,
    });

    return params;
}

function buildCategoryApiParams(filters: CategoryFilters): URLSearchParams {
    const params = new URLSearchParams();

    applyPaginationApiParams(params, {
        page: filters.page,
        pageSize: filters.pageSize,
    });
    if (filters.q) {
        params.set("q", filters.q);
    }
    params.set("status_filter", filters.statusFilter);
    applySortingSearchParam(params, filters.sorting, DEFAULT_CATEGORY_SORT);

    return params;
}

function areCategoryFiltersEqual(left: CategoryFilters, right: CategoryFilters) {
    return (
        left.q === right.q &&
        left.statusFilter === right.statusFilter &&
        arePaginationParamsEqual(left, right) &&
        areSortingParamsEqual(left.sorting, right.sorting)
    );
}

const categoryFiltersConfig: ListFilterConfig<
    CategoryFilters,
    {
        q: string;
        statusFilter: CategoryFilters["statusFilter"];
        sort: string | null;
        page: number;
        pageSize: number;
    }
> = {
    parse: parseCategoryFilters,
    serialize: buildCategorySearchParams,
    equals: areCategoryFiltersEqual,
    toApiParams: buildCategoryApiParams,
    toQueryShape: (filters) => ({
        q: filters.q,
        statusFilter: filters.statusFilter,
        sort: filters.sorting[0]
            ? `${filters.sorting[0].id}:${filters.sorting[0].desc ? "desc" : "asc"}`
            : null,
        page: filters.page,
        pageSize: filters.pageSize,
    }),
};

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
    const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
    const [categoryStatusChange, setCategoryStatusChange] = useState<{ category: CategoryRow; isActive: boolean } | null>(null);
    const { openCategoryCreate, openCategoryEdit } = useCategoryDialogActions();
    const capabilities = useStoreCapabilities(storeId);
    const { filters, updateFilters, toApiParams, toQueryShape } = useListFilters(categoryFiltersConfig);

    const { data, isPending, refetch } = useQuery({
        queryKey: buildListQueryKey("store-categories", storeId, toQueryShape(filters)),
        queryFn: async () =>
            fetchWithAccessToken<PaginatedResponse<CategoryRow>>(
                `/stores/${storeId}/categories?${toApiParams(filters)}`
            ),
        enabled: !!storeId,
    });

    const categories = data?.items ?? [];
    const pageCount = data?.pageCount ?? 1;
    const totalCategories = data?.total ?? 0;

    const deleteMutation = useMutation({
        mutationFn: async (categoryId: string) => {
            if (!capabilities.canDeleteCategories) {
                throw new Error(capabilities.ownerOnlyReason);
            }
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
            if (!capabilities.canDeleteCategories) {
                throw new Error(capabilities.ownerOnlyReason);
            }
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

    const updateCategoryStatusMutation = useMutation({
        mutationFn: async ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
            if (!capabilities.canManageCategories) {
                throw new Error("You do not have permission to update category status.");
            }
            await fetchWithAccessToken<void>(`/stores/${storeId}/categories/${categoryId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: isActive }),
            });
        },
        onSuccess: () => {
            toast.success("Category status updated");
            setIsStatusChangeOpen(false);
            setCategoryStatusChange(null);
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to update category status");
        },
    });

    function openCreateDialog() {
        if (!capabilities.canManageCategories) {
            toast.error("You do not have permission to create categories.");
            return;
        }
        openCategoryCreate();
    }

    function openEditDialog(category: CategoryRow) {
        if (!capabilities.canManageCategories) {
            toast.error("You do not have permission to edit categories.");
            return;
        }
        openCategoryEdit({
            id: category.id,
            name: category.name,
            description: category.description ?? "",
            sortOrder: category.sortOrder,
            isActive: category.isActive,
        });
    }

    function openDeleteDialog(category: CategoryRow) {
        if (!capabilities.canDeleteCategories) {
            toast.error(capabilities.ownerOnlyReason);
            return;
        }
        setCategoryToDelete(category);
        setIsDeleteOpen(true);
    }

    const columns = useMemo(
        () =>
            getCategoriesTableColumns({
                onEdit: openEditDialog,
                onDelete: openDeleteDialog,
                onStatusToggle: async (category, isActive) => {
                    if (!capabilities.canManageCategories) {
                        toast.error("You do not have permission to update category status.");
                        return;
                    }
                    setCategoryStatusChange({ category, isActive });
                    setIsStatusChangeOpen(true);
                },
                canEdit: capabilities.canManageCategories,
                canDelete: capabilities.canDeleteCategories,
                canToggleStatus: capabilities.canManageCategories,
                editDisabledReason: "You do not have permission to edit categories.",
                deleteDisabledReason: capabilities.ownerOnlyReason,
                statusDisabledReason: "You do not have permission to update category status.",
            }),
        [capabilities, openCategoryEdit]
    );

    async function handleStatusChange() {
        if (!categoryStatusChange) return;
        await updateCategoryStatusMutation.mutateAsync({
            categoryId: categoryStatusChange.category.id,
            isActive: categoryStatusChange.isActive,
        });
    }

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
                    onRowClick={openEditDialog}
                    renderBulkActions={({ selectedRows }) => (
                        <Button
                            variant={selectedRows.length > 0 ? "destructive" : "outline"}
                            size="sm"
                            disabled={
                                bulkDeleteMutation.isPending ||
                                selectedRows.length === 0 ||
                                !capabilities.canDeleteCategories
                            }
                            onClick={() => {
                                if (!selectedRows.length) return;
                                setBulkDeleteIds(selectedRows.map((row) => row.id));
                                setIsBulkDeleteOpen(true);
                            }}
                            className="rounded-full"
                        >
                            <Trash2 />
                            {selectedRows.length > 0 ? ` Delete ${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"}` : "Delete"}
                        </Button>
                    )}
                    loadingText="Loading categories..."
                    searchColumnId="name"
                    searchValue={filters.q}
                    onSearchValueChange={(value) =>
                        updateFilters((current) => ({ ...current, q: value, page: DEFAULT_PAGE }))
                    }
                    sorting={filters.sorting}
                    onSortingChange={(sorting) =>
                        updateFilters((current) => ({ ...current, sorting: sorting.slice(0, 1), page: DEFAULT_PAGE }))
                    }
                    manualSorting
                    pagination={{
                        pageIndex: Math.max(filters.page - 1, 0),
                        pageSize: filters.pageSize,
                    }}
                    onPaginationChange={({ pageIndex, pageSize }) => {
                        const pageSizeChanged = pageSize !== filters.pageSize;
                        updateFilters((current) => ({
                            ...current,
                            page: pageSizeChanged ? DEFAULT_PAGE : pageIndex + 1,
                            pageSize,
                        }));
                    }}
                    manualPagination
                    pageCount={pageCount}
                    totalCount={totalCategories}
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

            <CategoryStatusChangeDialog
                open={isStatusChangeOpen}
                onOpenChange={setIsStatusChangeOpen}
                categoryName={categoryStatusChange?.category.name}
                isActive={categoryStatusChange?.isActive ?? false}
                isUpdating={updateCategoryStatusMutation.isPending}
                onConfirm={handleStatusChange}
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
