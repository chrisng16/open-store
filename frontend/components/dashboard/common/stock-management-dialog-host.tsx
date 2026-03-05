"use client";

import { CategoryEditorDialog } from "@/components/dashboard/common/category-editor-dialog";
import { ProductEditorDialog, type ProductCategoryOption } from "@/components/dashboard/products/product-editor-dialog";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { uploadFileWithSignedUrl } from "@/lib/uploads";
import {
    emptyCategoryFormData,
    emptyProductFormData,
    useUIStore,
} from "@/stores/ui-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormEvent } from "react";
import { toast } from "sonner";

type CategoryResponse = {
    id: string;
    name: string;
    sortOrder?: number;
};

export function StockManagementDialogHost() {
    const params = useParams<{ storeId: string }>();
    const storeId = params?.storeId;
    const queryClient = useQueryClient();

    const {
        isCategoryDialogOpen,
        isProductDialogOpen,
        categoryFormData,
        productFormData,
        closeCategoryDialog,
        closeProductDialog,
        setCategoryFormData,
        setProductFormData,
    } = useUIStore();

    const { data: categories = [] } = useQuery({
        queryKey: ["dialog-categories", storeId],
        queryFn: async () =>
            fetchWithAccessToken<CategoryResponse[]>(`/stores/${storeId}/categories`),
        enabled: !!storeId && isProductDialogOpen,
    });

    const categoryOptions: ProductCategoryOption[] = categories.map((category) => ({
        id: category.id,
        name: category.name,
    }));

    const saveCategoryMutation = useMutation({
        mutationFn: async () => {
            if (!storeId) throw new Error("Missing store ID");
            const endpoint = categoryFormData.id
                ? `/stores/${storeId}/categories/${categoryFormData.id}`
                : `/stores/${storeId}/categories`;

            await fetchWithAccessToken(endpoint, {
                method: categoryFormData.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    denormalizeRequest({
                        name: categoryFormData.name,
                        description: categoryFormData.description || null,
                        sortOrder: categoryFormData.sortOrder,
                        isActive: categoryFormData.isActive,
                    })
                ),
            });
        },
        onSuccess: () => {
            toast.success(categoryFormData.id ? "Category updated" : "Category created");
            closeCategoryDialog();
            setCategoryFormData(emptyCategoryFormData);
            if (storeId) {
                void queryClient.invalidateQueries({ queryKey: ["store-categories", storeId] });
                void queryClient.invalidateQueries({ queryKey: ["menu-editor", storeId] });
                void queryClient.invalidateQueries({ queryKey: ["dialog-categories", storeId] });
            }
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to save category");
        },
    });

    const saveProductMutation = useMutation({
        mutationFn: async () => {
            if (!storeId) throw new Error("Missing store ID");
            const endpoint = productFormData.id
                ? `/stores/${storeId}/products/${productFormData.id}`
                : `/stores/${storeId}/products`;

            const parsedPrice = Number(productFormData.basePrice);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                throw new Error("Price must be a valid positive number");
            }

            const normalizedCategoryName = productFormData.categoryName.trim();
            let resolvedCategoryId: string | null = productFormData.categoryId || null;

            if (normalizedCategoryName) {
                const existingCategory = categories.find(
                    (category) =>
                        category.name.trim().toLowerCase() === normalizedCategoryName.toLowerCase()
                );

                if (existingCategory) {
                    resolvedCategoryId = existingCategory.id;
                } else {
                    const nextSortOrder = categories.reduce(
                        (maxSort, category) => Math.max(maxSort, category.sortOrder ?? 0),
                        0
                    ) + 1;

                    const createdCategory = await fetchWithAccessToken<CategoryResponse>(
                        `/stores/${storeId}/categories`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(
                                denormalizeRequest({
                                    name: normalizedCategoryName,
                                    description: null,
                                    sortOrder: nextSortOrder,
                                    isActive: true,
                                })
                            ),
                        }
                    );

                    resolvedCategoryId = createdCategory.id;
                }
            } else {
                resolvedCategoryId = null;
            }

            await fetchWithAccessToken(endpoint, {
                method: productFormData.id ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    denormalizeRequest({
                        name: productFormData.name,
                        description: productFormData.description || null,
                        basePrice: parsedPrice,
                        imageUrl: productFormData.imageUrl || null,
                        categoryId: resolvedCategoryId,
                        modifierGroups: productFormData.modifierGroups.map((group) => ({
                            name: group.name.trim(),
                            minSelections: group.minSelections,
                            maxSelections: group.maxSelections,
                            isRequired: group.isRequired,
                            modifiers: group.modifiers.map((modifier, index) => ({
                                name: modifier.name.trim(),
                                priceAdjustment: Number(modifier.priceAdjustment || 0),
                                isDefault: modifier.isDefault,
                                sortOrder: modifier.sortOrder ?? index,
                            })),
                        })),
                    })
                ),
            });
        },
        onSuccess: () => {
            toast.success(productFormData.id ? "Product updated" : "Product created");
            closeProductDialog();
            setProductFormData(emptyProductFormData);
            if (storeId) {
                void queryClient.invalidateQueries({ queryKey: ["menu-editor", storeId] });
            }
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to save product");
        },
    });

    const uploadProductImageMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!storeId) throw new Error("Missing store ID");
            return uploadFileWithSignedUrl(storeId, file, "productImage");
        },
        onSuccess: (upload) => {
            setProductFormData({
                ...productFormData,
                imageUrl: upload.fileUrl,
            });
            toast.success("Image uploaded");
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to upload image");
        },
    });

    async function handleCategorySubmit(e: FormEvent) {
        e.preventDefault();
        if (!categoryFormData.name.trim()) {
            toast.error("Category name is required");
            return;
        }
        await saveCategoryMutation.mutateAsync();
    }

    async function handleProductSubmit(e: FormEvent) {
        e.preventDefault();
        if (!productFormData.name.trim()) {
            toast.error("Product name is required");
            return;
        }

        for (const group of productFormData.modifierGroups) {
            if (!group.name.trim()) {
                toast.error("Each modifier group must have a name");
                return;
            }
            if (group.minSelections < 0 || group.maxSelections < 0 || group.minSelections > group.maxSelections) {
                toast.error(`Invalid min/max selections in group \"${group.name || "(unnamed)"}\"`);
                return;
            }
            for (const modifier of group.modifiers) {
                if (!modifier.name.trim()) {
                    toast.error(`Each option in group \"${group.name}\" must have a name`);
                    return;
                }
                const parsedAdjustment = Number(modifier.priceAdjustment || 0);
                if (!Number.isFinite(parsedAdjustment)) {
                    toast.error(`Option \"${modifier.name}\" has invalid price adjustment`);
                    return;
                }
            }
        }

        await saveProductMutation.mutateAsync();
    }

    return (
        <>
            <CategoryEditorDialog
                open={isCategoryDialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeCategoryDialog();
                }}
                formData={categoryFormData}
                onFormDataChange={setCategoryFormData}
                onSubmit={handleCategorySubmit}
                isSaving={saveCategoryMutation.isPending}
            />

            <ProductEditorDialog
                open={isProductDialogOpen}
                onOpenChange={(open: boolean) => {
                    if (!open) closeProductDialog();
                }}
                formData={productFormData}
                onFormDataChange={setProductFormData}
                categories={categoryOptions}
                isSaving={saveProductMutation.isPending}
                isUploadingImage={uploadProductImageMutation.isPending}
                onSubmit={handleProductSubmit}
                onUploadImage={async (file) => {
                    await uploadProductImageMutation.mutateAsync(file);
                }}
            />
        </>
    );
}
