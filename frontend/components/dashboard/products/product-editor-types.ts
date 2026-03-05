export type ProductCategoryOption = {
    id: string;
    name: string;
};

export type ProductModifierFormData = {
    name: string;
    priceAdjustment: string;
    isDefault: boolean;
    sortOrder: number;
};

export type ProductModifierGroupFormData = {
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    modifiers: ProductModifierFormData[];
};

export type ProductFormData = {
    id?: string;
    name: string;
    description: string;
    basePrice: string;
    imageUrl: string;
    categoryId: string;
    categoryName: string;
    modifierGroups: ProductModifierGroupFormData[];
};
