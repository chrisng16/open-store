"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Plus, Trash2, X } from "lucide-react";

import type { ProductFormData } from "./product-editor-types";

type ProductOptionsSheetProps = {
    open: boolean;
    formData: ProductFormData;
    onFormDataChange: (value: ProductFormData) => void;
    onClose?: () => void;
};

export function ProductOptionsSheet({
    open,
    formData,
    onFormDataChange,
    onClose,
}: ProductOptionsSheetProps) {
    console.log("Rendering ProductOptionsSheet with formData:", formData);
    return (
        <aside
            className={`min-h-0 flex h-full flex-col bg-background-elevated lg:border-l`}
        >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <p className="font-medium">Option Groups</p>
                    <div className="flex items-center gap-2">
                        {onClose ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={open ? "opacity-100" : "pointer-events-none opacity-0"}
                                onClick={onClose}
                            >
                                <X className="size-4" />
                                Close
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                onFormDataChange({
                                    ...formData,
                                    optionLists: [
                                        ...formData.optionLists,
                                        {
                                            name: "",
                                            minNumOptions: 0,
                                            maxNumOptions: 1,
                                            isOptional: true,
                                            options: [
                                                {
                                                    name: "",
                                                    unitAmount: "0",
                                                    isDefault: false,
                                                    sortOrder: 0,
                                                },
                                            ],
                                        },
                                    ],
                                })
                            }
                        >
                            <Plus className="size-4" />
                            Add Group
                        </Button>
                    </div>
                </div>

                {formData.optionLists.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        No groups yet. Add one to let customers customize this product.
                    </div>
                ) : (
                    formData.optionLists.map((optionList, optionListIndex) => (
                        <div key={optionListIndex} className="rounded-md border p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="font-medium">{optionList.name || `Group ${optionListIndex + 1}`}</p>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                        onFormDataChange({
                                            ...formData,
                                            optionLists: formData.optionLists.filter((_, index) => index !== optionListIndex),
                                        })
                                    }
                                >
                                    <Trash2 className="size-4 text-destructive" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="space-y-1 md:col-span-3">
                                    <Label>Group Name</Label>
                                    <Input
                                        value={optionList.name}
                                        onChange={(event) => {
                                            const nextOptionLists = [...formData.optionLists];
                                            nextOptionLists[optionListIndex] = { ...optionList, name: event.target.value };
                                            onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                        }}
                                        placeholder="e.g. Size"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Min Options</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={optionList.minNumOptions}
                                        onChange={(event) => {
                                            const nextOptionLists = [...formData.optionLists];
                                            nextOptionLists[optionListIndex] = {
                                                ...optionList,
                                                minNumOptions: Number(event.target.value || 0),
                                            };
                                            onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                        <Label>Max Options</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="size-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Set to 1 for single-choice groups.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={optionList.maxNumOptions}
                                        onChange={(event) => {
                                            const nextOptionLists = [...formData.optionLists];
                                            nextOptionLists[optionListIndex] = {
                                                ...optionList,
                                                maxNumOptions: Number(event.target.value || 0),
                                            };
                                            onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                        }}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Checkbox
                                            checked={!optionList.isOptional}
                                            onCheckedChange={(checked) => {
                                                const nextOptionLists = [...formData.optionLists];
                                                nextOptionLists[optionListIndex] = {
                                                    ...optionList,
                                                    isOptional: checked !== true,
                                                };
                                                onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                            }}
                                        />
                                        Required List
                                    </label>
                                </div>
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Options</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const nextOptionLists = [...formData.optionLists];
                                            const targetOptionList = nextOptionLists[optionListIndex];
                                            nextOptionLists[optionListIndex] = {
                                                ...targetOptionList,
                                                options: [
                                                    ...targetOptionList.options,
                                                    {
                                                        name: "",
                                                        unitAmount: "0",
                                                        isDefault: false,
                                                        sortOrder: targetOptionList.options.length,
                                                    },
                                                ],
                                            };
                                            onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                        }}
                                    >
                                        <Plus className="size-4" />
                                        Add Option
                                    </Button>
                                </div>

                                <div className="p-1 md:border border-dashed border-0 rounded-md md:space-y-2 space-y-2">
                                    {optionList.options.length > 0 ? <div className="hidden grid-cols-12 gap-2 px-2 text-xs text-muted-foreground md:grid">
                                        <Label className="md:col-span-5 text-xs text-muted-foreground">Option Name</Label>
                                        <Label className="md:col-span-3 text-xs text-muted-foreground">Price Adj.</Label>
                                        <Label className="md:col-span-2 text-xs text-muted-foreground">Sort</Label>
                                        <Label className="md:col-span-1 text-xs text-muted-foreground justify-start md:justify-center">Default</Label>
                                        <span className="md:col-span-1" />
                                    </div> :
                                        <div className="p-2 text-muted-foreground text-sm">No options yet. Add one to let customers customize this group.</div>}

                                    {optionList.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className="grid grid-cols-1 gap-2 p-2 rounded-md md:p-0.5 md:grid-cols-12 border border-dashed md:border-0">
                                            <div className="md:col-span-5">
                                                <Label className="mb-1 block text-xs text-muted-foreground md:hidden">Option Name</Label>
                                                <Input
                                                    value={option.name}
                                                    placeholder="Option name"
                                                    onChange={(event) => {
                                                        const nextOptionLists = [...formData.optionLists];
                                                        const nextOptions = [...optionList.options];
                                                        nextOptions[optionIndex] = {
                                                            ...option,
                                                            name: event.target.value,
                                                        };
                                                        nextOptionLists[optionListIndex] = { ...optionList, options: nextOptions };
                                                        onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <Label className="mb-1 block text-xs text-muted-foreground md:hidden">Price Adj.</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={option.unitAmount}
                                                    placeholder="0.00"
                                                    onChange={(event) => {
                                                        const nextOptionLists = [...formData.optionLists];
                                                        const nextOptions = [...optionList.options];
                                                        nextOptions[optionIndex] = {
                                                            ...option,
                                                            unitAmount: event.target.value,
                                                        };
                                                        nextOptionLists[optionListIndex] = { ...optionList, options: nextOptions };
                                                        onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Label className="mb-1 block text-xs text-muted-foreground md:hidden">Sort</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={option.sortOrder}
                                                    onChange={(event) => {
                                                        const nextOptionLists = [...formData.optionLists];
                                                        const nextOptions = [...optionList.options];
                                                        nextOptions[optionIndex] = {
                                                            ...option,
                                                            sortOrder: Number(event.target.value || 0),
                                                        };
                                                        nextOptionLists[optionListIndex] = { ...optionList, options: nextOptions };
                                                        onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-start md:justify-center gap-2 md:col-span-1">
                                                <Label className="text-xs text-muted-foreground md:hidden">Default</Label>
                                                <Checkbox
                                                    checked={option.isDefault}
                                                    onCheckedChange={(checked) => {
                                                        const nextOptionLists = [...formData.optionLists];
                                                        const nextOptions = [...optionList.options];
                                                        nextOptions[optionIndex] = {
                                                            ...option,
                                                            isDefault: checked === true,
                                                        };
                                                        nextOptionLists[optionListIndex] = { ...optionList, options: nextOptions };
                                                        onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => {
                                                        const nextOptionLists = [...formData.optionLists];
                                                        const nextOptions = optionList.options.filter((_, index) => index !== optionIndex);
                                                        nextOptionLists[optionListIndex] = { ...optionList, options: nextOptions };
                                                        onFormDataChange({ ...formData, optionLists: nextOptionLists });
                                                    }}
                                                >
                                                    <Trash2 className="size-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>


                            </div>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
