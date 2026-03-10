"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SubmitEventHandler } from "react";
import { useEffect, useState } from "react";

import { ProductBasicInfoSheet } from "@/components/dashboard/products/product-basic-info-sheet";
import type { ProductCategoryOption, ProductFormData } from "@/components/dashboard/products/product-editor-types";
import { ProductOptionsSheet } from "@/components/dashboard/products/product-options-sheet";

type ProductEditorDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formData: ProductFormData;
    onFormDataChange: (value: ProductFormData) => void;
    categories: ProductCategoryOption[];
    isSaving: boolean;
    isUploadingImage: boolean;
    onSubmit: SubmitEventHandler<HTMLFormElement>;
    onUploadImage: (file: File) => Promise<void>;
};

export function ProductEditorDialog({
    open,
    onOpenChange,
    formData,
    onFormDataChange,
    categories,
    isSaving,
    isUploadingImage,
    onSubmit,
    onUploadImage,
}: ProductEditorDialogProps) {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            setIsOptionsOpen(false);
        }
    }, [open]);

    useEffect(() => {
        if (open && formData.optionLists.length > 0) {
            setIsOptionsOpen(true);
        }
    }, [open, formData.optionLists.length]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className={cn(
                    "overflow-hidden p-0 w-full max-w-136 sm:max-w-128 lg:max-w-256 transition-[width] duration-100",
                    isOptionsOpen ? "lg:w-272" : "lg:w-136"
                )}
            >
                <form onSubmit={onSubmit} className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <SheetHeader className="border-b p-4">
                        <SheetTitle>{formData.id ? "Edit Product" : "Add Product"}</SheetTitle>
                        <SheetDescription>
                            Manage product details and options.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="relative flex min-h-0 flex-1 w-full max-w-128 lg:max-w-256 overflow-hidden">
                        <ProductBasicInfoSheet
                            formData={formData}
                            onFormDataChange={onFormDataChange}
                            categories={categories}
                            optionsOpen={isOptionsOpen}
                            onToggleOptions={() => setIsOptionsOpen(prev => !prev)}
                            isUploadingImage={isUploadingImage}
                            onUploadImage={onUploadImage}
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
                                onFormDataChange={onFormDataChange}
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

