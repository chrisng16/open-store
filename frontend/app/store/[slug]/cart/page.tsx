"use client";

import { ProductDialog, type ProductDialogProduct } from "@/components/store/product-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useCartStore, type CartItem as CartItemType, type CartModifier } from "@/lib/cart-store";
import { Edit3, Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function product_modifier_groups_from_item(item: CartItemType) {
    type SimpleMod = { id: string; name: string; price_adjustment: number };
    const map: Record<string, { id: string; name: string; modifiers: SimpleMod[] }> = {};
    for (const m of item.modifiers as CartModifier[]) {
        const gid = m.group_id ?? "default";
        map[gid] = map[gid] ?? { id: gid, name: gid === "default" ? "Options" : gid, modifiers: [] };
        if (!map[gid].modifiers.find((mm) => mm.id === m.modifier_id)) {
            map[gid].modifiers.push({ id: m.modifier_id, name: m.modifier_name, price_adjustment: m.price_adjustment });
        }
    }
    return Object.values(map).map((g) => ({ id: g.id, name: g.name, min_selections: 0, max_selections: undefined, modifiers: g.modifiers }));
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
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    const [editItem, setEditItem] = useState<CartItemType | null>(null);
    const [editProduct, setEditProduct] = useState<ProductDialogProduct | null>(null);

    const handleEdit = async (item: CartItemType) => {
        setEditItem(item);
        setEditProduct(null);
        try {
            const store = await api.stores.getBySlug(slug);
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
            <div className="container mx-auto px-4 py-16 text-center">
                <h2 className="text-2xl font-bold">Your cart is empty</h2>
                <p className="mt-2 text-muted-foreground">
                    Add some items from the menu to get started
                </p>
                <Link href={`/store/${slug}/menu`}>
                    <Button className="mt-4">Browse Menu</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-2xl px-4 py-6">
            {/* Edit dialog (supports fallback when product_modifier_groups are missing) */}
            {editItem && (
                <ProductDialog
                    product={
                        editProduct ?? {
                            id: editItem.product_id,
                            name: editItem.product_name,
                            description: null,
                            base_price: editItem.unit_price,
                            image_url: editItem.image_url ?? null,
                            modifier_groups: editItem.product_modifier_groups ?? [],
                        }
                    }
                    cartItem={editItem}
                    onSaveEdit={(id, selections, qty) => {
                        // convert selections back to modifiers array
                        type Group = { id: string; name?: string; min_selections?: number; max_selections?: number; modifiers: { id: string; name: string; price_adjustment: number }[] };
                        const groups: Group[] = (editProduct?.modifier_groups ?? editItem.product_modifier_groups ?? product_modifier_groups_from_item(editItem)) as Group[];
                        const modifiers = groups.flatMap((group) =>
                            group.modifiers.flatMap((mod) => {
                                const selectedCount = selections[group.id]?.[mod.id] ?? 0;
                                if (selectedCount <= 0) return [];

                                return Array.from({ length: selectedCount }, () => ({
                                    modifier_id: mod.id,
                                    modifier_name: mod.name,
                                    price_adjustment: Number(mod.price_adjustment),
                                    group_id: group.id,
                                }));
                            })
                        );

                        updateItem(id, { quantity: qty, modifiers });
                        setEditItem(null);
                        setEditProduct(null);
                    }}
                    onClose={() => {
                        setEditItem(null);
                        setEditProduct(null);
                    }}
                />
            )}
            <div className="mb-4 rounded-2xl border bg-card p-4">
                <h2 className="text-2xl font-bold tracking-tight">Your Cart</h2>
                <p className="text-sm text-muted-foreground">
                    Pickup order • Review items before secure checkout
                </p>
            </div>

            <div className="mt-4 space-y-3">
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

            <Separator className="my-6" />

            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Tax (8%)</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Pickup fee</span>
                    <span>$0.00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                </div>
            </div>

            <div className="mt-6 flex gap-3">
                <Link href={`/store/${slug}/menu`} className="flex-1">
                    <Button variant="outline" className="w-full">
                        Continue Shopping
                    </Button>
                </Link>
                <Link href={`/store/${slug}/checkout`} className="flex-1">
                    <Button className="w-full">Checkout</Button>
                </Link>
            </div>
        </div>
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
    const modTotal = item.modifiers.reduce(
        (sum, m) => sum + m.price_adjustment,
        0
    );
    const lineTotal = (item.unit_price + modTotal) * item.quantity;

    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1">
                    <h3 className="font-semibold">{item.product_name}</h3>
                    {item.modifiers.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {item.modifiers.map((m) => m.modifier_name).join(", ")}
                        </p>
                    )}
                    <p className="mt-1 text-sm font-medium">${lineTotal.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.quantity - 1)}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onUpdateQuantity(item.quantity + 1)}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={onRemove}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onEdit}
                    >
                        <Edit3 className="h-3 w-3" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
