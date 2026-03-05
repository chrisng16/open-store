"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartModifier = {
    modifier_id: string;
    modifier_name: string;
    price_adjustment: number;
    // optional snapshot of the group this modifier belonged to (helps edit flows)
    group_id?: string;
};

export type CartItem = {
    id: string; // unique cart item id
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    modifiers: CartModifier[];
    image_url?: string | null;
    // optional snapshot of the product's modifier groups so items are editable
    product_modifier_groups?: any[];
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
                const existing = get().items.find(
                    (i) =>
                        i.product_id === item.product_id &&
                        JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
                );
                if (existing) {
                    set({
                        items: get().items.map((i) =>
                            i.id === existing.id
                                ? { ...i, quantity: i.quantity + item.quantity }
                                : i
                        ),
                    });
                } else {
                    set({ items: [...get().items, { ...item, id: generateId() }] });
                }
            },

            removeItem: (id) => {
                set({ items: get().items.filter((i) => i.id !== id) });
            },

            updateQuantity: (id, quantity) => {
                if (quantity <= 0) {
                    set({ items: get().items.filter((i) => i.id !== id) });
                } else {
                    set({
                        items: get().items.map((i) =>
                            i.id === id ? { ...i, quantity } : i
                        ),
                    });
                }
            },

            updateItem: (id, patch) => {
                set({
                    items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                });
            },

            clearCart: () => set({ items: [] }),

            getSubtotal: () => {
                return get().items.reduce((total, item) => {
                    const modifierTotal = item.modifiers.reduce(
                        (sum, m) => sum + m.price_adjustment,
                        0
                    );
                    return total + (item.unit_price + modifierTotal) * item.quantity;
                }, 0);
            },

            getItemCount: () => {
                return get().items.reduce((count, item) => count + item.quantity, 0);
            },
        }),
        {
            name: "open-store-cart",
        }
    )
);
