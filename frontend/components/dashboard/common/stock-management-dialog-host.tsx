"use client";

import { CategoryEditorDialog } from "@/components/dashboard/common/category-editor-dialog";
import { ProductEditorDialog, type ProductCategoryOption } from "@/components/dashboard/products/product-editor-dialog";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import type { PaginatedResponse } from "@/lib/pagination";
import { uploadFileWithSignedUrl } from "@/lib/uploads";
import {
    emptyCategoryFormData,
    emptyProductFormData,
    useStockManagementDialogState,
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
    } = useStockManagementDialogState();

    const { data: categoriesPage } = useQuery({
        queryKey: ["dialog-categories", storeId],
        queryFn: async () =>
            fetchWithAccessToken<PaginatedResponse<CategoryResponse>>(
                `/stores/${storeId}/categories?page=1&page_size=500`
            ),
        enabled: !!storeId,
    });
    const categories = categoriesPage?.items ?? [];

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
        mutationFn: async (formData: typeof productFormData) => {
            if (!storeId) throw new Error("Missing store ID");
            const endpoint = formData.id
                ? `/stores/${storeId}/products/${formData.id}`
                : `/stores/${storeId}/products`;

            const parsedPrice = Number(formData.basePrice);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                throw new Error("Price must be a valid positive number");
            }

            const normalizedCategoryName = formData.categoryName.trim();
            let resolvedCategoryId: string | null = formData.categoryId || null;

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
                method: formData.id ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    denormalizeRequest({
                        name: formData.name,
                        description: formData.description || null,
                        unitAmount: Math.round(parsedPrice * 100),
                        currency: "USD",
                        decimalPlaces: 2,
                        imageUrl: formData.imageUrl || null,
                        categoryId: resolvedCategoryId,
                        optionLists: formData.optionLists.map((optionList, optionListIndex) => ({
                            name: optionList.name.trim(),
                            selectionNode: optionList.maxNumOptions === 1 ? "single_select" : "multi_select",
                            minNumOptions: optionList.minNumOptions,
                            maxNumOptions: optionList.maxNumOptions,
                            minAggregateOptionsQuantity: 0,
                            maxAggregateOptionsQuantity: 0,
                            isOptional: optionList.isOptional,
                            sortOrder: optionListIndex,
                            options: optionList.options.map((option, index) => ({
                                name: option.name.trim(),
                                unitAmount: Math.round(Number(option.unitAmount || 0) * 100),
                                currency: "USD",
                                decimalPlaces: 2,
                                minOptionChoiceQuantity: 0,
                                maxOptionChoiceQuantity: 1,
                                defaultQuantity: option.isDefault ? 1 : 0,
                                isDefault: option.isDefault,
                                sortOrder: option.sortOrder ?? index,
                            })),
                        })),
                    })
                ),
            });
        },
        onSuccess: () => {
            toast.success("Product saved");
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
        onSuccess: () => {
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

    async function handleProductSubmit(formData: typeof productFormData) {
        if (!formData.name.trim()) {
            toast.error("Product name is required");
            return;
        }

        for (const optionList of formData.optionLists) {
            if (!optionList.name.trim()) {
                toast.error("Each option list must have a name");
                return;
            }
            if (
                optionList.minNumOptions < 0 ||
                optionList.maxNumOptions < 0 ||
                optionList.minNumOptions > optionList.maxNumOptions
            ) {
                toast.error(`Invalid min/max options in list \"${optionList.name || "(unnamed)"}\"`);
                return;
            }
            for (const option of optionList.options) {
                if (!option.name.trim()) {
                    toast.error(`Each option in list \"${optionList.name}\" must have a name`);
                    return;
                }
                const parsedAdjustment = Number(option.unitAmount || 0);
                if (!Number.isFinite(parsedAdjustment)) {
                    toast.error(`Option \"${option.name}\" has invalid price adjustment`);
                    return;
                }
            }
        }

        await saveProductMutation.mutateAsync(formData);
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
                storeId={storeId}
                open={isProductDialogOpen}
                onOpenChange={(open: boolean) => {
                    if (!open) closeProductDialog();
                }}
                initialFormData={productFormData}
                categories={categoryOptions}
                isSaving={saveProductMutation.isPending}
                isUploadingImage={uploadProductImageMutation.isPending}
                onSubmit={handleProductSubmit}
                onUploadImage={async (file) => {
                    const upload = await uploadProductImageMutation.mutateAsync(file);
                    return upload.fileUrl;
                }}
            />
        </>
    );
}
