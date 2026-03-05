"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/cart-store";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Modifier = {
    id: string;
    name: string;
    price_adjustment: number;
    is_default: boolean;
};

type ModifierGroup = {
    id: string;
    name: string;
    min_selections: number;
    max_selections: number;
    is_required: boolean;
    modifiers: Modifier[];
};

type Product = {
    id: string;
    store_id: string;
    name: string;
    description: string | null;
    base_price: number;
    image_url: string | null;
    dietary_tags: string[] | null;
    allergens: string[] | null;
    ingredients: string | null;
    modifier_groups: ModifierGroup[];
};

export function ProductDetail({
    product,
    slug,
}: {
    product: Product;
    slug: string;
}) {
    const router = useRouter();
    const addItem = useCartStore((s) => s.addItem);
    const setStoreSlug = useCartStore((s) => s.setStoreSlug);
    const [quantity, setQuantity] = useState(1);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [invalidGroups, setInvalidGroups] = useState<Set<string>>(new Set());
    const [selectedModifiers, setSelectedModifiers] = useState<
        Record<string, string[]>
    >(() => {
        // Pre-select defaults
        const defaults: Record<string, string[]> = {};
        product.modifier_groups.forEach((mg) => {
            const defaultMods = mg.modifiers
                .filter((m) => m.is_default)
                .map((m) => m.id);
            if (defaultMods.length > 0) defaults[mg.id] = defaultMods;
        });
        return defaults;
    });

    function toggleModifier(groupId: string, modId: string, maxSelections: number) {
        setSelectedModifiers((prev) => {
            const current = prev[groupId] || [];
            if (current.includes(modId)) {
                return { ...prev, [groupId]: current.filter((id) => id !== modId) };
            }
            if (maxSelections === 1) {
                return { ...prev, [groupId]: [modId] };
            }
            if (current.length >= maxSelections) return prev;
            return { ...prev, [groupId]: [...current, modId] };
        });

        if (invalidGroups.has(groupId)) {
            setInvalidGroups((prev) => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
        }

        if (validationError) {
            setValidationError(null);
        }
    }

    function getInvalidModifierGroups() {
        return product.modifier_groups
            .filter((group) => {
                const selectedCount = (selectedModifiers[group.id] || []).length;
                if (group.is_required && selectedCount === 0) return true;
                if (group.min_selections > 0 && selectedCount < group.min_selections) return true;
                return false;
            })
            .map((group) => group.id);
    }

    function calculateTotal() {
        let total = Number(product.base_price);
        Object.entries(selectedModifiers).forEach(([groupId, modIds]) => {
            const group = product.modifier_groups.find((mg) => mg.id === groupId);
            if (!group) return;
            modIds.forEach((modId) => {
                const mod = group.modifiers.find((m) => m.id === modId);
                if (mod) total += Number(mod.price_adjustment);
            });
        });
        return total * quantity;
    }

    function handleAddToCart() {
        const invalidGroupIds = getInvalidModifierGroups();
        if (invalidGroupIds.length > 0) {
            setInvalidGroups(new Set(invalidGroupIds));
            setValidationError("Please complete required selections before adding this item.");
            return;
        }

        setStoreSlug(slug);
        const modifiers = Object.entries(selectedModifiers).flatMap(
            ([groupId, modIds]) => {
                const group = product.modifier_groups.find((mg) => mg.id === groupId);
                if (!group) return [];
                return modIds
                    .map((modId) => {
                        const mod = group.modifiers.find((m) => m.id === modId);
                        if (!mod) return null;
                        return {
                            modifier_id: mod.id,
                            modifier_name: mod.name,
                            price_adjustment: Number(mod.price_adjustment),
                        };
                    })
                    .filter(Boolean) as {
                        modifier_id: string;
                        modifier_name: string;
                        price_adjustment: number;
                    }[];
            }
        );

        addItem({
            product_id: product.id,
            product_name: product.name,
            unit_price: Number(product.base_price),
            quantity,
            modifiers,
            image_url: product.image_url,
        });

        setValidationError(null);
        setInvalidGroups(new Set());
        router.push(`/store/${slug}/menu`);
    }

    return (
        <div className="container mx-auto max-w-2xl px-4 py-6">
            {product.image_url && (
                <div className="mb-6 aspect-video overflow-hidden rounded-lg">
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                    />
                </div>
            )}

            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-xl font-semibold">
                ${Number(product.base_price).toFixed(2)}
            </p>

            {product.description && (
                <p className="mt-3 text-muted-foreground">{product.description}</p>
            )}

            {product.dietary_tags && product.dietary_tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                    {product.dietary_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                            {tag}
                        </Badge>
                    ))}
                </div>
            )}

            {product.allergens && product.allergens.length > 0 && (
                <div className="mt-2">
                    <p className="text-sm font-medium text-destructive">
                        Contains: {product.allergens.join(", ")}
                    </p>
                </div>
            )}

            {product.ingredients && (
                <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Ingredients:</span> {product.ingredients}
                </p>
            )}

            {/* Modifier groups */}
            {product.modifier_groups.map((group) => (
                <div key={group.id} className="mt-6">
                    <div className="flex items-center gap-2">
                        <Label className="text-base font-semibold">{group.name}</Label>
                        {group.is_required && (
                            <Badge variant="destructive" className="text-xs">
                                Required
                            </Badge>
                        )}
                        {group.max_selections > 1 && (
                            <span className="text-sm text-muted-foreground">
                                (Select up to {group.max_selections})
                            </span>
                        )}
                        {group.min_selections > 0 && (
                            <span className="text-sm text-muted-foreground">
                                (Min {group.min_selections})
                            </span>
                        )}
                    </div>
                    <div
                        className={`mt-2 space-y-2 rounded-lg ${invalidGroups.has(group.id) ? "border border-destructive/40 p-2" : ""}`}
                    >
                        {group.modifiers.map((mod) => {
                            const isSelected = (
                                selectedModifiers[group.id] || []
                            ).includes(mod.id);
                            return (
                                <button
                                    key={mod.id}
                                    onClick={() =>
                                        toggleModifier(group.id, mod.id, group.max_selections)
                                    }
                                    className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors ${isSelected
                                        ? "border-primary bg-primary/5"
                                        : "hover:bg-muted/50"
                                        }`}
                                >
                                    <span>{mod.name}</span>
                                    {Number(mod.price_adjustment) !== 0 && (
                                        <span className="text-sm text-muted-foreground">
                                            +${Number(mod.price_adjustment).toFixed(2)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {invalidGroups.has(group.id) && (
                        <p className="mt-2 text-sm text-destructive">
                            Please select at least {Math.max(group.min_selections, 1)} option
                            {Math.max(group.min_selections, 1) > 1 ? "s" : ""}.
                        </p>
                    )}
                </div>
            ))}

            {validationError && (
                <p className="mt-4 text-sm text-destructive">{validationError}</p>
            )}

            {/* Quantity + Add to Cart */}
            <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-lg border p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{quantity}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setQuantity(quantity + 1)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <Button className="flex-1" size="lg" onClick={handleAddToCart}>
                    Add to Cart — ${calculateTotal().toFixed(2)}
                </Button>
            </div>
        </div>
    );
}
