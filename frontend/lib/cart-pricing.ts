"use client";

import { api } from "@/lib/api";
import type { CartItem } from "@/lib/cart-store";
import { Product, Option } from "@/lib/types";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

export type PricedCartOption = {
    option_id: string;
    option_name: string;
    quantity: number;
    unit_amount: number;
    line_total: number;
};

export type PricedCartItem = {
    id: string;
    product_id: string;
    product_name: string;
    image_url: string | null;
    quantity: number;
    unit_amount: number;
    options: PricedCartOption[];
    line_total: number;
    unavailable?: boolean;
    isPricingLoading?: boolean;
};

function indexOptionPrices(product: Product) {
    const byId = new Map<string, Option>();
    for (const list of product.optionLists ?? []) {
        for (const option of list.options ?? []) {
            byId.set(option.id, option);
        }
    }
    return byId;
}

export function useCartPricing({
    storeId,
    items,
}: {
    storeId: string;
    items: CartItem[];
}) {
    const queryClient = useQueryClient();
    const productIds = useMemo(
        () => Array.from(new Set(items.map((item) => item.product_id))).sort(),
        [items]
    );

    const productQueries = useQueries({
        queries: productIds.map((productId) => {
            const queryKey = ["store-product", storeId, productId] as const;
            return {
                queryKey,
                queryFn: () => api.products.get(storeId, productId),
                enabled: !!storeId && !!productId,
                initialData: () => queryClient.getQueryData<Product>(queryKey),
                staleTime: 0,
                refetchOnMount: true,
            };
        }),
    });

    const productQueryMap = useMemo(() => {
        const map = new Map<string, (typeof productQueries)[number]>();
        productIds.forEach((productId, index) => {
            map.set(productId, productQueries[index]);
        });
        return map;
    }, [productIds, productQueries]);

    const productsById = useMemo<Record<string, Product>>(() => {
        const next: Record<string, Product> = {};
        productIds.forEach((productId, index) => {
            const product = productQueries[index]?.data;
            if (product) next[productId] = product;
        });
        return next;
    }, [productIds, productQueries]);

    const isLoading = productQueries.some((query) => query.isPending && !query.data);
    const firstError = productQueries.find((query) => query.error)?.error;
    const error = firstError instanceof Error
        ? firstError.message
        : firstError
            ? "Failed to refresh cart pricing"
            : null;

    const pricedItems = useMemo<PricedCartItem[]>(() => {
        return items.map((item) => {
            const product = productsById[item.product_id];
            const productQuery = productQueryMap.get(item.product_id);
            const isPricingLoading = !!productQuery?.isFetching;
            if (!product) {
                return {
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    image_url: item.image_url ?? null,
                    quantity: item.quantity,
                    unit_amount: 0,
                    options: [],
                    line_total: 0,
                    unavailable: true,
                    isPricingLoading,
                };
            }

            const optionPriceIndex = indexOptionPrices(product);
            const options: PricedCartOption[] = item.options.map((selected) => {
                const matched = optionPriceIndex.get(selected.option_id);
                const unitAmount = matched?.unitAmount ?? 0;
                const optionName = matched?.name ?? selected.option_name ?? "Option unavailable";
                return {
                    option_id: selected.option_id,
                    option_name: optionName,
                    quantity: selected.quantity,
                    unit_amount: unitAmount,
                    line_total: unitAmount * selected.quantity,
                };
            });

            const optionTotalPerUnit = options.reduce((sum, option) => sum + option.line_total, 0);
            const lineTotal = (product.unitAmount + optionTotalPerUnit) * item.quantity;

            return {
                id: item.id,
                product_id: item.product_id,
                product_name: product.name,
                image_url: product.imageUrl ?? item.image_url ?? null,
                quantity: item.quantity,
                unit_amount: product.unitAmount,
                options,
                line_total: lineTotal,
                isPricingLoading,
            };
        });
    }, [items, productQueryMap, productsById]);

    const subtotal = useMemo(
        () => pricedItems.reduce((sum, item) => sum + item.line_total, 0),
        [pricedItems]
    );
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + tax;

    return {
        pricedItems,
        subtotal,
        tax,
        total,
        isLoading,
        error,
    };
}
