"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/cart-store";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Option = {
    id: string;
    name: string;
    unit_amount: number;
};

type OptionList = {
    id: string;
    name: string;
    selection_node: "single_select" | "multi_select" | "aggregate_quantity";
    min_num_options: number;
    max_num_options: number;
    is_optional: boolean;
    options: Option[];
};

type Product = {
    id: string;
    store_id: string;
    name: string;
    description: string | null;
    unit_amount: number;
    image_url: string | null;
    dietary_tags: string[] | null;
    allergens: string[] | null;
    ingredients: string | null;
    option_lists: OptionList[];
};

export function ProductDetail({ product, slug }: { product: Product; slug: string }) {
    const router = useRouter();
    const addItem = useCartStore((s) => s.addItem);
    const setStoreSlug = useCartStore((s) => s.setStoreSlug);
    const [quantity, setQuantity] = useState(1);
    const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});

    const total = useMemo(() => {
        let extras = 0;
        for (const list of product.option_lists) {
            for (const option of list.options) {
                extras += (selections[list.id]?.[option.id] ?? 0) * option.unit_amount;
            }
        }
        return (product.unit_amount + extras) * quantity;
    }, [product, quantity, selections]);

    function toggleOption(list: OptionList, option: Option) {
        setSelections((prev) => {
            const nextList = { ...(prev[list.id] ?? {}) };
            if (list.selection_node === "single_select") {
                for (const key of Object.keys(nextList)) nextList[key] = 0;
                nextList[option.id] = 1;
            } else {
                const current = nextList[option.id] ?? 0;
                nextList[option.id] = current > 0 ? 0 : 1;
            }
            return { ...prev, [list.id]: nextList };
        });
    }

    function handleAddToCart() {
        const options = product.option_lists.flatMap((list) =>
            list.options.flatMap((option) => {
                const selectedCount = selections[list.id]?.[option.id] ?? 0;
                if (selectedCount <= 0) return [];
                return Array.from({ length: selectedCount }, () => ({
                    option_id: option.id,
                    option_name: option.name,
                    unit_amount: option.unit_amount,
                    quantity: 1,
                    option_list_id: list.id,
                }));
            })
        );

        setStoreSlug(slug);
        addItem({
            product_id: product.id,
            product_name: product.name,
            unit_amount: product.unit_amount,
            quantity,
            options,
            image_url: product.image_url,
            product_option_lists: product.option_lists,
        });

        router.push(`/store/${slug}/menu`);
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
                <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
                    {product.image_url && (
                        <div className="aspect-video overflow-hidden border-b border-border/70">
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                    )}

                    <div className="space-y-5 p-6 sm:p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Item detail</p>
                            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{product.name}</h1>
                            <p className="text-xl font-semibold">${(product.unit_amount / 100).toFixed(2)}</p>
                            {product.description && <p className="max-w-2xl text-base leading-7 text-muted-foreground">{product.description}</p>}
                        </div>

                        {product.dietary_tags && product.dietary_tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {product.dietary_tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {(product.ingredients || product.allergens?.length) && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {product.ingredients && (
                                    <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ingredients</Label>
                                        <p className="mt-2 text-sm leading-6 text-foreground">{product.ingredients}</p>
                                    </div>
                                )}
                                {product.allergens?.length ? (
                                    <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                                        <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Allergens</Label>
                                        <p className="mt-2 text-sm leading-6 text-foreground">{product.allergens.join(", ")}</p>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm lg:sticky lg:top-28">
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Customize order</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Select options, adjust quantity, and add this item directly to your cart.</p>
                        </div>

                        {product.option_lists.map((list) => (
                            <div key={list.id} className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background p-4">
                                <div className="flex items-center gap-2">
                                    <Label className="text-base font-semibold">{list.name}</Label>
                                    {!list.is_optional && <Badge variant="destructive" className="rounded-full text-xs">Required</Badge>}
                                </div>
                                <div className="space-y-2">
                                    {list.options.map((option) => {
                                        const selected = (selections[list.id]?.[option.id] ?? 0) > 0;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => toggleOption(list, option)}
                                                className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-muted/40"}`}
                                            >
                                                <span className="font-medium">{option.name}</span>
                                                {option.unit_amount !== 0 && (
                                                    <span className="text-sm text-muted-foreground">+${(option.unit_amount / 100).toFixed(2)}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center gap-4 border-t border-border/70 pt-2">
                            <div className="flex items-center gap-2 rounded-full border border-border/70 p-1">
                                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-medium">{quantity}</span>
                                <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setQuantity(quantity + 1)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button className="flex-1 rounded-full" size="lg" onClick={handleAddToCart}>
                                Add to cart · ${(total / 100).toFixed(2)}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
