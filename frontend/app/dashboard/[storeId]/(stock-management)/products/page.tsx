"use client";

import { BulkDeleteDialog } from "@/components/dashboard/common/bulk-delete-dialog";
import { DataTable } from "@/components/dashboard/common/data-table";
import { ProductDeleteDialog } from "@/components/dashboard/common/product-delete-dialog";
import {
    getProductsTableColumns,
    type ProductRow,
} from "@/components/dashboard/common/products-table-columns";
import { Button } from "@/components/ui/button";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { buildListQueryKey, useListFilters, type ListFilterConfig } from "@/lib/list-filters";
import {
    applyPaginationApiParams,
    applyPaginationSearchParams,
    applySortingSearchParam,
    arePaginationParamsEqual,
    areSortingParamsEqual,
    DEFAULT_PAGE,
    parsePaginationSearchParams,
    parseSortingSearchParam,
    type PaginatedResponse,
} from "@/lib/pagination";
import { useProductDialogActions } from "@/stores/ui-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

type ProductFilters = {
    q: string;
    sorting: SortingState;
    page: number;
    pageSize: number;
    statusFilter: "all" | "active" | "hidden";
};

const PRODUCT_SORTABLE_COLUMNS = ["name", "category", "unitAmount", "isActive"] as const;
const DEFAULT_PRODUCT_SORT = { id: "name", desc: false } as const;

function parseProductsFilters(searchParams: URLSearchParams): ProductFilters {
    const pagination = parsePaginationSearchParams(searchParams);
    const sorting = parseSortingSearchParam(
        searchParams.get("sort"),
        PRODUCT_SORTABLE_COLUMNS,
        DEFAULT_PRODUCT_SORT
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

function buildProductsSearchParams(filters: ProductFilters): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.q) {
        params.set("q", filters.q);
    }
    if (filters.statusFilter !== "all") {
        params.set("status", filters.statusFilter);
    }

    applySortingSearchParam(params, filters.sorting, DEFAULT_PRODUCT_SORT);
    applyPaginationSearchParams(params, {
        page: filters.page,
        pageSize: filters.pageSize,
    });

    return params;
}

function buildProductsApiParams(filters: ProductFilters): URLSearchParams {
    const params = new URLSearchParams();

    applyPaginationApiParams(params, {
        page: filters.page,
        pageSize: filters.pageSize,
    });

    if (filters.q) {
        params.set("q", filters.q);
    }

    params.set("status_filter", filters.statusFilter);
    applySortingSearchParam(params, filters.sorting, DEFAULT_PRODUCT_SORT);

    return params;
}

function areProductFiltersEqual(left: ProductFilters, right: ProductFilters) {
    return (
        left.q === right.q &&
        left.statusFilter === right.statusFilter &&
        arePaginationParamsEqual(left, right) &&
        areSortingParamsEqual(left.sorting, right.sorting)
    );
}

const productFiltersConfig: ListFilterConfig<
    ProductFilters,
    {
        q: string;
        statusFilter: ProductFilters["statusFilter"];
        sort: string | null;
        page: number;
        pageSize: number;
    }
> = {
    parse: parseProductsFilters,
    serialize: buildProductsSearchParams,
    equals: areProductFiltersEqual,
    toApiParams: buildProductsApiParams,
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

export default function MenuEditorPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    const [productToDelete, setProductToDelete] = useState<ProductRow | null>(null);
    const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const queryClient = useQueryClient();
    const { openProductEdit } = useProductDialogActions();
    const capabilities = useStoreCapabilities(storeId);
    const { filters, updateFilters, toApiParams, toQueryShape } = useListFilters(productFiltersConfig);

    const { data, isPending, refetch } = useQuery({
        queryKey: buildListQueryKey("menu-editor", storeId, toQueryShape(filters)),
        queryFn: async () => {
            const apiParams = toApiParams(filters);
            const productsPage = await fetchWithAccessToken<PaginatedResponse<ProductRow>>(
                `/stores/${storeId}/products?${apiParams}`
            );
            return { productsPage };
        },
        enabled: !!storeId,
    });

    const products = data?.productsPage.items ?? [];
    const pageCount = data?.productsPage.pageCount ?? 1;
    const totalProducts = data?.productsPage.total ?? 0;

    const updateProductStatusMutation = useMutation({
        mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
            if (!capabilities.canManageProducts) {
                throw new Error("You do not have permission to update product status.");
            }
            await fetchWithAccessToken<void>(`/stores/${storeId}/products/${productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: isActive }),
            });
        },
        onSuccess: () => {
            toast.success("Product status updated");
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to update product status");
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: async (productId: string) => {
            if (!capabilities.canDeleteProducts) {
                throw new Error(capabilities.ownerOnlyReason);
            }
            await fetchWithAccessToken<void>(`/stores/${storeId}/products/${productId}`, {
                method: "DELETE",
            });
        },
        onSuccess: () => {
            toast.success("Product deleted");
            setProductToDelete(null);
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to delete product");
        },
    });

    const bulkDeleteProductsMutation = useMutation({
        mutationFn: async (productIds: string[]) => {
            if (!capabilities.canDeleteProducts) {
                throw new Error(capabilities.ownerOnlyReason);
            }
            await Promise.all(
                productIds.map((productId) =>
                    fetchWithAccessToken<void>(`/stores/${storeId}/products/${productId}`, {
                        method: "DELETE",
                    })
                )
            );
        },
        onSuccess: (_data, productIds) => {
            toast.success(`Deleted ${productIds.length} product${productIds.length === 1 ? "" : "s"}`);
            setIsBulkDeleteOpen(false);
            setBulkDeleteIds([]);
            void refetch();
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to delete selected products");
        },
    });

    function toProductFormData(product: ProductRow, selectedCategoryName: string) {
        return {
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            basePrice: String((product.unitAmount ?? 0) / 100),
            imageUrl: product.imageUrl ?? "",
            categoryId: product.categoryId ?? "",
            categoryName: selectedCategoryName,
            optionLists: (product.optionLists ?? []).map((group) => ({
                name: group.name,
                minNumOptions: group.minNumOptions,
                maxNumOptions: group.maxNumOptions,
                isOptional: group.isOptional,
                options: group.options.map((option) => ({
                    name: option.name,
                    unitAmount: String((option.unitAmount ?? 0) / 100),
                    isDefault: option.isDefault,
                    sortOrder: option.sortOrder,
                })),
            })),
        };
    }

    const columns = useMemo(
        () =>
            getProductsTableColumns({
                onEdit: (product) => {
                    if (!capabilities.canManageProducts) {
                        toast.error("You do not have permission to edit products.");
                        return;
                    }
                    const initialCategoryName = product.category?.name ?? "";

                    queryClient.setQueryData(
                        ["dialog-product-detail", storeId, product.id],
                        product
                    );

                    openProductEdit(toProductFormData(product, initialCategoryName));
                },
                onDelete: (product) => {
                    if (!capabilities.canDeleteProducts) {
                        toast.error(capabilities.ownerOnlyReason);
                        return;
                    }
                    setProductToDelete(product);
                },
                onStatusToggle: async (product, isActive) => {
                    await updateProductStatusMutation.mutateAsync({
                        productId: product.id,
                        isActive,
                    });
                },
                canEdit: capabilities.canManageProducts,
                canDelete: capabilities.canDeleteProducts,
                canToggleStatus: capabilities.canManageProducts,
                editDisabledReason: "You do not have permission to edit products.",
                deleteDisabledReason: capabilities.ownerOnlyReason,
                statusDisabledReason: "You do not have permission to update product status.",
            }),
        [capabilities, openProductEdit, queryClient, storeId, updateProductStatusMutation]
    );

    async function handleDeleteProduct() {
        if (!productToDelete) return;
        await deleteProductMutation.mutateAsync(productToDelete.id);
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden px-6">
            <div className="min-h-0 flex-1 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={products}
                    isLoading={isPending}
                    enableRowSelection
                    getRowId={(row) => row.id}
                    onRowClick={(product) => {
                        if (!capabilities.canManageProducts) {
                            toast.error("You do not have permission to edit products.");
                            return;
                        }
                        const initialCategoryName = product.category?.name ?? "";

                        queryClient.setQueryData(
                            ["dialog-product-detail", storeId, product.id],
                            product
                        );

                        openProductEdit(toProductFormData(product, initialCategoryName));
                    }}
                    renderBulkActions={({ selectedRows }) => (
                        <Button
                            variant={selectedRows.length > 0 ? "destructive" : "outline"}
                            size="sm"
                            disabled={
                                bulkDeleteProductsMutation.isPending ||
                                selectedRows.length === 0 ||
                                !capabilities.canDeleteProducts
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
                    loadingText="Loading products..."
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
                    totalCount={totalProducts}
                    searchPlaceholder="Search products by name..."
                    emptyTitle="No products yet"
                    emptyDescription="Add items manually or use AI Import."
                />
            </div>

            <ProductDeleteDialog
                open={!!productToDelete}
                onOpenChange={(open) => {
                    if (!open) setProductToDelete(null);
                }}
                productName={productToDelete?.name}
                isDeleting={deleteProductMutation.isPending}
                onConfirm={handleDeleteProduct}
            />

            <BulkDeleteDialog
                open={isBulkDeleteOpen}
                onOpenChange={setIsBulkDeleteOpen}
                itemLabel="product"
                count={bulkDeleteIds.length}
                isDeleting={bulkDeleteProductsMutation.isPending}
                onConfirm={async () => {
                    if (!bulkDeleteIds.length) return;
                    await bulkDeleteProductsMutation.mutateAsync(bulkDeleteIds);
                }}
            />
        </div>
    );
}
