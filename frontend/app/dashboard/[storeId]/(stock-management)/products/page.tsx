"use client";

import { BulkDeleteDialog } from "@/components/dashboard/common/bulk-delete-dialog";
import { DataTable } from "@/components/dashboard/common/data-table";
import { ProductDeleteDialog } from "@/components/dashboard/common/product-delete-dialog";
import {
    getProductsTableColumns,
    type ProductCategoryOption,
    type ProductRow,
} from "@/components/dashboard/common/products-table-columns";
import { Button } from "@/components/ui/button";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { useUIStore } from "@/stores/ui-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

type Category = {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
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
    const { openProductCreate, openProductEdit } = useUIStore();

    const { data, isPending, refetch } = useQuery({
        queryKey: ["menu-editor", storeId],
        queryFn: async () => {
            const [categories, products] = await Promise.all([
                fetchWithAccessToken<Category[]>(`/stores/${storeId}/categories`),
                fetchWithAccessToken<ProductRow[]>(`/stores/${storeId}/products`),
            ]);
            return { categories, products };
        },
        enabled: !!storeId,
    });

    const categories = data?.categories ?? [];
    const products = data?.products ?? [];

    const categoryOptions = useMemo<ProductCategoryOption[]>(
        () => categories.map((category) => ({ id: category.id, name: category.name })),
        [categories]
    );

    const deleteProductMutation = useMutation({
        mutationFn: async (productId: string) => {
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

    const columns = useMemo(
        () =>
            getProductsTableColumns({
                categories: categoryOptions,
                onEdit: (product) => {
                    const selectedCategoryName =
                        categoryOptions.find((category) => category.id === product.categoryId)?.name ?? "";

                    openProductEdit({
                        id: product.id,
                        name: product.name,
                        description: product.description ?? "",
                        basePrice: String(product.basePrice),
                        imageUrl: product.imageUrl ?? "",
                        categoryId: product.categoryId ?? "",
                        categoryName: selectedCategoryName,
                        modifierGroups: (product.modifierGroups ?? []).map((group) => ({
                            name: group.name,
                            minSelections: group.minSelections,
                            maxSelections: group.maxSelections,
                            isRequired: group.isRequired,
                            modifiers: group.modifiers.map((modifier) => ({
                                name: modifier.name,
                                priceAdjustment: String(modifier.priceAdjustment ?? 0),
                                isDefault: modifier.isDefault,
                                sortOrder: modifier.sortOrder,
                            })),
                        })),
                    });
                },
                onDelete: (product) => {
                    setProductToDelete(product);
                },
            }),
        [categoryOptions, openProductEdit]
    );

    async function handleDeleteProduct() {
        if (!productToDelete) return;
        await deleteProductMutation.mutateAsync(productToDelete.id);
    }

    return (
        <div className="px-6 h-full">
            <DataTable
                columns={columns}
                data={products}
                isLoading={isPending}
                enableRowSelection
                getRowId={(row) => row.id}
                renderBulkActions={({ selectedRows }) => (
                    <Button
                        variant={selectedRows.length > 0 ? "destructive" : "outline"}
                        size="sm"
                        disabled={bulkDeleteProductsMutation.isPending || selectedRows.length === 0}
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
                loadingText="Loading products..."
                searchColumnId="name"
                searchPlaceholder="Search products by name..."
                emptyTitle="No products yet"
                emptyDescription="Add items manually or use AI Import."
            />

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
