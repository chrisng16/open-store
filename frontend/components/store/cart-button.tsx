"use client";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function CartButton({ slug }: { slug: string }) {
    const itemCount = useCartStore((s) =>
        s.items.reduce((count, item) => count + item.quantity, 0)
    );

    return (
        <Link href={`/store/${slug}/cart`}>
            <Button variant="outline" className="relative">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
                <span
                    suppressHydrationWarning
                    aria-hidden={itemCount <= 0}
                    className={`absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground transition ${itemCount > 0 ? "opacity-100" : "opacity-0"}`}
                >
                    {itemCount > 0 ? itemCount : ""}
                </span>
            </Button>
        </Link>
    );
}
