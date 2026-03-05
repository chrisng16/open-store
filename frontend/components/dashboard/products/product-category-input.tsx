"use client";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ProductCategoryOption } from "./product-editor-types";

type ProductCategoryInputProps = {
    value: string;
    selectedCategoryId: string;
    categories: ProductCategoryOption[];
    onChange: (nextCategory: { categoryName: string; categoryId: string }) => void;
};

export function ProductCategoryInput({
    value,
    selectedCategoryId,
    categories,
    onChange,
}: ProductCategoryInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const transitionMs = 200;

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const filteredCategories = useMemo(() => {
        const query = inputValue.trim().toLowerCase();
        if (!query) return categories;
        return categories.filter((category) => category.name.toLowerCase().includes(query));
    }, [categories, inputValue]);

    const hasExactMatch = categories.some(
        (category) => category.name.trim().toLowerCase() === inputValue.trim().toLowerCase()
    );

    const handleSelect = (category: ProductCategoryOption) => {
        setInputValue(category.name);
        onChange({ categoryName: category.name, categoryId: category.id });
        setIsOpen(false);
        setTimeout(() => setIsVisible(false), transitionMs);
    };

    const handleInputChange = (nextValue: string) => {
        setInputValue(nextValue);
        const exactMatch = categories.find(
            (category) => category.name.trim().toLowerCase() === nextValue.trim().toLowerCase()
        );

        onChange({
            categoryName: nextValue,
            categoryId: exactMatch?.id ?? "",
        });

        setIsOpen(true);
        setIsVisible(true);
    };

    return (
        <InputGroup className="relative">
            <div className="w-full">
                <InputGroupInput
                    placeholder="Enter or select category"
                    value={inputValue}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onFocus={() => {
                        setIsOpen(true);
                        setIsVisible(true);
                    }}
                    onBlur={() =>
                        setTimeout(() => {
                            setIsOpen(false);
                            setTimeout(() => setIsVisible(false), transitionMs);
                        }, 120)
                    }
                />

                {isVisible ? (
                    <div
                        className={`absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-popover shadow-md transition-opacity duration-150 ease-in-out ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    >
                        {inputValue.trim() && !hasExactMatch ? (
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange({ categoryName: inputValue.trim(), categoryId: "" });
                                    setIsOpen(false);
                                    setTimeout(() => setIsVisible(false), transitionMs);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            >
                                Create custom category: <span className="font-medium">{inputValue.trim()}</span>
                            </button>
                        ) : null}

                        {filteredCategories.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto">
                                {filteredCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelect(category)}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                    >
                                        <span>{category.name}</span>
                                        {selectedCategoryId === category.id ? <Check className="size-4" /> : null}
                                    </button>
                                ))}
                            </div>
                        ) : inputValue.trim() ? null : (
                            <p className="px-3 py-2 text-sm text-muted-foreground">No categories yet.</p>
                        )}

                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                setInputValue("");
                                onChange({ categoryName: "", categoryId: "" });
                                setIsOpen(false);
                                setTimeout(() => setIsVisible(false), transitionMs);
                            }}
                            className="w-full border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                            Clear category
                        </button>
                    </div>
                ) : null}
            </div>

            <InputGroupAddon align="inline-end">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Type to filter categories or create a new one.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </InputGroupAddon>
        </InputGroup>
    );
}
