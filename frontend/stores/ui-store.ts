"use client";

import { create } from "zustand";

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
}));

export type { CategoryDialogFormData, ProductDialogFormData };
