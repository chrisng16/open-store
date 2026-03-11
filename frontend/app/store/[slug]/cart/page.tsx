"use client";

import { ProductDialog } from "@/components/store/product-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartPricing } from "@/lib/cart-pricing";
import { useCartMutations, useCartSummary, type CartItem as CartItemType } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { Edit3, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function CartPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const store = useStore();
    const { items } = useCartSummary();
    const { removeItem, updateQuantity, updateItem } = useCartMutations();
    const { pricedItems, subtotal, tax, total, isLoading, error } = useCartPricing({
        storeId: store.id,
        items,
    });
    const [editItem, setEditItem] = useState<CartItemType | null>(null);

    const handleEdit = (item: CartItemType) => {
        setEditItem(item);
    };

    if (items.length === 0) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center rounded-4xl min-h-[75dvh] border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight">Your cart is empty</h2>
                        <p className="mt-3 text-base text-muted-foreground">
                            Add some items from the menu to get started.
                        </p>
                        <Link href={`/store/${slug}`}>
                            <Button className="mt-6 rounded-full px-6">Browse menu</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Edit dialog loads fresh product data by id */}
            {editItem && (
                <ProductDialog
                    productId={editItem.product_id}
                    storeId={store.id}
                    preview={{
                        name: editItem.product_name,
                        image_url: editItem.image_url ?? null,
                    }}
                    cartItem={editItem}
                    onSaveEdit={(id, selections, qty, product) => {
                        const options = Object.entries(selections).flatMap(([listId, optionMap]) =>
                            Object.entries(optionMap).flatMap(([optionId, selectedCount]) => {
                                if (selectedCount <= 0) return [];
                                const current = product.option_lists
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
                        setEditItem(null);
                    }}
                    onClose={() => {
                        setEditItem(null);
                    }}
                />
            )}
            <div className="mb-6 rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Cart review</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your cart</h2>
                <p className="mt-2 text-sm text-muted-foreground">Review items, make edits, and move directly to secure checkout.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="space-y-3">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-24 w-full rounded-[1.75rem]" />
                            <Skeleton className="h-24 w-full rounded-[1.75rem]" />
                        </>
                    ) : (
                        pricedItems.map((item) => (
                            <CartItemRow
                                key={item.id}
                                item={item}
                                onRemove={() => removeItem(item.id)}
                                onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                                onEdit={() => handleEdit(item)}
                            />
                        ))
                    )}
                </div>

                <div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm lg:sticky lg:top-28">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Summary</p>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            {isLoading ? <Skeleton className="h-4 w-16" /> : <span>${(subtotal / 100).toFixed(2)}</span>}
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Tax (8%)</span>
                            {isLoading ? <Skeleton className="h-4 w-12" /> : <span>${(tax / 100).toFixed(2)}</span>}
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Pickup fee</span>
                            <span>$0.00</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-semibold">
                            <span>Total</span>
                            {isLoading ? <Skeleton className="h-5 w-20" /> : <span>${(total / 100).toFixed(2)}</span>}
                        </div>
                    </div>

                    {error && (
                        <p className="mt-3 text-sm text-destructive">{error}</p>
                    )}

                    <div className="mt-5 space-y-2">
                        <Button className="w-full rounded-full">
                            <Link href={`/store/${slug}/checkout`}>
                                Checkout
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full rounded-full">
                            <Link href={`/store/${slug}`}>
                                Continue shopping
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div >
    );
}

function CartItemRow({
    item,
    onRemove,
    onUpdateQuantity,
    onEdit,
}: {
    item: {
        id: string;
        product_name: string;
        quantity: number;
        options: { option_name: string }[];
        line_total: number;
    };
    onRemove: () => void;
    onUpdateQuantity: (qty: number) => void;
    onEdit: () => void;
}) {
    return (
        <Card className="rounded-[1.75rem] border-border/70">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <h3 className="font-semibold tracking-tight">{item.product_name}</h3>
                    {item.options.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {item.options.map((option) => option.option_name).join(", ")}
                        </p>
                    )}
                    <p className="mt-2 text-sm font-semibold">${(item.line_total / 100).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => onUpdateQuantity(item.quantity - 1)}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => onUpdateQuantity(item.quantity + 1)}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-destructive"
                        onClick={onRemove}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={onEdit}
                    >
                        <Edit3 className="h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
