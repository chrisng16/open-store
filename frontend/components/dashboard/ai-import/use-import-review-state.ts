"use client";

import type { ProductCategoryOption, ProductFormData } from "@/components/dashboard/products/product-editor-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImportItem, ItemDraft, MenuImportDetail, StatusFilter } from "./types";
import {
    cloneModifiers,
    emptyProductFormData,
    itemToEditorFormData,
    matchesStatusFilter,
    modifiersEqual,
    parseDraftPrice,
} from "./utils";

type UseImportReviewStateParams = {
    importData?: MenuImportDetail;
    categoryOptions: ProductCategoryOption[];
};

export function useImportReviewState({ importData, categoryOptions }: UseImportReviewStateParams) {
    const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
    const [editorItemId, setEditorItemId] = useState<string | null>(null);
    const [editorFormData, setEditorFormData] = useState<ProductFormData>(emptyProductFormData);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
    const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
    const [isBulkCategoryDialogOpen, setIsBulkCategoryDialogOpen] = useState(false);
    const [bulkCategory, setBulkCategory] = useState<{ categoryName: string; categoryId: string }>({
        categoryName: "",
        categoryId: "",
    });

    const isDraftDirty = useCallback((item: ImportItem, draft?: ItemDraft): boolean => {
        if (!draft) return false;
        const serverCategory = item.categoryName || "";
        const serverPrice = item.unitAmount == null ? null : Number(item.unitAmount) / 100;
        const draftPrice = parseDraftPrice(draft.price);

        return (
            draft.name !== item.itemName ||
            draft.category !== serverCategory ||
            draftPrice !== serverPrice ||
            draft.description !== (item.description || "") ||
            !modifiersEqual(draft.optionLists, item.optionLists) ||
            draft.status !== item.status
        );
    }, []);

    const getDraft = useCallback(
        (item: ImportItem): ItemDraft =>
            drafts[item.id] || {
                name: item.itemName,
                price: item.unitAmount == null ? "" : String(Number(item.unitAmount) / 100),
                category: item.categoryName || "",
                description: item.description || "",
                optionLists: cloneModifiers(item.optionLists),
                status: item.status,
            },
        [drafts]
    );

    useEffect(() => {
        if (!importData) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDrafts((prev) => {
            const hasDirtyChanges = importData.items.some((item) => isDraftDirty(item, prev[item.id]));
            if (Object.keys(prev).length > 0 && hasDirtyChanges) {
                return prev;
            }

            const next: Record<string, ItemDraft> = {};
            for (const item of importData.items) {
                next[item.id] = {
                    name: item.itemName,
                    price: item.unitAmount == null ? "" : String(Number(item.unitAmount) / 100),
                    category: item.categoryName || "",
                    description: item.description || "",
                    optionLists: cloneModifiers(item.optionLists),
                    status: item.status,
                };
            }
            return next;
        });
    }, [importData, isDraftDirty]);

    const isPublished = importData?.status === "published";

    const resetEditor = useCallback(() => {
        setEditorItemId(null);
        setEditorFormData(emptyProductFormData);
    }, []);

    useEffect(() => {
        if (!isPublished) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        resetEditor();
        setIsPublishConfirmOpen(false);
    }, [isPublished, resetEditor]);

    const dirtyItemIds = useMemo(() => {
        if (!importData) return [] as string[];
        return importData.items
            .filter((item) => isDraftDirty(item, drafts[item.id]))
            .map((item) => item.id);
    }, [importData, drafts, isDraftDirty]);

    const hasDirtyChanges = dirtyItemIds.length > 0;

    const updateDraft = useCallback((itemId: string, updater: (current: ItemDraft) => ItemDraft) => {
        setDrafts((prev) => {
            const existing = prev[itemId];
            const base: ItemDraft = existing || {
                name: "",
                price: "",
                category: "",
                description: "",
                optionLists: null,
                status: "pending",
            };
            return {
                ...prev,
                [itemId]: updater(base),
            };
        });
    }, []);

    const effectiveItems = useMemo<ImportItem[]>(() => {
        if (!importData) return [] as ImportItem[];
        return importData.items.map((item) => {
            const draft = getDraft(item);
            return {
                ...item,
                itemName: draft.name,
                description: draft.description || null,
                categoryName: draft.category || null,
                unitAmount: draft.price.trim() ? Math.round((parseDraftPrice(draft.price) ?? 0) * 100) : null,
                optionLists: cloneModifiers(draft.optionLists),
                status: draft.status,
            };
        });
    }, [getDraft, importData]);

    const effectiveItemMap = useMemo(
        () => new Map(effectiveItems.map((item) => [item.id, item])),
        [effectiveItems]
    );

    const dirtyItemIdSet = useMemo(() => new Set(dirtyItemIds), [dirtyItemIds]);

    const filteredItems = useMemo(
        () => effectiveItems.filter((item) => matchesStatusFilter(item.status, statusFilter)),
        [effectiveItems, statusFilter]
    );

    const dirtyCounts = useMemo(
        () => ({
            pending: effectiveItems.filter((item) => matchesStatusFilter(item.status, "pending") && dirtyItemIdSet.has(item.id)).length,
            accepted: effectiveItems.filter((item) => matchesStatusFilter(item.status, "accepted") && dirtyItemIdSet.has(item.id)).length,
            rejected: effectiveItems.filter((item) => matchesStatusFilter(item.status, "rejected") && dirtyItemIdSet.has(item.id)).length,
        }),
        [effectiveItems, dirtyItemIdSet]
    );

    const applyBulkStatus = useCallback((nextStatus: "approved" | "rejected", selectedItemIds: Set<string>) => {
        if (isPublished || selectedItemIds.size === 0) return;
        setDrafts((prev) => {
            const next = { ...prev };
            selectedItemIds.forEach((itemId) => {
                const sourceItem = effectiveItemMap.get(itemId);
                if (!sourceItem) return;
                const current = next[itemId] || getDraft(sourceItem);
                next[itemId] = {
                    ...current,
                    status: nextStatus,
                };
            });
            return next;
        });
    }, [effectiveItemMap, getDraft, isPublished]);

    const applyBulkCategory = useCallback((categoryName: string, selectedItemIds: Set<string>) => {
        const normalizedCategoryName = categoryName.trim();
        if (isPublished || !normalizedCategoryName || selectedItemIds.size === 0) return;
        setDrafts((prev) => {
            const next = { ...prev };
            selectedItemIds.forEach((itemId) => {
                const sourceItem = effectiveItemMap.get(itemId);
                if (!sourceItem) return;
                const current = next[itemId] || getDraft(sourceItem);
                next[itemId] = {
                    ...current,
                    category: normalizedCategoryName,
                    status: current.status === "pending" ? "edited" : current.status,
                };
            });
            return next;
        });
    }, [effectiveItemMap, getDraft, isPublished]);

    const hasBulkCategoryValue = bulkCategory.categoryName.trim().length > 0;

    const openEditor = useCallback((item: ImportItem) => {
        if (isPublished) return;
        setEditorItemId(item.id);
        setEditorFormData(itemToEditorFormData(item, getDraft(item), categoryOptions));
    }, [categoryOptions, getDraft, isPublished]);

    return {
        drafts,
        setDrafts,
        editorItemId,
        setEditorItemId,
        editorFormData,
        setEditorFormData,
        statusFilter,
        setStatusFilter,
        isPublishConfirmOpen,
        setIsPublishConfirmOpen,
        isBulkCategoryDialogOpen,
        setIsBulkCategoryDialogOpen,
        bulkCategory,
        setBulkCategory,
        isPublished,
        dirtyItemIds,
        hasDirtyChanges,
        getDraft,
        updateDraft,
        effectiveItems,
        dirtyItemIdSet,
        filteredItems,
        dirtyCounts,
        applyBulkStatus,
        applyBulkCategory,
        hasBulkCategoryValue,
        openEditor,
        resetEditor,
    };
}
