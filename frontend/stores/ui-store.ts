"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

type CategoryDialogFormData = {
    id?: string;
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
};

type ProductDialogFormData = {
    id?: string;
    name: string;
    description: string;
    basePrice: string;
    imageUrl: string;
    categoryId: string;
    categoryName: string;
    optionLists: {
        name: string;
        minNumOptions: number;
        maxNumOptions: number;
        isOptional: boolean;
        options: {
            name: string;
            unitAmount: string;
            isDefault: boolean;
            sortOrder: number;
        }[];
    }[];
};

type UIState = {
    isCategoryDialogOpen: boolean;
    isProductDialogOpen: boolean;
    isStorefrontProductDialogOpen: boolean;
    storefrontProductDialogItemId: string | null;
    isCartProductDialogOpen: boolean;
    cartProductDialogItemId: string | null;
    isCartSheetOpen: boolean;
    menuSearchQuery: string;
    categoryFormData: CategoryDialogFormData;
    productFormData: ProductDialogFormData;

    openCategoryCreate: () => void;
    openCategoryEdit: (data: CategoryDialogFormData) => void;
    closeCategoryDialog: () => void;
    setCategoryFormData: (data: CategoryDialogFormData) => void;

    openProductCreate: () => void;
    openProductEdit: (data: ProductDialogFormData) => void;
    closeProductDialog: () => void;
    setProductFormData: (data: ProductDialogFormData) => void;

    openStorefrontProductDialog: (itemId: string) => void;
    closeStorefrontProductDialog: () => void;

    openCartProductDialog: (itemId: string) => void;
    closeCartProductDialog: () => void;

    openCartSheet: () => void;
    closeCartSheet: () => void;

    setMenuSearchQuery: (query: string) => void;
};

export const emptyCategoryFormData: CategoryDialogFormData = {
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
};

export const emptyProductFormData: ProductDialogFormData = {
    name: "",
    description: "",
    basePrice: "",
    imageUrl: "",
    categoryId: "",
    categoryName: "",
    optionLists: [],
};

export const useUIStore = create<UIState>((set) => ({
    isCategoryDialogOpen: false,
    isProductDialogOpen: false,
    isStorefrontProductDialogOpen: false,
    storefrontProductDialogItemId: null,
    isCartProductDialogOpen: false,
    cartProductDialogItemId: null,
    isCartSheetOpen: false,
    menuSearchQuery: "",
    categoryFormData: emptyCategoryFormData,
    productFormData: emptyProductFormData,

    openCategoryCreate: () =>
        set({
            isCategoryDialogOpen: true,
            categoryFormData: emptyCategoryFormData,
        }),
    openCategoryEdit: (data) =>
        set({
            isCategoryDialogOpen: true,
            categoryFormData: data,
        }),
    closeCategoryDialog: () => set({ isCategoryDialogOpen: false }),
    setCategoryFormData: (data) => set({ categoryFormData: data }),

    openProductCreate: () =>
        set({
            isProductDialogOpen: true,
            productFormData: emptyProductFormData,
        }),
    openProductEdit: (data) =>
        set({
            isProductDialogOpen: true,
            productFormData: data,
        }),
    closeProductDialog: () => set({ isProductDialogOpen: false }),
    setProductFormData: (data) => set({ productFormData: data }),

    openStorefrontProductDialog: (itemId) =>
        set({
            isStorefrontProductDialogOpen: true,
            storefrontProductDialogItemId: itemId,
        }),
    closeStorefrontProductDialog: () =>
        set({
            isStorefrontProductDialogOpen: false,
        }),

    openCartProductDialog: (itemId) =>
        set({
            isCartProductDialogOpen: true,
            cartProductDialogItemId: itemId,
        }),
    closeCartProductDialog: () =>
        set({
            isCartProductDialogOpen: false,
        }),

    openCartSheet: () =>
        set({
            isCartSheetOpen: true,
        }),
    closeCartSheet: () =>
        set({
            isCartSheetOpen: false,
        }),

    setMenuSearchQuery: (query) =>
        set({
            menuSearchQuery: query,
        }),
}));

export function useStockManagementDialogState() {
    return useUIStore(
        useShallow((state) => ({
            isCategoryDialogOpen: state.isCategoryDialogOpen,
            isProductDialogOpen: state.isProductDialogOpen,
            categoryFormData: state.categoryFormData,
            productFormData: state.productFormData,
            closeCategoryDialog: state.closeCategoryDialog,
            closeProductDialog: state.closeProductDialog,
            setCategoryFormData: state.setCategoryFormData,
            setProductFormData: state.setProductFormData,
        }))
    );
}

export function useCategoryDialogActions() {
    return useUIStore(
        useShallow((state) => ({
            openCategoryCreate: state.openCategoryCreate,
            openCategoryEdit: state.openCategoryEdit,
        }))
    );
}

export function useProductDialogActions() {
    return useUIStore(
        useShallow((state) => ({
            openProductCreate: state.openProductCreate,
            openProductEdit: state.openProductEdit,
        }))
    );
}

export function useStorefrontProductDialogState() {
    return useUIStore(
        useShallow((state) => ({
            isOpen: state.isStorefrontProductDialogOpen,
            itemId: state.storefrontProductDialogItemId,
            open: state.openStorefrontProductDialog,
            close: state.closeStorefrontProductDialog,
        }))
    );
}

export function useCartProductDialogState() {
    return useUIStore(
        useShallow((state) => ({
            isOpen: state.isCartProductDialogOpen,
            itemId: state.cartProductDialogItemId,
            open: state.openCartProductDialog,
            close: state.closeCartProductDialog,
        }))
    );
}

export function useCartSheetState() {
    return useUIStore(
        useShallow((state) => ({
            isOpen: state.isCartSheetOpen,
            open: state.openCartSheet,
            close: state.closeCartSheet,
        }))
    );
}

export function useMenuSearchState() {
    return useUIStore(
        useShallow((state) => ({
            query: state.menuSearchQuery,
            setQuery: state.setMenuSearchQuery,
        }))
    );
}

export type { CategoryDialogFormData, ProductDialogFormData };
