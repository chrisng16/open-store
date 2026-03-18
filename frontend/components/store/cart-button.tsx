"use client";

import { ProductDialog } from "@/components/store/product-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartPricing } from "@/lib/cart-pricing";
import { type CartItem, useCartHydrated, useCartMutations, useCartSummary } from "@/lib/cart-store";
import { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCartProductDialogState } from "@/stores/ui-store";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

function formatCents(value: number): string {
    return `$${(value / 100).toFixed(2)}`;
}

export function CartButton({
    slug,
    storeId,
    ...props
}: { slug: string; storeId: string } & React.ComponentProps<typeof Button>) {
    const isHydrated = useCartHydrated();
    const { items, itemCount } = useCartSummary();
    const { updateQuantity, removeItem, updateItem } = useCartMutations();

    const safeItemCount = isHydrated ? itemCount : 0;
    const safeItems = isHydrated ? items : [];
    const safeItemsById = useMemo(
        () => new Map(safeItems.map((item) => [item.id, item])),
        [safeItems]
    );
    const cartProductDialog = useCartProductDialogState();
    const editingItem: CartItem | null =
        (cartProductDialog.itemId
            ? safeItemsById.get(cartProductDialog.itemId) ?? null
            : null) ?? null;

    const { pricedItems, subtotal, tax, total, isLoading } = useCartPricing({
        storeId,
        items: safeItems,
    });

    return (
        <>
            <ProductDialog
                open={cartProductDialog.isOpen && !!editingItem}
                productId={editingItem?.product_id ?? ""}
                storeId={storeId}
                preview={{
                    name: editingItem?.product_name,
                    imageUrl: editingItem?.image_url ?? null,
                }}
                cartItem={editingItem ?? undefined}
                onSaveEdit={(id, selections, qty, product: Product) => {
                    const options = Object.entries(selections).flatMap(([listId, optionMap]) =>
                        Object.entries(optionMap).flatMap(([optionId, selectedCount]) => {
                            if (selectedCount <= 0) return [];
                            const current = product.optionLists
                                .find((list) => list.id === listId)
                                ?.options.find((opt) => opt.id === optionId);
                            return [{
                                option_id: optionId,
                                option_name: current?.name,
                                quantity: selectedCount,
                                option_list_id: listId,
                            }];
                        })
                    );

                    updateItem(id, { quantity: qty, options });
                    cartProductDialog.close();
                }}
                onClose={cartProductDialog.close}
            />

            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn("relative w-16 rounded-full px-6", props.className)}
                        {...props}
                    >
                        <ShoppingCart className="size-4.5" />
                        <span className="text-sm font-semibold tabular-nums">{safeItemCount}</span>
                    </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-full sm:max-w-lg gap-0">
                    <SheetHeader className="border-b">
                        <SheetTitle>Cart</SheetTitle>
                        <SheetDescription>
                            Review items before heading to checkout.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto">
                        {safeItems.length === 0 ? (
                            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-xl border border-dashed text-center px-4 pb-4">
                                <p className="font-medium">Your cart is empty</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Add something from the menu to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pricedItems.map((item) => {
                                    return (
                                        <div key={item.id} className="border-b p-3 cursor-pointer hover:bg-background-elevated-2/70 transition-colors" onClick={() => {
                                            const existing = safeItemsById.get(item.id);
                                            if (existing) cartProductDialog.open(existing.id);
                                        }}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold">{item.product_name}</p>
                                                    {item.options.length > 0 && (
                                                        <p className="line-clamp-2 text-xs text-muted-foreground">
                                                            {item.options.map((option) => option.option_name).join(", ")}
                                                        </p>
                                                    )}
                                                    {item.isPricingLoading ? (
                                                        <Skeleton className="mt-1 h-4 w-24" />
                                                    ) : (
                                                        <p className="mt-1 text-sm font-medium">{formatCents(item.line_total)}</p>
                                                    )}
                                                </div>

                                                <div className="mt-3 inline-flex items-center gap-1 rounded-full border px-1 py-1 shadow-2xl bg-background-elevated-2 transition-colors">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateQuantity(item.id, item.quantity - 1);
                                                        }}
                                                    >
                                                        {item.quantity === 1 ? <Trash2 className="text-destructive" /> : <Minus />}
                                                    </Button>
                                                    <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateQuantity(item.id, item.quantity + 1);
                                                        }}
                                                    >
                                                        <Plus />
                                                    </Button>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <SheetFooter className="border-t pt-0">
                        <div className="space-y-2 px-0 pb-0 pt-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                {isLoading ? <Skeleton className="h-4 w-16" /> : <span>{formatCents(subtotal)}</span>}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Tax (8%)</span>
                                {isLoading ? <Skeleton className="h-4 w-12" /> : <span>{formatCents(tax)}</span>}
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between text-base font-semibold">
                                <span>Total</span>
                                {isLoading ? <Skeleton className="h-5 w-20" /> : <span>{formatCents(total)}</span>}
                            </div>
                            <p className="pt-1 text-xs text-muted-foreground">
                                Subtotal and tax are estimated values. Final amounts are recalculated during checkout.
                            </p>
                        </div>
                        <SheetClose asChild>
                            <Button asChild className="w-full rounded-full" disabled={safeItems.length === 0}>
                                <Link href={`/store/${slug}/checkout`}>Checkout</Link>
                            </Button>
                        </SheetClose>

                        <SheetClose asChild>
                            <Button variant="outline" className="w-full rounded-full">
                                Continue shopping
                            </Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
}
