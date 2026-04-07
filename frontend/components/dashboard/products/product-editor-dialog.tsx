"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { ProductBasicInfoSheet } from "@/components/dashboard/products/product-basic-info-sheet";
import type { ProductCategoryOption, ProductFormData } from "@/components/dashboard/products/product-editor-types";
import { ProductOptionsSheet } from "@/components/dashboard/products/product-options-sheet";

type ProductEditorDialogProps = {
    storeId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialFormData: ProductFormData;
    categories: ProductCategoryOption[];
    isSaving: boolean;
    isUploadingImage: boolean;
    onSubmit: (formData: ProductFormData) => Promise<void>;
    onUploadImage: (file: File) => Promise<string>;
    disablePriceEditing?: boolean;
};

type ProductDetailResponse = {
    id: string;
    name: string;
    description: string | null;
    unitAmount: number;
    imageUrl?: string | null;
    categoryId: string | null;
    optionLists?: {
        id: string;
        name: string;
        minNumOptions: number;
        maxNumOptions: number;
        isOptional: boolean;
        options: {
            id: string;
            name: string;
            unitAmount: number;
            isDefault: boolean;
            sortOrder: number;
        }[];
    }[];
};

export function ProductEditorDialog({
    storeId,
    open,
    onOpenChange,
    initialFormData,
    categories,
    isSaving,
    isUploadingImage,
    onSubmit,
    onUploadImage,
    disablePriceEditing = false,
}: ProductEditorDialogProps) {
    const queryClient = useQueryClient();
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [formData, setFormData] = useState<ProductFormData>(initialFormData);
    const [isDirty, setIsDirty] = useState(false);

    const activeProductId = open ? initialFormData.id : undefined;
    const productQueryKey = ["dialog-product-detail", storeId, activeProductId] as const;

    const { data: productDetail } = useQuery({
        queryKey: productQueryKey,
        queryFn: async () =>
            fetchWithAccessToken<ProductDetailResponse>(
                `/stores/${storeId}/products/${activeProductId}`
            ),
        enabled: !!storeId && !!activeProductId && open,
        initialData: () => queryClient.getQueryData<ProductDetailResponse>(productQueryKey),
        staleTime: 0,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: true,
    });

    useEffect(() => {
        if (!open) {
            setIsOptionsOpen(false);
            setIsDirty(false);
            return;
        }

        setFormData(initialFormData);
        setIsDirty(false);
    }, [activeProductId, open]);

    useEffect(() => {
        if (!open) return;
        if (!productDetail) return;
        if (!activeProductId || productDetail.id !== activeProductId) return;
        if (isDirty) return;

        const selectedCategoryName =
            categories.find((category) => category.id === productDetail.categoryId)?.name ?? "";

        setFormData({
            id: productDetail.id,
            name: productDetail.name,
            description: productDetail.description ?? "",
            basePrice: String((productDetail.unitAmount ?? 0) / 100),
            imageUrl: productDetail.imageUrl ?? "",
            categoryId: productDetail.categoryId ?? "",
            categoryName: selectedCategoryName,
            optionLists: (productDetail.optionLists ?? []).map((group) => ({
                id: group.id,
                name: group.name,
                minNumOptions: group.minNumOptions,
                maxNumOptions: group.maxNumOptions,
                isOptional: group.isOptional,
                options: group.options.map((option) => ({
                    id: option.id,
                    name: option.name,
                    unitAmount: String((option.unitAmount ?? 0) / 100),
                    isDefault: option.isDefault,
                    sortOrder: option.sortOrder,
                })),
            })),
        });
    }, [activeProductId, categories, isDirty, open, productDetail]);

    function handleFormDataChange(value: ProductFormData) {
        setFormData(value);
        setIsDirty(true);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await onSubmit(formData);
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className={cn(
                    "overflow-hidden p-0 w-full max-w-136 sm:max-w-lg lg:max-w-5xl transition-[width] duration-100",
                    isOptionsOpen ? "lg:w-272" : "lg:w-136"
                )}
            >
                <form onSubmit={handleSubmit} className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <SheetHeader className="border-b p-4">
                        <SheetTitle>{formData.id ? "Edit Product" : "Add Product"}</SheetTitle>
                        <SheetDescription>
                            Manage product details and options.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="relative flex min-h-0 flex-1 w-full max-w-lg lg:max-w-5xl overflow-hidden">
                        <ProductBasicInfoSheet
                            formData={formData}
                            onFormDataChange={handleFormDataChange}
                            categories={categories}
                            disablePriceEditing={disablePriceEditing && !!formData.id}
                            optionsOpen={isOptionsOpen}
                            onToggleOptions={() => setIsOptionsOpen(prev => !prev)}
                            isUploadingImage={isUploadingImage}
                            onUploadImage={async (file) => {
                                const fileUrl = await onUploadImage(file);
                                setFormData((prev) => ({ ...prev, imageUrl: fileUrl }));
                                setIsDirty(true);
                            }}
                        />

                        <div className={cn(
                            "transition-all duration-300 ease-in-out",
                            "absolute lg:static inset-0 z-50 max-w-136 overflow-hidden",
                            isOptionsOpen
                                ? "translate-x-0 opacity-100 lg:w-1/2 pointer-events-auto"
                                : "translate-x-full opacity-0 lg:w-0 pointer-events-none"
                        )}>
                            <ProductOptionsSheet
                                open={isOptionsOpen}
                                formData={formData}
                                onFormDataChange={handleFormDataChange}
                                onClose={() => setIsOptionsOpen(false)}
                            />
                        </div>

                    </div>

                    <div className="border-t p-4">
                        <div className="flex w-full justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving
                                    ? "Saving..."
                                    : formData.id
                                        ? "Update Product"
                                        : "Add Product"}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}

export type {
    ProductCategoryOption,
    ProductFormData,
    ProductOptionFormData,
    ProductOptionListFormData
} from "@/components/dashboard/products/product-editor-types";

