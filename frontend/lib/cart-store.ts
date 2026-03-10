"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartOption = {
    option_id: string;
    option_name: string;
    unit_amount: number;
    quantity: number;
    // optional snapshot of the list this option belonged to (helps edit flows)
    option_list_id?: string;
};

export type CartItem = {
    id: string; // unique cart item id
    product_id: string;
    product_name: string;
    unit_amount: number;
    quantity: number;
    options: CartOption[];
    image_url?: string | null;
    // optional snapshot of the product's option lists so items are editable
    product_option_lists?: any[];
};

type CartState = {
    items: CartItem[];
    storeSlug: string | null;
    addItem: (item: Omit<CartItem, "id">) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    updateItem: (id: string, patch: Partial<CartItem>) => void;
    clearCart: () => void;
    setStoreSlug: (slug: string) => void;
    getSubtotal: () => number;
    getItemCount: () => number;
};

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function normalizeCartItem(item: Partial<CartItem>): CartItem {
    return {
        id: item.id ?? generateId(),
        product_id: item.product_id ?? "",
        product_name: item.product_name ?? "",
        unit_amount: Number(item.unit_amount ?? 0),
        quantity: Math.max(1, Number(item.quantity ?? 1)),
        options: Array.isArray(item.options)
            ? item.options.map((option) => ({
                option_id: option.option_id,
                option_name: option.option_name,
                unit_amount: Number(option.unit_amount ?? 0),
                quantity: Math.max(0, Number(option.quantity ?? 0)),
                option_list_id: option.option_list_id,
            }))
            : [],
        image_url: item.image_url ?? null,
        product_option_lists: Array.isArray(item.product_option_lists)
            ? item.product_option_lists
            : undefined,
    };
}

function normalizeItems(items: unknown): CartItem[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => normalizeCartItem((item ?? {}) as Partial<CartItem>));
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            storeSlug: null,

            setStoreSlug: (slug: string) => {
                const current = get().storeSlug;
                if (current && current !== slug) {
                    // Different store — clear cart
                    set({ items: [], storeSlug: slug });
                } else {
                    set({ storeSlug: slug });
                }
            },

            addItem: (item) => {
                const normalizedItem = normalizeCartItem(item);
                const existing = get().items.find(
                    (i) =>
                        i.product_id === normalizedItem.product_id &&
                        JSON.stringify(i.options) === JSON.stringify(normalizedItem.options)
                );
                if (existing) {
                    set({
                        items: normalizeItems(get().items).map((i) =>
                            i.id === existing.id
                                ? { ...i, quantity: i.quantity + normalizedItem.quantity }
                                : i
                        ),
                    });
                } else {
                    set({ items: [...normalizeItems(get().items), normalizedItem] });
                }
            },

            removeItem: (id) => {
                set({ items: normalizeItems(get().items).filter((i) => i.id !== id) });
            },

            updateQuantity: (id, quantity) => {
                if (quantity <= 0) {
                    set({ items: normalizeItems(get().items).filter((i) => i.id !== id) });
                } else {
                    set({
                        items: normalizeItems(get().items).map((i) =>
                            i.id === id ? { ...i, quantity } : i
                        ),
                    });
                }
            },

            updateItem: (id, patch) => {
                set({
                    items: normalizeItems(get().items).map((i) => (
                        i.id === id
                            ? {
                                ...i,
                                ...patch,
                                options: Array.isArray(patch.options)
                                    ? normalizeCartItem({ ...i, ...patch }).options
                                    : i.options,
                                quantity: typeof patch.quantity === "number"
                                    ? Math.max(1, patch.quantity)
                                    : i.quantity,
                                image_url: patch.image_url === undefined ? i.image_url : patch.image_url,
                                product_option_lists: patch.product_option_lists === undefined
                                    ? i.product_option_lists
                                    : patch.product_option_lists,
                            }
                            : i
                    )),
                });
            },

            clearCart: () => set({ items: [] }),

            getSubtotal: () => {
                return normalizeItems(get().items).reduce((total, item) => {
                    const optionTotal = item.options.reduce(
                        (sum, o) => sum + o.unit_amount * o.quantity,
                        0
                    );
                    return total + (item.unit_amount + optionTotal) * item.quantity;
                }, 0);
            },

            getItemCount: () => {
                return normalizeItems(get().items).reduce((count, item) => count + item.quantity, 0);
            },
        }),
        {
            name: "open-store-cart",
            merge: (persistedState, currentState) => {
                const persisted = (persistedState as Partial<CartState> | undefined) ?? {};
                return {
                    ...currentState,
                    ...persisted,
                    items: normalizeItems(persisted.items),
                    storeSlug: typeof persisted.storeSlug === "string" ? persisted.storeSlug : null,
                };
            },
        }
    )
);
