"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import type { CartItem, CartModifier } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Modifier = {
    id: string;
    name: string;
    price_adjustment: number;
};

export type ModifierGroup = {
    id: string;
    name: string;
    min_selections: number; // undefined / 0 = optional
    max_selections: number; // undefined = unlimited; 1 = radio
    modifiers: Modifier[];
};

export type ProductDialogProduct = {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    image_url: string | null;
    modifier_groups: ModifierGroup[];
};

// ─── Selection helpers ────────────────────────────────────────────────────────

type Selections = Record<string, Record<string, number>>;

function groupTotal(sel: Selections, groupId: string) {
    return Object.values(sel[groupId] ?? {}).reduce((s, n) => s + n, 0);
}

function isGroupSatisfied(group: ModifierGroup, sel: Selections) {
    return groupTotal(sel, group.id) >= (group.min_selections ?? 0);
}

function totalPrice(product: ProductDialogProduct, sel: Selections, qty: number) {
    let extra = 0;
    for (const group of product.modifier_groups) {
        for (const mod of group.modifiers) {
            extra += (sel[group.id]?.[mod.id] ?? 0) * mod.price_adjustment;
        }
    }
    return (product.base_price + extra) * qty;
}

// ─── Quantity stepper ─────────────────────────────────────────────────────────

function Stepper({
    value,
    onDecrement,
    onIncrement,
    canDecrement,
    canIncrement,
}: {
    value: number;
    onDecrement: () => void;
    onIncrement: () => void;
    canDecrement: boolean;
    canIncrement: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!canDecrement}
                onClick={onDecrement}
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-5 text-center text-sm font-medium tabular-nums">{value}</span>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!canIncrement}
                onClick={onIncrement}
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

// ─── Modifier group section ───────────────────────────────────────────────────

function ModifierGroupSection({
    group,
    selections,
    onChange,
}: {
    group: ModifierGroup;
    selections: Selections;
    onChange: (groupId: string, modId: string, delta: number) => void;
}) {
    const isOptional = (group.min_selections ?? 0) === 0;
    const isRadio = group.max_selections === 1;
    const atMax = group.max_selections !== undefined && groupTotal(selections, group.id) >= group.max_selections;
    const satisfied = isGroupSatisfied(group, selections);

    return (
        <div className="mt-6">
            {/* Group header */}
            <div className="mb-3">
                <h3 className="text-base font-bold">{group.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    {isOptional ? (
                        <>
                            <span>Optional</span>
                            {group.max_selections ? ` · Select up to ${group.max_selections}` : ""}
                        </>
                    ) : (
                        <>
                            <span className={cn("font-medium", satisfied ? "text-green-600" : "text-amber-500")}>
                                Required
                            </span>
                            {` · Select ${group.min_selections === group.max_selections ? `exactly ${group.min_selections}` : `at least ${group.min_selections}`}`}
                            {group.max_selections && group.max_selections !== group.min_selections ? ` (up to ${group.max_selections})` : ""}
                        </>
                    )}
                </p>
            </div>

            {/* Radio group (max === 1) */}
            {isRadio ? (
                <RadioGroup
                    value={Object.entries(selections[group.id] ?? {}).find(([, v]) => v > 0)?.[0] ?? ""}
                    onValueChange={(modId) => {
                        // Deselect previous, select new
                        const prev = Object.entries(selections[group.id] ?? {}).find(([, v]) => v > 0)?.[0];
                        if (prev && prev !== modId) onChange(group.id, prev, -1);
                        onChange(group.id, modId, 1);
                    }}
                    className="divide-y rounded-xl border"
                >
                    {group.modifiers.map((mod) => (
                        <div key={mod.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                            <Label htmlFor={`radio-${mod.id}`} className="flex-1 cursor-pointer">
                                <span className="text-sm font-medium">{mod.name}</span>
                                {mod.price_adjustment !== 0 && (
                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                        {mod.price_adjustment > 0 ? "+" : ""}${Number(mod.price_adjustment).toFixed(2)}
                                    </span>
                                )}
                            </Label>
                            <RadioGroupItem value={mod.id} id={`radio-${mod.id}`} />
                        </div>
                    ))}
                </RadioGroup>
            ) : isOptional ? (
                // Checkbox group (optional multi-select)
                <div className="divide-y rounded-xl border">
                    {group.modifiers.map((mod) => {
                        const checked = (selections[group.id]?.[mod.id] ?? 0) > 0;
                        return (
                            <div key={mod.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                                <Label htmlFor={`check-${mod.id}`} className="flex-1 cursor-pointer">
                                    <span className="text-sm font-medium">{mod.name}</span>
                                    {mod.price_adjustment !== 0 && (
                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                            {mod.price_adjustment > 0 ? "+" : ""}${Number(mod.price_adjustment).toFixed(2)}
                                        </span>
                                    )}
                                </Label>
                                <Checkbox
                                    id={`check-${mod.id}`}
                                    checked={checked}
                                    disabled={!checked && atMax}
                                    onCheckedChange={(v) => onChange(group.id, mod.id, v ? 1 : -1)}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Stepper group (required, allows multiples — e.g. DoorDash Step 1/2)
                <div className="divide-y rounded-xl border">
                    {group.modifiers.map((mod) => {
                        const qty = selections[group.id]?.[mod.id] ?? 0;
                        return (
                            <div key={mod.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{mod.name}</p>
                                    {mod.price_adjustment !== 0 && (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {mod.price_adjustment > 0 ? "+" : ""}${Number(mod.price_adjustment).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                                <Stepper
                                    value={qty}
                                    onDecrement={() => onChange(group.id, mod.id, -1)}
                                    onIncrement={() => onChange(group.id, mod.id, 1)}
                                    canDecrement={qty > 0}
                                    canIncrement={!atMax}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function ProductDialog({
    product,
    onClose,
    onAddToCart,
    // optional: editing existing cart item
    cartItem,
    onSaveEdit,
    initialQty,
    initialSelections,
}: {
    product: ProductDialogProduct;
    onClose: () => void;
    onAddToCart?: (product: ProductDialogProduct, selections: Selections, qty: number) => void;
    cartItem?: CartItem;
    onSaveEdit?: (id: string, selections: Selections, qty: number) => void;
    initialQty?: number;
    initialSelections?: Selections;
}) {
    const derivedInitialQty = initialQty ?? cartItem?.quantity ?? 1;
    const derivedInitialSelections: Selections = useMemo(() => {
        if (initialSelections) return initialSelections;
        if (!cartItem) return {};
        const out: Selections = {};
        for (const m of cartItem.modifiers as CartModifier[]) {
            const gid = m.group_id ?? "default";
            out[gid] = out[gid] ?? {};
            out[gid][m.modifier_id] = (out[gid][m.modifier_id] ?? 0) + 1;
        }
        return out;
    }, [initialSelections, cartItem]);

    const [qty, setQty] = useState<number>(derivedInitialQty);
    const [selections, setSelections] = useState<Selections>(derivedInitialSelections);

    const handleModifierChange = useCallback(
        (groupId: string, modId: string, delta: number) => {
            setSelections((prev) => {
                const group = product.modifier_groups.find((g) => g.id === groupId)!;
                const isRadio = group.max_selections === 1;
                const groupSel = { ...(prev[groupId] ?? {}) };

                if (isRadio && delta > 0) {
                    for (const key of Object.keys(groupSel)) groupSel[key] = 0;
                }

                groupSel[modId] = Math.max(0, (groupSel[modId] ?? 0) + delta);
                return { ...prev, [groupId]: groupSel };
            });
        },
        [product.modifier_groups],
    );

    const allSatisfied = useMemo(
        () => product.modifier_groups.every((g) => isGroupSatisfied(g, selections)),
        [product.modifier_groups, selections],
    );

    const price = useMemo(() => totalPrice(product, selections, qty), [product, selections, qty]);

    const unsatisfiedCount = useMemo(
        () => product.modifier_groups.filter((g) => !isGroupSatisfied(g, selections)).length,
        [product.modifier_groups, selections],
    );

    const handleAdd = () => {
        if (!allSatisfied) return;
        if (onSaveEdit && cartItem) {
            onSaveEdit(cartItem.id, selections, qty);
            onClose();
            return;
        }
        onAddToCart?.(product, selections, qty);
        onClose();
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    {product.image_url && (
                        <div className="aspect-4/3 w-full overflow-hidden">
                            <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    )}

                    <div className="px-5 pb-4 pt-5">
                        <DialogHeader className="mb-1 text-left">
                            <DialogTitle className="text-2xl font-bold tracking-tight">
                                {product.name}
                            </DialogTitle>
                        </DialogHeader>

                        {product.description && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {product.description}
                            </p>
                        )}

                        {product.modifier_groups.map((group) => (
                            <ModifierGroupSection
                                key={group.id}
                                group={group}
                                selections={selections}
                                onChange={handleModifierChange}
                            />
                        ))}

                        <div className="h-4" />
                    </div>
                </div>

                {/* Sticky footer */}
                <Separator />
                <div className="bg-background px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Stepper
                            value={qty}
                            onDecrement={() => setQty((q) => Math.max(1, q - 1))}
                            onIncrement={() => setQty((q) => q + 1)}
                            canDecrement={qty > 1}
                            canIncrement={true}
                        />
                        <Button
                            className={cn(
                                "flex-1 rounded-full font-bold",
                                allSatisfied ? "bg-red-500 hover:bg-red-600" : "bg-red-300",
                            )}
                            disabled={!allSatisfied}
                            onClick={handleAdd}
                        >
                            {allSatisfied
                                ? `Add to cart · $${price.toFixed(2)}`
                                : `Make ${unsatisfiedCount} required selection${unsatisfiedCount !== 1 ? "s" : ""} · $${price.toFixed(2)}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}