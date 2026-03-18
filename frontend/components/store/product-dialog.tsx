"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { CartItem } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Product, OptionList } from "@/lib/types";

type Selections = Record<string, Record<string, number>>;

type ProductPreview = {
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
};

function groupTotal(sel: Selections, groupId: string) {
    return Object.values(sel[groupId] ?? {}).reduce((s, n) => s + n, 0);
}

function isListSatisfied(list: OptionList, sel: Selections) {
    const total = groupTotal(sel, list.id);
    const selectedOptions = Object.values(sel[list.id] ?? {}).filter((n) => n > 0).length;
    const minNum = list.isOptional ? 0 : list.minNumOptions;
    if (selectedOptions < minNum) return false;
    if (list.maxNumOptions > 0 && selectedOptions > list.maxNumOptions) return false;
    if (list.selectionNode === "aggregate_quantity") {
        if (total < list.minAggregateOptionsQuantity) return false;
        if (list.maxAggregateOptionsQuantity > 0 && total > list.maxAggregateOptionsQuantity) return false;
    }
    return true;
}

function totalPrice(product: Product, sel: Selections, qty: number) {
    let extra = 0;
    for (const list of product.optionLists) {
        for (const option of list.options) {
            extra += (sel[list.id]?.[option.id] ?? 0) * option.unitAmount;
        }
    }
    return (product.unitAmount + extra) * qty;
}

function deriveSelectionsFromCartItem(cartItem?: CartItem): Selections {
    if (!cartItem) return {};
    const out: Selections = {};
    for (const option of cartItem.options) {
        const listId = option.option_list_id ?? "default";
        out[listId] = out[listId] ?? {};
        out[listId][option.option_id] = (out[listId][option.option_id] ?? 0) + option.quantity;
    }
    return out;
}

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
                className="w-12 text-center text-sm font-medium text-foreground tabular-nums"
                value={value}
                onChange={(e) => onValueChange(Math.min(Math.max(Number(e.target.value) || 1, 1), 14))}
            />
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

function OptionListSection({
    list,
    selections,
    onChange,
}: {
    list: OptionList;
    selections: Selections;
    onChange: (listId: string, optionId: string, delta: number) => void;
}) {
    const isOptional = list.isOptional;
    const isRadio = !list.isOptional && list.maxNumOptions === 1;
    const atMax =
        list.maxAggregateOptionsQuantity > 0 &&
        groupTotal(selections, list.id) >= list.maxAggregateOptionsQuantity;
    const satisfied = isListSatisfied(list, selections);

    return (
        <div className="mt-6">
            <div className="mb-3">
                <h3 className="text-base font-bold">{list.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    {isOptional ? (
                        <>
                            <span>Optional</span>
                            {list.maxNumOptions ? ` · Select up to ${list.maxNumOptions}` : ""}
                        </>
                    ) : (
                        <>
                            <span className={cn("font-medium", satisfied ? "text-green-600" : "text-amber-500")}>
                                Required
                            </span>
                            {` · Select ${list.minNumOptions === list.maxNumOptions
                                ? `exactly ${list.minNumOptions}`
                                : `at least ${list.minNumOptions}`
                                }`}
                            {list.maxNumOptions && list.maxNumOptions !== list.minNumOptions
                                ? ` (up to ${list.maxNumOptions})`
                                : ""}
                        </>
                    )}
                </p>
            </div>

            {isRadio ? (
                <RadioGroup
                    value={Object.entries(selections[list.id] ?? {}).find(([, v]) => v > 0)?.[0] ?? ""}
                    onValueChange={(optionId) => {
                        const prev = Object.entries(selections[list.id] ?? {}).find(([, v]) => v > 0)?.[0];
                        if (prev && prev !== optionId) onChange(list.id, prev, -1);
                        onChange(list.id, optionId, 1);
                    }}
                    className="divide-y gap-0 rounded-md border border-border/70 bg-card"
                >
                    {list.options.map((option) => (
                        <div key={option.id} className="flex items-center gap-4 px-4 py-3">
                            <RadioGroupItem value={option.id} id={`radio-${option.id}`} />
                            <Label htmlFor={`radio-${option.id}`} className="flex-1 cursor-pointer">
                                <span className="text-sm font-medium">{option.name}</span>
                                {option.unitAmount !== 0 && (
                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                        {option.unitAmount > 0 ? "+" : ""}${(option.unitAmount / 100).toFixed(2)}
                                    </span>
                                )}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            ) : isOptional ? (
                <div className="divide-y gap-0 rounded-md border border-border/70 bg-card">
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
                                <Label
                                    htmlFor={`check-${option.id}`}
                                    className="flex flex-1 cursor-pointer flex-col items-start justify-start gap-0"
                                >
                                    <span className="text-sm font-medium">{option.name}</span>
                                    {option.unitAmount !== 0 && (
                                        <span className="text-xs leading-tight text-muted-foreground">
                                            {option.unitAmount > 0 ? "+" : ""}${(option.unitAmount / 100).toFixed(2)}
                                        </span>
                                    )}
                                </Label>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="divide-y rounded-4xl border border-border/70 bg-card">
                    {list.options.map((option) => {
                        const qty = selections[list.id]?.[option.id] ?? 0;
                        return (
                            <div key={option.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{option.name}</p>
                                    {option.unitAmount !== 0 && (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {option.unitAmount > 0 ? "+" : ""}${(option.unitAmount / 100).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                                <Stepper
                                    value={qty}
                                    onValueChange={(v) => onChange(list.id, option.id, v - qty)}
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

function ProductDialogSkeleton({ preview }: { preview?: ProductPreview }) {
    return (
        <>
            <div className="aspect-video w-full overflow-hidden">
                {preview?.imageUrl ? (
                    <Image
                        src={preview.imageUrl}
                        alt={preview.name ?? "Product"}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover opacity-75"
                    />
                ) : (
                    <Skeleton className="h-full w-full" />
                )}
            </div>
            <div className="px-5 pb-4 pt-5 sm:px-6">
                <DialogHeader className="mb-3 text-left">
                    {preview?.name ? (
                        <DialogTitle className="text-2xl font-bold tracking-tight">
                            {preview.name}
                        </DialogTitle>
                    ) : (
                        <>
                            <DialogTitle className="sr-only">Loading product</DialogTitle>
                            <Skeleton className="h-8 w-48" aria-hidden="true" />
                        </>
                    )}
                    {preview?.description ? (
                        <DialogDescription>{preview.description}</DialogDescription>
                    ) : (
                        <>
                            <DialogDescription className="sr-only">
                                Loading product details
                            </DialogDescription>
                            <Skeleton className="h-4 w-64" aria-hidden="true" />
                        </>
                    )}
                </DialogHeader>
                <div className="h-4" />
            </div>

            <Separator />
            <div className="bg-background px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-32 rounded-full" />
                    <Skeleton className="h-10 flex-1 rounded-full" />
                </div>
            </div>
        </>
    );
}

export function ProductDialog({
    open = true,
    productId,
    storeId,
    onClose,
    onAddToCart,
    cartItem,
    onSaveEdit,
    initialQty,
    initialSelections,
    preview,
}: {
    open?: boolean;
    productId: string;
    storeId: string;
    onClose: () => void;
    onAddToCart?: (product: Product, selections: Selections, qty: number) => void;
    cartItem?: CartItem;
    onSaveEdit?: (
        id: string,
        selections: Selections,
        qty: number,
        product: Product
    ) => void;
    initialQty?: number;
    initialSelections?: Selections;
    preview?: ProductPreview;
}) {
    const queryClient = useQueryClient();

    const [qty, setQty] = useState<number>(initialQty ?? cartItem?.quantity ?? 1);
    const [selections, setSelections] = useState<Selections>(
        initialSelections ?? deriveSelectionsFromCartItem(cartItem)
    );

    useEffect(() => {
        setQty(initialQty ?? cartItem?.quantity ?? 1);
        setSelections(initialSelections ?? deriveSelectionsFromCartItem(cartItem));
    }, [cartItem, initialQty, initialSelections, productId]);

    const productQueryKey = useMemo(
        () => ["store-product", storeId, productId] as const,
        [storeId, productId]
    );

    const {
        data: product,
        error,
        isPending,
        isFetching,
    } = useQuery<Product>({
        queryKey: productQueryKey,
        queryFn: () => api.products.get(storeId, productId),
        enabled: open && !!storeId && !!productId,
        initialData: () => queryClient.getQueryData<Product>(productQueryKey),
        staleTime: 0,
        refetchOnMount: true,
    });

    const isLoading = isPending && !product;
    const loadError = error instanceof Error ? error.message : error ? "Failed to load product details" : null;

    const handleModifierChange = useCallback(
        (listId: string, optionId: string, delta: number) => {
            if (!product) return;
            setSelections((prev) => {
                const list = product.optionLists.find((group) => group.id === listId);
                if (!list) return prev;

                const isRadio = list.selectionNode === "single_select";
                const groupSel = { ...(prev[listId] ?? {}) };

                if (isRadio && delta > 0) {
                    for (const key of Object.keys(groupSel)) groupSel[key] = 0;
                }

                groupSel[optionId] = Math.max(0, (groupSel[optionId] ?? 0) + delta);
                return { ...prev, [listId]: groupSel };
            });
        },
        [product]
    );

    const allSatisfied = useMemo(() => {
        if (!product) return false;
        return product.optionLists.every((group) => isListSatisfied(group, selections));
    }, [product, selections]);

    const price = useMemo(() => {
        if (!product) return 0;
        return totalPrice(product, selections, qty);
    }, [product, selections, qty]);

    const unsatisfiedCount = useMemo(() => {
        if (!product) return 0;
        return product.optionLists.filter((group) => !isListSatisfied(group, selections)).length;
    }, [product, selections]);

    const handleAdd = () => {
        if (!product || !allSatisfied) return;
        if (onSaveEdit && cartItem) {
            onSaveEdit(cartItem.id, selections, qty, product);
            onClose();
            return;
        }
        onAddToCart?.(product, selections, qty);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent
                closeButtonClassName="rounded-full bg-accent p-1 opacity-90"
                className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-xl border border-border/70 p-0 sm:max-w-lg"
            >
                {isLoading && <ProductDialogSkeleton preview={preview} />}

                {!isLoading && loadError && (
                    <div className="p-6">
                        <DialogHeader className="text-left">
                            <DialogTitle>Could not load item</DialogTitle>
                            <DialogDescription>{loadError}</DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={onClose}>Close</Button>
                        </div>
                    </div>
                )}

                {!isLoading && !loadError && product && (
                    <>
                        <div className="flex-1 overflow-y-auto">
                            <div className="aspect-video w-full overflow-hidden relative">
                                <Image
                                    src={product.imageUrl || "https://static.photos/food/640x360/"}
                                    alt={product.name}
                                    width={640}
                                    height={360}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="px-5 pb-4 pt-5 sm:px-6">
                                <DialogHeader className="mb-1 text-left">
                                    <DialogTitle className="text-2xl font-bold tracking-tight">
                                        {product.name}
                                    </DialogTitle>
                                    <DialogDescription>{product.description}</DialogDescription>
                                </DialogHeader>

                                {product.optionLists.map((optionList) => (
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

                        <Separator />
                        <div className="bg-background px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                                <Stepper
                                    value={qty}
                                    onValueChange={(v) => setQty(v)}
                                    canDecrement={qty > 1}
                                    canIncrement
                                />
                                <Button
                                    className={cn(
                                        "flex-1 rounded-full font-bold",
                                        allSatisfied ? "" : "bg-muted text-muted-foreground"
                                    )}
                                    disabled={!allSatisfied}
                                    onClick={handleAdd}
                                >
                                    {allSatisfied
                                        ? `Add to cart · $${(price / 100).toFixed(2)}`
                                        : `Make ${unsatisfiedCount} required selection${unsatisfiedCount !== 1 ? "s" : ""
                                        } · $${(price / 100).toFixed(2)}`}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
