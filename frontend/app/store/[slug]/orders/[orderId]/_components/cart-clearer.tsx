"use client";

import { useCartMutations } from "@/lib/cart-store";
import { useEffect } from "react";

export function CartClearer() {
    const { clearCart } = useCartMutations();

    useEffect(() => {
        clearCart();
    }, [clearCart]);

    return null;
}
