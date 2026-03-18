export type ProductCategoryOption = {
    id: string;
    name: string;
};

export type ProductOptionFormData = {
    id?: string;
    name: string;
    unitAmount: string;
    isDefault: boolean;
    sortOrder: number;
};

export type ProductOptionListFormData = {
    id?: string;
    name: string;
    minNumOptions: number;
    maxNumOptions: number;
    isOptional: boolean;
    options: ProductOptionFormData[];
};

export type ProductFormData = {
    id?: string;
    name: string;
    description: string;
    basePrice: string;
    imageUrl: string;
    categoryId: string;
    categoryName: string;
    optionLists: ProductOptionListFormData[];
};
