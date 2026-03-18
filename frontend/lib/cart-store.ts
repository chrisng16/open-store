"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

export type CartOption = {
    option_id: string;
    option_name?: string;
    quantity: number;
    option_list_id?: string;
};

export type CartItem = {
    id: string; // unique cart item id
    product_id: string;
    product_name: string;
    quantity: number;
    options: CartOption[];
    image_url?: string | null;
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
        quantity: Math.max(1, Number(item.quantity ?? 1)),
        options: Array.isArray(item.options)
            ? item.options.map((option) => ({
                option_id: option.option_id,
                option_name: option.option_name,
                quantity: Math.max(0, Number(option.quantity ?? 0)),
                option_list_id: option.option_list_id,
            }))
            : [],
        image_url: item.image_url ?? null,
    };
}

function normalizeItems(items: unknown): CartItem[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => normalizeCartItem((item ?? {}) as Partial<CartItem>));
}

function getCartItemCount(items: CartItem[]): number {
    return items.reduce((count, item) => count + item.quantity, 0);
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
                const normalizeOptionsSignature = (options: CartOption[]) =>
                    [...options]
                        .sort((a, b) => a.option_id.localeCompare(b.option_id))
                        .map((option) => `${option.option_id}:${option.quantity}`)
                        .join("|");
                const existing = get().items.find(
                    (i) =>
                        i.product_id === normalizedItem.product_id &&
                        normalizeOptionsSignature(i.options) ===
                        normalizeOptionsSignature(normalizedItem.options)
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
                            }
                            : i
                    )),
                });
            },

            clearCart: () => set({ items: [] }),

            getItemCount: () => {
                return getCartItemCount(normalizeItems(get().items));
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

export function useCartHydrated() {
    return useSyncExternalStore(
        (onStoreChange) => useCartStore.persist.onFinishHydration(onStoreChange),
        () => useCartStore.persist.hasHydrated(),
        () => false
    );
}

const EMPTY_ITEMS: CartItem[] = [];

export function useCartSummary(slug?: string) {
    return useCartStore(
        useShallow((state) => {
            const items = (slug && state.storeSlug !== slug) ? EMPTY_ITEMS : state.items;
            return {
                items,
                itemCount: getCartItemCount(items),
                storeSlug: state.storeSlug,
            };
        })
    );
}

export function useCartMutations() {
    return useCartStore(
        useShallow((state) => ({
            addItem: state.addItem,
            removeItem: state.removeItem,
            updateQuantity: state.updateQuantity,
            updateItem: state.updateItem,
            clearCart: state.clearCart,
            setStoreSlug: state.setStoreSlug,
        }))
    );
}
