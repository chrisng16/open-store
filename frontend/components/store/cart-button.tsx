"use client";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function CartButton({ slug, ...props }: { slug: string } & React.ComponentProps<typeof Button>) {
    const itemCount = useCartStore((s) =>
        s.items.reduce((count, item) => count + item.quantity, 0)
    );

    return (
        <Link href={`/store/${slug}/cart`}>
            <Button variant="outline" className={cn("relative w-16 rounded-full px-6", props.className)} {...props}>
                <ShoppingCart className="size-4.5" />
                <span className="text-sm font-semibold tabular-nums">{itemCount}</span>
            </Button>
        </Link>
    );
}
