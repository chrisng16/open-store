export type ImportItem = {
    id: string;
    itemName: string;
    description: string | null;
    price: number | null;
    categoryName: string | null;
    confidence: number | null;
    status: string;
    modifiers: {
        groups?: {
            groupName: string;
            minSelections?: number;
            maxSelections?: number;
            isRequired?: boolean;
            options?: {
                name: string;
                priceAdjustment?: number;
                isDefault?: boolean;
            }[];
        }[];
        [key: string]: unknown;
    } | null;
};

export type MenuImportDetail = {
    id: string;
    fileUrl: string;
    status: string;
    items: ImportItem[];
};

export type CategoryResponse = {
    id: string;
    name: string;
};

export type ItemDraft = {
    name: string;
    price: string;
    category: string;
    description: string;
    modifiers: ImportItem["modifiers"];
    status: string;
};

export type StatusFilter = "pending" | "accepted" | "rejected";
