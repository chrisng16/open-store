"use client";

import { ProductDialog, type ProductDialogProduct } from "@/components/store/product-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useCartStore, type CartItem as CartItemType, type CartOption } from "@/lib/cart-store";
import { Edit3, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function product_option_lists_from_item(item: CartItemType) {
    type SimpleOption = {
        id: string;
        name: string;
        unit_amount: number;
        min_option_choice_quantity: number;
        max_option_choice_quantity: number;
        default_quantity: number;
    };
    const map: Record<string, { id: string; name: string; options: SimpleOption[] }> = {};
    for (const option of item.options as CartOption[]) {
        const listId = option.option_list_id ?? "default";
        map[listId] = map[listId] ?? { id: listId, name: listId === "default" ? "Options" : listId, options: [] };
        if (!map[listId].options.find((entry) => entry.id === option.option_id)) {
            map[listId].options.push({
                id: option.option_id,
                name: option.option_name,
                unit_amount: option.unit_amount,
                min_option_choice_quantity: 0,
                max_option_choice_quantity: 1,
                default_quantity: 0,
            });
        }
    }
    return Object.values(map).map((entry) => ({
        id: entry.id,
        name: entry.name,
        selection_node: "multi_select" as const,
        min_num_options: 0,
        max_num_options: entry.options.length,
        min_aggregate_options_quantity: 0,
        max_aggregate_options_quantity: 0,
        is_optional: true,
        options: entry.options,
    }));
}

export default function CartPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const items = useCartStore((s) => s.items);
    const removeItem = useCartStore((s) => s.removeItem);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const updateItem = useCartStore((s) => s.updateItem);
    const getSubtotal = useCartStore((s) => s.getSubtotal);

    const subtotal = getSubtotal();
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + tax;
    const [editItem, setEditItem] = useState<CartItemType | null>(null);
    const [editProduct, setEditProduct] = useState<ProductDialogProduct | null>(null);

    const handleEdit = async (item: CartItemType) => {
        setEditItem(item);
        setEditProduct(null);
        try {
            const store = (await api.stores.getBySlug(slug)) as { id?: string };
            if (!store?.id) {
                console.warn("store not found for slug", slug);
                return;
            }
            try {
                const product = await api.products.get(store.id, item.product_id);
                setEditProduct(product as ProductDialogProduct);
            } catch (err) {
                console.warn("failed to fetch product for edit", err);
                // keep editProduct null so fallback works
            }
        } catch (err) {
            console.warn("failed to fetch store for edit", err);
        }
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
            {/* Edit dialog (supports fallback when product_modifier_groups are missing) */}
            {editItem && (
                <ProductDialog
                    product={
                        editProduct ?? {
                            id: editItem.product_id,
                            name: editItem.product_name,
                            description: null,
                            unit_amount: editItem.unit_amount,
                            image_url: editItem.image_url ?? null,
                            option_lists: editItem.product_option_lists ?? [],
                        }
                    }
                    cartItem={editItem}
                    onSaveEdit={(id, selections, qty) => {
                        // convert selections back to options array
                        type List = {
                            id: string;
                            options: { id: string; name: string; unit_amount: number }[];
                        };
                        const optionLists: List[] = (editProduct?.option_lists ?? editItem.product_option_lists ?? product_option_lists_from_item(editItem)) as List[];
                        const options = optionLists.flatMap((list) =>
                            list.options.flatMap((option) => {
                                const selectedCount = selections[list.id]?.[option.id] ?? 0;
                                if (selectedCount <= 0) return [];

                                return Array.from({ length: selectedCount }, () => ({
                                    option_id: option.id,
                                    option_name: option.name,
                                    unit_amount: Number(option.unit_amount),
                                    quantity: 1,
                                    option_list_id: list.id,
                                }));
                            })
                        );

                        updateItem(id, { quantity: qty, options });
                        setEditItem(null);
                        setEditProduct(null);
                    }}
                    onClose={() => {
                        setEditItem(null);
                        setEditProduct(null);
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
                    {items.map((item) => (
                        <CartItemRow
                            key={item.id}
                            item={item}
                            onRemove={() => removeItem(item.id)}
                            onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                            onEdit={() => handleEdit(item)}
                        />
                    ))}
                </div>

                <div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm lg:sticky lg:top-28">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Summary</p>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>${(subtotal / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Tax (8%)</span>
                            <span>${(tax / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Pickup fee</span>
                            <span>$0.00</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-semibold">
                            <span>Total</span>
                            <span>${(total / 100).toFixed(2)}</span>
                        </div>
                    </div>

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
    item: CartItemType;
    onRemove: () => void;
    onUpdateQuantity: (qty: number) => void;
    onEdit: () => void;
}) {
    const optionsTotal = item.options.reduce(
        (sum, option) => sum + option.unit_amount * option.quantity,
        0
    );
    const lineTotal = (item.unit_amount + optionsTotal) * item.quantity;

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
                    <p className="mt-2 text-sm font-semibold">${(lineTotal / 100).toFixed(2)}</p>
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
