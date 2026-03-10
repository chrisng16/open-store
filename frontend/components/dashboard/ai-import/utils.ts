import type { ProductCategoryOption, ProductFormData } from "@/components/dashboard/products/product-editor-dialog";
import type { ImportItem, ItemDraft, StatusFilter } from "./types";

export const emptyProductFormData: ProductFormData = {
    name: "",
    description: "",
    basePrice: "",
    imageUrl: "",
    categoryId: "",
    categoryName: "",
    optionLists: [],
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

export function cloneModifiers(optionLists: ImportItem["optionLists"]): ImportItem["optionLists"] {
    if (!optionLists) return null;
    return {
        ...optionLists,
        optionLists: optionLists.optionLists?.map((group) => ({
            ...group,
            options: group.options?.map((option) => ({ ...option })),
        })),
    };
}

export function modifiersEqual(
    left: ImportItem["optionLists"] | undefined,
    right: ImportItem["optionLists"] | undefined
): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function modifiersToFormData(item: ImportItem): ProductFormData["optionLists"] {
    const extractOptionLists = (value: ImportItem["optionLists"]): NonNullable<ImportItem["optionLists"]>["optionLists"] => {
        if (!value) return [];

        const source = value as Record<string, unknown>;
        const direct = Array.isArray(source.optionLists) ? source.optionLists : [];
        const snake = Array.isArray(source.option_lists) ? (source.option_lists as unknown[]) : [];
        const candidate = direct.length > 0 ? direct : snake;

        if (candidate.length === 1) {
            const first = candidate[0] as Record<string, unknown>;
            const firstName = String(first?.name ?? "").trim().toLowerCase();
            const nested = Array.isArray(first?.options) ? (first.options as unknown[]) : [];
            const nestedLooksLikeOptionLists = nested.every(
                (entry) =>
                    typeof entry === "object" &&
                    entry !== null &&
                    (Array.isArray((entry as Record<string, unknown>).options) || typeof (entry as Record<string, unknown>).selectionNode === "string")
            );

            if (
                (firstName === "option_lists" || firstName === "optionlists") &&
                nested.length > 0 &&
                nestedLooksLikeOptionLists
            ) {
                return nested as NonNullable<ImportItem["optionLists"]>["optionLists"];
            }
        }

        return candidate as NonNullable<ImportItem["optionLists"]>["optionLists"];
    };

    return (
        extractOptionLists(item.optionLists)?.map((group) => ({
            name: group.name,
            minNumOptions: group.minNumOptions ?? 0,
            maxNumOptions: group.maxNumOptions ?? 1,
            isOptional: group.isOptional ?? true,
            options:
                group.options?.map((option, index) => ({
                    name: option.name,
                    unitAmount: String((option.unitAmount ?? 0) / 100),
                    isDefault: !!option.isDefault,
                    sortOrder: index,
                })) ?? [],
        })) ?? []
    );
}

export function formDataToModifiers(formData: ProductFormData): ImportItem["optionLists"] {
    return {
        optionLists: formData.optionLists.map((optionList) => ({
            name: optionList.name,
            selectionNode: optionList.maxNumOptions === 1 ? "single_select" : "multi_select",
            minNumOptions: optionList.minNumOptions,
            maxNumOptions: optionList.maxNumOptions,
            isOptional: optionList.isOptional,
            options: optionList.options.map((option) => ({
                name: option.name,
                unitAmount: Math.round(Number(option.unitAmount || 0) * 100),
                isDefault: option.isDefault,
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
        optionLists: modifiersToFormData({ ...item, optionLists: draft.optionLists }),
    };
}
