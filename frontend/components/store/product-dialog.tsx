"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import type { CartItem, CartOption } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Input } from "../ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = {
    id: string;
    name: string;
    unit_amount: number;
    min_option_choice_quantity: number;
    max_option_choice_quantity: number;
    default_quantity: number;
};

export type OptionList = {
    id: string;
    name: string;
    selection_node: "single_select" | "multi_select" | "aggregate_quantity";
    min_num_options: number;
    max_num_options: number;
    min_aggregate_options_quantity: number;
    max_aggregate_options_quantity: number;
    is_optional: boolean;
    options: Option[];
};

export type ProductDialogProduct = {
    id: string;
    name: string;
    description: string | null;
    unit_amount: number;
    image_url: string | null;
    option_lists: OptionList[];
};

// ─── Selection helpers ────────────────────────────────────────────────────────

type Selections = Record<string, Record<string, number>>;

function groupTotal(sel: Selections, groupId: string) {
    return Object.values(sel[groupId] ?? {}).reduce((s, n) => s + n, 0);
}

function isListSatisfied(list: OptionList, sel: Selections) {
    const total = groupTotal(sel, list.id);
    const selectedOptions = Object.values(sel[list.id] ?? {}).filter((n) => n > 0).length;
    const minNum = list.is_optional ? 0 : list.min_num_options;
    if (selectedOptions < minNum) return false;
    if (list.max_num_options > 0 && selectedOptions > list.max_num_options) return false;
    if (list.selection_node === "aggregate_quantity") {
        if (total < list.min_aggregate_options_quantity) return false;
        if (list.max_aggregate_options_quantity > 0 && total > list.max_aggregate_options_quantity) return false;
    }
    return true;
}

function totalPrice(product: ProductDialogProduct, sel: Selections, qty: number) {
    let extra = 0;
    for (const list of product.option_lists) {
        for (const option of list.options) {
            extra += (sel[list.id]?.[option.id] ?? 0) * option.unit_amount;
        }
    }
    return (product.unit_amount + extra) * qty;
}

// ─── Quantity stepper ─────────────────────────────────────────────────────────

function Stepper({
    value,
    onValueChange,
    canDecrement,
    canIncrement,
}: {
    value: number;
    onValueChange: (v: number) => void;
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
                onClick={() => onValueChange(Math.max(1, value - 1))}
                tabIndex={-1}
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
                tabIndex={-1}
                className="text-center w-12 text-sm font-medium text-foreground tabular-nums" value={value} onChange={(e) => onValueChange(Math.min(Number(e.target.value), 14))} />
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={!canIncrement || value >= 14}
                onClick={() => onValueChange(Math.min(value + 1, 14))}
                tabIndex={-1}
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

// ─── Modifier group section ───────────────────────────────────────────────────

function OptionListSection({
    list,
    selections,
    onChange,
}: {
    list: OptionList;
    selections: Selections;
    onChange: (listId: string, optionId: string, delta: number) => void;
}) {
    const isOptional = list.is_optional;
    const isRadio = list.selection_node === "single_select";
    const atMax = list.max_aggregate_options_quantity > 0 && groupTotal(selections, list.id) >= list.max_aggregate_options_quantity;
    const satisfied = isListSatisfied(list, selections);

    return (
        <div className="mt-6">
            {/* Group header */}
            <div className="mb-3">
                <h3 className="text-base font-bold">{list.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    {isOptional ? (
                        <>
                            <span>Optional</span>
                            {list.max_num_options ? ` · Select up to ${list.max_num_options}` : ""}
                        </>
                    ) : (
                        <>
                            <span className={cn("font-medium", satisfied ? "text-green-600" : "text-amber-500")}>
                                Required
                            </span>
                            {` · Select ${list.min_num_options === list.max_num_options ? `exactly ${list.min_num_options}` : `at least ${list.min_num_options}`}`}
                            {list.max_num_options && list.max_num_options !== list.min_num_options ? ` (up to ${list.max_num_options})` : ""}
                        </>
                    )}
                </p>
            </div>

            {/* Radio group (max === 1) */}
            {isRadio ? (
                <RadioGroup
                    value={Object.entries(selections[list.id] ?? {}).find(([, v]) => v > 0)?.[0] ?? ""}
                    onValueChange={(optionId) => {
                        // Deselect previous, select new
                        const prev = Object.entries(selections[list.id] ?? {}).find(([, v]) => v > 0)?.[0];
                        if (prev && prev !== optionId) onChange(list.id, prev, -1);
                        onChange(list.id, optionId, 1);
                    }}
                    className="divide-y rounded-md border border-border/70 bg-card gap-0"
                >
                    {list.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-4 px-4 py-3">
                            <RadioGroupItem value={option.id} id={`radio-${option.id}`} />
                            <Label htmlFor={`radio-${option.id}`} className="flex-1 cursor-pointer">
                                <span className="text-sm font-medium">{option.name}</span>
                                {option.unit_amount !== 0 && (
                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                        {option.unit_amount > 0 ? "+" : ""}${(option.unit_amount / 100).toFixed(2)}
                                    </span>
                                )}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            ) : isOptional ? (
                // Checkbox group (optional multi-select)
                <div className="divide-y rounded-md border border-border/70 bg-card gap-0">
                    {list.options.map((option) => {
                        const checked = (selections[list.id]?.[option.id] ?? 0) > 0;
                        return (
                            <div key={option.id} className="flex items-center gap-4 px-4 py-3">
                                <Checkbox
                                    id={`check-${option.id}`}
                                    checked={checked}
                                    disabled={!checked && atMax}
                                    onCheckedChange={(v) => onChange(list.id, option.id, v ? 1 : -1)}
                                />
                                <Label htmlFor={`check-${option.id}`} className="flex-1 flex-col justify-start items-start cursor-pointer gap-0">
                                    <span className="text-sm font-medium">{option.name}</span>
                                    {option.unit_amount !== 0 && (
                                        <span className="text-xs text-muted-foreground leading-tight">
                                            {option.unit_amount > 0 ? "+" : ""}${(option.unit_amount / 100).toFixed(2)}
                                        </span>
                                    )}
                                </Label>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Stepper group (required, allows multiples — e.g. DoorDash Step 1/2)
                <div className="divide-y rounded-4xl border border-border/70 bg-card">
                    {list.options.map((option) => {
                        const qty = selections[list.id]?.[option.id] ?? 0;
                        return (
                            <div key={option.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{option.name}</p>
                                    {option.unit_amount !== 0 && (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {option.unit_amount > 0 ? "+" : ""}${(option.unit_amount / 100).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                                <Stepper
                                    value={qty}
                                    onValueChange={(v) => onChange(list.id, option.id, qty)}
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
        for (const option of cartItem.options as CartOption[]) {
            const listId = option.option_list_id ?? "default";
            out[listId] = out[listId] ?? {};
            out[listId][option.option_id] = (out[listId][option.option_id] ?? 0) + option.quantity;
        }
        return out;
    }, [initialSelections, cartItem]);

    const [qty, setQty] = useState<number>(derivedInitialQty);
    const [selections, setSelections] = useState<Selections>(derivedInitialSelections);

    const handleModifierChange = useCallback(
        (listId: string, optionId: string, delta: number) => {
            setSelections((prev) => {
                const list = product.option_lists.find((g) => g.id === listId)!;
                const isRadio = list.selection_node === "single_select";
                const groupSel = { ...(prev[listId] ?? {}) };

                if (isRadio && delta > 0) {
                    for (const key of Object.keys(groupSel)) groupSel[key] = 0;
                }

                groupSel[optionId] = Math.max(0, (groupSel[optionId] ?? 0) + delta);
                return { ...prev, [listId]: groupSel };
            });
        },
        [product.option_lists],
    );

    const allSatisfied = useMemo(
        () => product.option_lists.every((g) => isListSatisfied(g, selections)),
        [product.option_lists, selections],
    );

    const price = useMemo(() => totalPrice(product, selections, qty), [product, selections, qty]);

    const unsatisfiedCount = useMemo(
        () => product.option_lists.filter((g) => !isListSatisfied(g, selections)).length,
        [product.option_lists, selections],
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
            <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-[2rem] border border-border/70 p-0 sm:max-w-lg">
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

                    <div className="px-5 pb-4 pt-5 sm:px-6">
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

                        {product.option_lists.map((optionList) => (
                            <OptionListSection
                                key={optionList.id}
                                list={optionList}
                                selections={selections}
                                onChange={handleModifierChange}
                            />
                        ))}

                        <div className="h-4" />
                    </div>
                </div>

                {/* Sticky footer */}
                <Separator />
                <div className="bg-background px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <Stepper
                            value={qty}
                            onValueChange={(v) => setQty(v)}
                            canDecrement={qty > 1}
                            canIncrement={true}
                        />
                        <Button
                            className={cn(
                                "flex-1 rounded-full font-bold",
                                allSatisfied ? "" : "bg-muted text-muted-foreground",
                            )}
                            disabled={!allSatisfied}
                            onClick={handleAdd}
                        >
                            {allSatisfied
                                ? `Add to cart · $${(price / 100).toFixed(2)}`
                                : `Make ${unsatisfiedCount} required selection${unsatisfiedCount !== 1 ? "s" : ""} · $${(price / 100).toFixed(2)}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}