import type { ProductCategoryOption, ProductFormData } from "@/components/dashboard/products/product-editor-dialog";
import type { ImportItem, ItemDraft, StatusFilter } from "./types";

export const emptyProductFormData: ProductFormData = {
    name: "",
    description: "",
    basePrice: "",
    imageUrl: "",
    categoryId: "",
    categoryName: "",
    modifierGroups: [],
};

export function getFileNameFromUrl(fileUrl: string): string {
    try {
        const pathname = new URL(fileUrl).pathname;
        const name = pathname.split("/").filter(Boolean).pop();
        return name || "Imported menu";
    } catch {
        return fileUrl.split("/").filter(Boolean).pop() || "Imported menu";
    }
}

export function cloneModifiers(modifiers: ImportItem["modifiers"]): ImportItem["modifiers"] {
    if (!modifiers) return null;
    return {
        ...modifiers,
        groups: modifiers.groups?.map((group) => ({
            ...group,
            options: group.options?.map((option) => ({ ...option })),
        })),
    };
}

export function modifiersEqual(
    left: ImportItem["modifiers"] | undefined,
    right: ImportItem["modifiers"] | undefined
): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function modifiersToFormData(item: ImportItem): ProductFormData["modifierGroups"] {
    return (
        item.modifiers?.groups?.map((group) => ({
            name: group.groupName,
            minSelections: group.minSelections ?? 0,
            maxSelections: group.maxSelections ?? 1,
            isRequired: !!group.isRequired,
            modifiers:
                group.options?.map((option, index) => ({
                    name: option.name,
                    priceAdjustment: String(option.priceAdjustment ?? 0),
                    isDefault: !!option.isDefault,
                    sortOrder: index,
                })) ?? [],
        })) ?? []
    );
}

export function formDataToModifiers(formData: ProductFormData): ImportItem["modifiers"] {
    return {
        groups: formData.modifierGroups.map((group) => ({
            groupName: group.name,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            isRequired: group.isRequired,
            options: group.modifiers.map((modifier) => ({
                name: modifier.name,
                priceAdjustment: Number(modifier.priceAdjustment || 0),
                isDefault: modifier.isDefault,
            })),
        })),
    };
}

export function parseDraftPrice(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return null;
    return parsed;
}

export function getMutationErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
}

export function confidenceColor(score: number | null): string {
    if (score === null) return "text-muted-foreground";
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-yellow-600";
    return "text-red-600";
}

export function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
    if (filter === "pending") return status === "pending" || status === "edited";
    if (filter === "accepted") return status === "approved";
    return status === "rejected";
}

export function itemToEditorFormData(
    item: ImportItem,
    draft: ItemDraft,
    categoryOptions: ProductCategoryOption[]
): ProductFormData {
    const normalizedCategory = draft.category.trim();
    const matchedCategory = categoryOptions.find(
        (category) => category.name.trim().toLowerCase() === normalizedCategory.toLowerCase()
    );

    return {
        id: item.id,
        name: draft.name,
        description: draft.description,
        basePrice: draft.price,
        imageUrl: "",
        categoryId: matchedCategory?.id || "",
        categoryName: draft.category,
        modifierGroups: modifiersToFormData({ ...item, modifiers: draft.modifiers }),
    };
}
