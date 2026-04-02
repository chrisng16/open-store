"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useMenuSearchState } from "@/stores/ui-store";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export function StorefrontSearch() {
    const { query, setQuery } = useMenuSearchState();
    const [localValue, setLocalValue] = useState(query);

    // Sync local state with store query (in case it's reset elsewhere)
    useEffect(() => {
        setLocalValue(query);
    }, [query]);

    // Debounce query update
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(localValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [localValue, setQuery]);

    return (
        <div className="relative w-full md:max-w-sm">
            <InputGroup className="relative group rounded-full">
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    type="text"
                    placeholder="Search menu..."
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                />
                {localValue && (
                    <InputGroupAddon align={'inline-end'}>
                        <InputGroupButton size={'icon-xs'} onClick={() => setLocalValue("")} className="rounded-full">
                            <X className="h-3 w-3" />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        </div >
    );
}
