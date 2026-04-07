"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ImageUp, ListPlus, Loader2, PanelRightOpen } from "lucide-react";

import { ProductCategoryInput } from "./product-category-input";
import type { ProductCategoryOption, ProductFormData } from "./product-editor-types";

type ProductBasicInfoSheetProps = {
    formData: ProductFormData;
    onFormDataChange: (value: ProductFormData) => void;
    categories: ProductCategoryOption[];
    onToggleOptions: () => void;
    optionsOpen: boolean;
    onUploadImage: (file: File) => Promise<void>;
    isUploadingImage: boolean;
    disablePriceEditing?: boolean;
};

export function ProductBasicInfoSheet({
    formData,
    onFormDataChange,
    categories,
    onToggleOptions,
    optionsOpen,
    onUploadImage,
    isUploadingImage,
    disablePriceEditing = false,
}: ProductBasicInfoSheetProps) {
    const optionGroupCount = formData.optionLists.length;

    return (
        <section className="flex min-h-0 w-full xl:w-1/2 max-w-136 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="prod-name">Name</Label>
                    <Input
                        id="prod-name"
                        required
                        value={formData.name}
                        onChange={(event) =>
                            onFormDataChange({ ...formData, name: event.target.value })
                        }
                        placeholder="Margherita Pizza"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="prod-desc">Description</Label>
                    <Textarea
                        id="prod-desc"
                        value={formData.description}
                        onChange={(event) =>
                            onFormDataChange({ ...formData, description: event.target.value })
                        }
                        placeholder="Fresh mozzarella, tomato sauce, basil"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="prod-price">Price ($)</Label>
                    <Input
                        id="prod-price"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        disabled={disablePriceEditing}
                        value={formData.basePrice}
                        onChange={(event) =>
                            onFormDataChange({ ...formData, basePrice: event.target.value })
                        }
                        placeholder="12.99"
                    />
                    {disablePriceEditing ? (
                        <p className="text-xs text-muted-foreground">Only store owners can update product prices.</p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="prod-image-url">Product image</Label>
                    <Input
                        id="prod-image-url"
                        value={formData.imageUrl}
                        onChange={(event) =>
                            onFormDataChange({ ...formData, imageUrl: event.target.value })
                        }
                        placeholder="https://..."
                    />

                    <div>
                        <label htmlFor="prod-image-upload">
                            <Button asChild type="button" variant="outline" size="sm" disabled={isUploadingImage}>
                                <span>
                                    {isUploadingImage ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <ImageUp className="mr-2 h-4 w-4" />
                                    )}
                                    {isUploadingImage ? "Uploading..." : "Upload image"}
                                </span>
                            </Button>
                        </label>
                        <input
                            id="prod-image-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                try {
                                    await onUploadImage(file);
                                } finally {
                                    event.target.value = "";
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Category</Label>
                    <ProductCategoryInput
                        value={formData.categoryName}
                        selectedCategoryId={formData.categoryId}
                        categories={categories}
                        onChange={(nextCategory) =>
                            onFormDataChange({
                                ...formData,
                                ...nextCategory,
                            })
                        }
                    />
                </div>

                <div className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium">Options & Groups</p>
                            <p className="text-xs text-muted-foreground">
                                Configure sizes, add-ons, and choice limits
                            </p>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant={optionsOpen ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={onToggleOptions}
                                    >
                                        {optionsOpen ? <PanelRightOpen className="size-4" /> : <ListPlus className="size-4" />}
                                        {optionsOpen ? "Hide Options" : "Edit Options"}
                                        <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] leading-4">
                                            {optionGroupCount}
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Open a second sheet to edit option lists and options.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        </section>
    );
}
