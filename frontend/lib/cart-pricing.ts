"use client";

import { api } from "@/lib/api";
import type { CartItem } from "@/lib/cart-store";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

type ProductOption = {
    id: string;
    name: string;
    unit_amount: number;
};

type ProductOptionList = {
    id: string;
    options: ProductOption[];
};

type ProductDetail = {
    id: string;
    name: string;
    image_url: string | null;
    unit_amount: number;
    option_lists: ProductOptionList[];
};

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

function indexOptionPrices(product: ProductDetail) {
    const byId = new Map<string, ProductOption>();
    for (const list of product.option_lists ?? []) {
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
                queryFn: () => api.products.get(storeId, productId) as Promise<ProductDetail>,
                enabled: !!storeId && !!productId,
                initialData: () => queryClient.getQueryData<ProductDetail>(queryKey),
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

    const productsById = useMemo<Record<string, ProductDetail>>(() => {
        const next: Record<string, ProductDetail> = {};
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
                const unitAmount = matched?.unit_amount ?? 0;
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
            const lineTotal = (product.unit_amount + optionTotalPerUnit) * item.quantity;

            return {
                id: item.id,
                product_id: item.product_id,
                product_name: product.name,
                image_url: product.image_url ?? item.image_url ?? null,
                quantity: item.quantity,
                unit_amount: product.unit_amount,
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
