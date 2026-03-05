// components/dashboard/stores/timezone-selector.tsx
"use client";

import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function safeSupportedTimezones(): string[] {
    const anyIntl = Intl as any;
    const tzs: unknown = anyIntl?.supportedValuesOf?.("timeZone");
    if (Array.isArray(tzs) && tzs.every((x) => typeof x === "string")) {
        return tzs as string[];
    }
    return [
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "Europe/London",
        "Europe/Paris",
        "Asia/Tokyo",
        "Australia/Sydney",
    ];
}

function getTimezoneOffset(timezone: string): number {
    try {
        const date = new Date();
        const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
        const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
        return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
    } catch {
        return 0;
    }
}

function formatTimezoneLabel(timezone: string): string {
    const offset = getTimezoneOffset(timezone);
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset));
    return `(GMT${sign}${hours}) ${timezone.replace(/_/g, " ")}`;
}

type TimezoneSelectorProps = {
    /** Current IANA timezone string (e.g. "America/New_York") */
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
};

export const TimezoneSelector = ({ value, onChange, onBlur, disabled }: TimezoneSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
        }
    }, [isOpen]);

    const timezones = useMemo(() => safeSupportedTimezones(), []);

    const timezonesWithLabels = useMemo(
        () =>
            timezones
                .map((tz) => ({ value: tz, label: formatTimezoneLabel(tz), offset: getTimezoneOffset(tz) }))
                .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label)),
        [timezones]
    );

    const selectedTimezone = useMemo(
        () => timezonesWithLabels.find((tz) => tz.value === value) ?? timezonesWithLabels[0],
        [value, timezonesWithLabels]
    );

    const filteredTimezones = useMemo(() => {
        if (!searchQuery) return timezonesWithLabels;
        const q = searchQuery.toLowerCase();
        return timezonesWithLabels.filter(
            (tz) => tz.label.toLowerCase().includes(q) || tz.value.toLowerCase().includes(q)
        );
    }, [searchQuery, timezonesWithLabels]);

    const handleSelect = (tz: string) => {
        onChange(tz);
        setIsOpen(false);
        setSearchQuery("");
        // Signal blur to TanStack Form so validation + dirty tracking fires.
        onBlur?.();
    };

    const handleButtonBlur = () => {
        // Only fire onBlur when the dropdown is closed; otherwise the user is
        // just interacting with the list.
        if (!isOpen) onBlur?.();
    };

    return (
        <div className="relative">
            {/* Selector button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onBlur={handleButtonBlur}
                disabled={disabled}
                className="w-full px-3 py-2 text-left bg-white dark:bg-input/30 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-out"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">
                        {selectedTimezone?.label ?? value}
                    </span>
                    <svg
                        className={cn(
                            "w-4 h-4 text-zinc-500 transition-transform duration-200 ease-out",
                            isOpen && "rotate-180"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Dropdown */}
            {isMounted && (
                <>
                    <div
                        className={cn(
                            "fixed inset-0 z-10 bg-black/10 transition-opacity duration-200 ease-out",
                            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
                        )}
                        onClick={() => {
                            setIsOpen(false);
                            onBlur?.();
                        }}
                    />
                    <div
                        onTransitionEnd={() => {
                            if (!isOpen) setIsMounted(false);
                        }}
                        className={cn(
                            "absolute z-20 w-full mt-2 origin-top rounded-lg border border-zinc-800 bg-sidebar shadow-2xl overflow-hidden transition-all duration-200 ease-out will-change-transform",
                            isOpen
                                ? "translate-y-0 scale-100 opacity-100"
                                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                        )}
                    >
                        {/* Search */}
                        <div className="p-3 border-b border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Search timezones..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 text-zinc-100 text-sm rounded-md border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 placeholder:text-zinc-500"
                                    autoFocus={isOpen}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-64 overflow-y-auto">
                            {filteredTimezones.length > 0 ? (
                                filteredTimezones.map((tz) => (
                                    <button
                                        key={tz.value}
                                        type="button"
                                        onClick={() => handleSelect(tz.value)}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-800/50 transition-colors flex items-center justify-between"
                                    >
                                        <span>{tz.label}</span>
                                        {tz.value === value && <Check className="w-4 h-4 text-green-500" />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                                    No timezones found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};