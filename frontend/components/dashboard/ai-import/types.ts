export type ImportItem = {
    id: string;
    itemName: string;
    description: string | null;
    unitAmount: number | null;
    categoryName: string | null;
    confidence: number | null;
    status: string;
    optionLists: {
        optionLists?: {
            name: string;
            selectionNode?: string;
            minNumOptions?: number;
            maxNumOptions?: number;
            isOptional?: boolean;
            options?: {
                name: string;
                unitAmount?: number;
                isDefault?: boolean;
            }[];
        }[];
        [key: string]: unknown;
    } | null;
};

export type MenuImportDetail = {
    id: string;
    fileUrl: string;
    fileSizeBytes: number | null;
    fileSizeMb: number | null;
    status: string;
    createdAt: string;
    processingStartedAt: string | null;
    ingestedAt: string | null;
    ingestDurationSeconds: number | null;
    processingElapsedSeconds: number | null;
    aiProcessingSeconds: number | null;
    aiSecondsPerMb: number | null;
    aiMbPerSecond: number | null;
    parsedData?: {
        ingestionMeta?: {
            parser?: string | null;
            model?: string | null;
            promptVersion?: string | null;
        };
    } | null;
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
    optionLists: ImportItem["optionLists"];
    status: string;
};

export type StatusFilter = "pending" | "accepted" | "rejected";
