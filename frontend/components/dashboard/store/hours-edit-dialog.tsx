"use client";

import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { DayHours, DayKey, TimeRange, WeekHours } from "@/components/dashboard/store/time-utils";
import {
    DAY_CHIPS,
    DAY_LABELS,
    DAY_ORDER,
    getNextDay,
    getPrevDay,
    inputValueToMinutes,
    isSameDayHours,
    minutesToInputValue,
    normalizeAndMergeRanges,
} from "@/components/dashboard/store/time-utils";

type Mode = "ranges" | "closed" | "open24";

type Draft = {
    selectedDays: Set<DayKey>;
    mode: Mode;
    ranges: TimeRange[];
};

type HoursEditDialogProps = {
    open: boolean;
    onOpenChangeAction: (open: boolean) => void;
    initialSelectedDays: DayKey[];
    weekHours: WeekHours;
    onSaveAction: (next: WeekHours) => void;
    setFormDirtyAction: (isDirty: boolean) => void;
};

function cloneDayHours(dh: DayHours): { mode: Mode; ranges: TimeRange[] } {
    if (dh.status === "closed") return { mode: "closed", ranges: [] };
    if (dh.status === "open24") return { mode: "open24", ranges: [] };
    return { mode: "ranges", ranges: dh.ranges.map((r) => ({ ...r })) };
}

function getInitialDraft(initialSelectedDays: DayKey[], weekHours: WeekHours): Draft {
    const selected = new Set<DayKey>(initialSelectedDays);

    if (initialSelectedDays.length === 1) {
        const day = initialSelectedDays[0];
        const dh = weekHours[day];

        // If this day is a receiver of an overnight spill (prev day ends at 24:00
        // and this day starts at 00:00), hide that midnight-start segment so the
        // editor doesn't show the spillover piece. The selector still collapses
        // the originating day's display into "(next day)".
        if (dh.status === "ranges") {
            const todayRanges = normalizeAndMergeRanges(dh.ranges);
            const prev = weekHours[getPrevDay(day)];
            const prevRanges = prev.status === "ranges" ? normalizeAndMergeRanges(prev.ranges) : [];
            const prevHasEndOfDay = prevRanges.some((r) => r.endMin === 1440);
            const hasMidnightStart = todayRanges.some((r) => r.startMin === 0);

            if (prevHasEndOfDay && hasMidnightStart) {
                const filtered = todayRanges.filter((r) => r.startMin !== 0);
                if (filtered.length === 0) return { selectedDays: selected, mode: "closed", ranges: [] };
                return { selectedDays: selected, mode: "ranges", ranges: filtered };
            }

            // If this day contains an end-of-day range and next day has a 00:00
            // starting range, combine them into a single overnight range for
            // editing convenience: show `start -> end` where end < start.
            const endOfDay = todayRanges.find((r) => r.endMin === 1440) ?? null;
            if (endOfDay) {
                const next = weekHours[getNextDay(day)];
                if (next.status === "ranges") {
                    const nextRanges = normalizeAndMergeRanges(next.ranges);
                    const startOfNext = nextRanges.find((r) => r.startMin === 0) ?? null;
                    if (startOfNext) {
                        const merged = todayRanges.filter((r) => r !== endOfDay);
                        // Represent as an overnight range where endMin < startMin.
                        merged.push({ startMin: endOfDay.startMin, endMin: startOfNext.endMin });
                        return { selectedDays: selected, mode: "ranges", ranges: merged };
                    }
                }
            }
        }

        const { mode, ranges } = cloneDayHours(dh);
        return { selectedDays: selected, mode, ranges };
    }

    // Multi-day: if identical, use that; else default.
    const first = weekHours[initialSelectedDays[0]];
    const allSame = initialSelectedDays.every((d) => isSameDayHours(first, weekHours[d]));

    if (allSame) {
        const { mode, ranges } = cloneDayHours(first);
        return { selectedDays: selected, mode, ranges };
    }

    return {
        selectedDays: selected,
        mode: "ranges",
        ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }],
    };
}

function isOvernightRange(r: TimeRange): boolean {
    return r.endMin < r.startMin;
}

function expandRangesPerDay(selectedDays: Set<DayKey>, ranges: TimeRange[]): Map<DayKey, TimeRange[]> {
    const perDay = new Map<DayKey, TimeRange[]>();

    const push = (day: DayKey, r: TimeRange) => {
        const arr = perDay.get(day) ?? [];
        arr.push(r);
        perDay.set(day, arr);
    };

    for (const day of selectedDays) {
        for (const r of ranges) {
            if (!isOvernightRange(r)) {
                push(day, { ...r });
            } else {
                // Split across midnight:
                // day: start -> 24:00
                // next: 00:00 -> end
                push(day, { startMin: r.startMin, endMin: 1440 });
                push(getNextDay(day), { startMin: 0, endMin: r.endMin });
            }
        }
    }

    return perDay;
}

function mergeIntoDayHours(existing: DayHours, additions: TimeRange[]): DayHours {
    if (existing.status === "open24") return existing;

    // When merging spillover into a different day, avoid merging *touching* ranges.
    // This preserves distinct segments like 00:00–02:00 and 02:00–17:30 as separate ranges,
    // so the originating day can correctly display its overnight close time.
    const add = normalizeAndMergeRanges(additions, { mergeTouching: false });
    if (add.length === 0) return existing;

    if (existing.status === "closed") return { status: "ranges", ranges: add };

    // existing.status === "ranges"
    const combined = normalizeAndMergeRanges([...existing.ranges, ...add], { mergeTouching: false });
    return combined.length ? { status: "ranges", ranges: combined } : { status: "closed" };
}

function getIncomingSpillover(week: WeekHours, day: DayKey): TimeRange[] {
    const dh = week[day];
    if (dh.status !== "ranges") return [];

    const prev = week[getPrevDay(day)];
    if (prev.status !== "ranges") return [];

    const prevRanges = normalizeAndMergeRanges(prev.ranges);
    const prevHasEndOfDay = prevRanges.some((r) => r.endMin === 1440);
    if (!prevHasEndOfDay) return [];

    const todayRanges = normalizeAndMergeRanges(dh.ranges, { mergeTouching: false });
    return todayRanges.filter((r) => r.startMin === 0).map((r) => ({ ...r }));
}

function applyDraftToWeek(weekHours: WeekHours, draft: Draft): WeekHours {
    const next: WeekHours = { ...weekHours };

    if (draft.mode === "closed") {
        // If a selected day is receiving an overnight spillover from its previous day,
        // preserve that 00:00-starting segment even if the day is set to "Closed".
        // The selector/editor already hide these spillover-only ranges so the day still
        // appears "Closed" to the user, while the originating day can still display
        // an overnight close time (e.g. Wed 9pm–2am even if Thu is "Closed").
        for (const d of draft.selectedDays) {
            const incoming = getIncomingSpillover(weekHours, d);
            next[d] = incoming.length ? { status: "ranges", ranges: incoming } : { status: "closed" };
        }
        return next;
    }

    if (draft.mode === "open24") {
        // Open 24 hours subsumes any spillover.
        for (const d of draft.selectedDays) next[d] = { status: "open24" };
        return next;
    }

    // ranges mode
    const perDay = expandRangesPerDay(draft.selectedDays, draft.ranges);

    // Overwrite selected days with their contributions (merged), but retain any incoming spillover.
    for (const d of draft.selectedDays) {
        const incoming = getIncomingSpillover(weekHours, d);
        const contrib = perDay.get(d) ?? [];
        const merged = normalizeAndMergeRanges([...incoming, ...contrib]);
        next[d] = merged.length ? { status: "ranges", ranges: merged } : { status: "closed" };
    }

    // Merge spillover into non-selected days
    for (const [day, additions] of perDay.entries()) {
        if (!draft.selectedDays.has(day)) {
            next[day] = mergeIntoDayHours(next[day], additions);
        }
    }

    return next;
}

function validateDraft(draft: Draft): { ok: boolean; message?: string } {
    if (draft.selectedDays.size === 0) return { ok: false, message: "Select at least one day." };
    if (draft.mode !== "ranges") return { ok: true };

    for (const r of draft.ranges) {
        if (!Number.isFinite(r.startMin) || !Number.isFinite(r.endMin)) {
            return { ok: false, message: "Enter valid times." };
        }
        // Allow overnight (end < start). Only disallow identical times.
        if (r.startMin === r.endMin) {
            return { ok: false, message: "Open and close time cannot be the same." };
        }
    }

    // Must yield at least one contribution once overnight splitting is applied.
    const perDay = expandRangesPerDay(draft.selectedDays, draft.ranges);
    const hasAny = Array.from(perDay.values()).some((rs) => normalizeAndMergeRanges(rs).length > 0);
    if (!hasAny) return { ok: false, message: "Add at least one valid time range." };

    return { ok: true };
}


export function HoursEditDialog(props: HoursEditDialogProps) {
    const { open, onOpenChangeAction, initialSelectedDays, weekHours, onSaveAction, setFormDirtyAction } = props;

    const [draft, setDraft] = React.useState<Draft>(() => getInitialDraft(initialSelectedDays, weekHours));
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;
        setDraft(getInitialDraft(initialSelectedDays, weekHours));
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialSelectedDays.join("|")]);

    const selectedCount = draft.selectedDays.size;
    const validation = React.useMemo(() => validateDraft(draft), [draft]);

    const toggleDay = (day: DayKey) => {
        setDraft((prev) => {
            const next = new Set(prev.selectedDays);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return { ...prev, selectedDays: next };
        });
    };

    const setMode = (mode: Mode) => {
        setDraft((prev) => {
            if (mode === "ranges" && prev.ranges.length === 0) {
                return { ...prev, mode, ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] };
            }
            return { ...prev, mode };
        });
    };

    const updateRange = (idx: number, field: "startMin" | "endMin", value: number) => {
        setDraft((prev) => {
            const ranges = prev.ranges.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
            return { ...prev, ranges };
        });
    };

    // Merge non-overnight ranges on blur. Invalid or overnight ranges are preserved
    // so the user can correct them; only valid regular ranges are merged.
    const mergeRangesNow = () => {
        setDraft((prev) => {
            const overnight = prev.ranges.filter(isOvernightRange);
            const regular = prev.ranges.filter((r) => !isOvernightRange(r));

            const validRegular = regular.filter(
                (r) => Number.isFinite(r.startMin) && Number.isFinite(r.endMin) && r.startMin < r.endMin
            );

            const invalidRegular = regular.filter(
                (r) => !(Number.isFinite(r.startMin) && Number.isFinite(r.endMin) && r.startMin < r.endMin)
            );

            const mergedRegular = normalizeAndMergeRanges(validRegular);
            return { ...prev, ranges: [...overnight, ...mergedRegular, ...invalidRegular] };
        });
    };
    const addRange = () => {
        setDraft((prev) => {
            // Add a blank range so the inputs appear empty and the user fills them.
            const blankRange = { startMin: NaN, endMin: NaN } as TimeRange;
            return { ...prev, mode: "ranges", ranges: [...prev.ranges, blankRange] };
        });
    };

    const removeRange = (idx: number) => {
        setDraft((prev) => {
            const ranges = prev.ranges.filter((_, i) => i !== idx);
            return { ...prev, ranges };
        });
    };

    const handleSave = () => {
        const v = validateDraft(draft);
        if (!v.ok) {
            setError(v.message ?? "Fix errors and try again.");
            return;
        }
        setError(null);

        const next = applyDraftToWeek(weekHours, draft);


        // Efficient, deterministic comparison of weekHours -> next.
        // Compare status and normalized ranges per day (order from DAY_ORDER).
        const isEqual = DAY_ORDER.every((day) => {
            const a = weekHours[day];
            const b = next[day];
            if (a.status !== b.status) return false;
            if (a.status === "ranges" && b.status === "ranges") {
                const ar = normalizeAndMergeRanges(a.ranges);
                const br = normalizeAndMergeRanges(b.ranges);
                if (ar.length !== br.length) return false;
                for (let i = 0; i < ar.length; i++) {
                    if (ar[i].startMin !== br[i].startMin || ar[i].endMin !== br[i].endMin) return false;
                }
            }
            return true;
        });

        setFormDirtyAction(!isEqual);

        onSaveAction(next);
        onOpenChangeAction(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="sm:max-w-xl bg-background-elevated">
                <DialogHeader>
                    <DialogTitle>Select days &amp; time</DialogTitle>
                </DialogHeader>

                {/* Day chips */}
                <div className="flex flex-wrap items-center gap-2">
                    {DAY_ORDER.map((d) => {
                        const selected = draft.selectedDays.has(d);
                        return (
                            <Button
                                key={d}
                                type="button"
                                variant={selected ? "default" : "outline"}
                                size="icon"
                                aria-pressed={selected}
                                aria-label={`Toggle ${DAY_LABELS[d]}`}
                                onClick={() => toggleDay(d)}
                                className={cn("rounded-full")}
                            >
                                {DAY_CHIPS[d]}
                            </Button>
                        );
                    })}

                    <div className="ml-2 text-sm text-muted-foreground">
                        {selectedCount === 0 ? "No days selected" : `${selectedCount} day(s) selected`}
                    </div>
                </div>

                {/* Mode selector */}
                <div className="mt-4 grid gap-3">
                    <Label className="text-sm">Status</Label>
                    <RadioGroup
                        value={draft.mode}
                        onValueChange={(v) => setMode(v as Mode)}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ranges" id="mode-ranges" />
                            <Label htmlFor="mode-ranges">Custom hours</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="open24" id="mode-open24" />
                            <Label htmlFor="mode-open24">Open 24 hours</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="closed" id="mode-closed" />
                            <Label htmlFor="mode-closed">Closed</Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Ranges */}
                {draft.mode === "ranges" && (
                    <div className="mt-4 grid gap-3">
                        {draft.ranges.map((r, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                            >
                                <div className="grid gap-1">
                                    <Label className="text-sm">Open time</Label>
                                    <Input
                                        type="time"
                                        value={minutesToInputValue(r.startMin)}
                                        onChange={(e) =>
                                            updateRange(idx, "startMin", inputValueToMinutes(e.target.value))
                                        }
                                        onBlur={mergeRangesNow}
                                        aria-label={`Open time for range ${idx + 1}`}
                                    />
                                </div>

                                <div className="grid gap-1">
                                    <Label className="text-sm">Close time</Label>
                                    <Input
                                        type="time"
                                        value={minutesToInputValue(r.endMin)}
                                        onChange={(e) =>
                                            updateRange(idx, "endMin", inputValueToMinutes(e.target.value))
                                        }
                                        onBlur={mergeRangesNow}
                                        aria-label={`Close time for range ${idx + 1}`}
                                    />
                                </div>

                                <div className="flex items-center">
                                    {draft.ranges.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeRange(idx)}
                                            aria-label={`Remove range ${idx + 1}`}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div>
                            <Button type="button" variant="link" className="px-0" onClick={addRange}>
                                Add hours
                            </Button>
                            <div className="text-xs text-muted-foreground">
                                Overnight is supported (e.g., 9:00 PM–2:00 AM). Overlapping or touching ranges
                                are merged automatically within a day.
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
                {!error && !validation.ok && (
                    <div className="mt-2 text-sm text-muted-foreground">{validation.message}</div>
                )}

                <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => onOpenChangeAction(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={!validation.ok}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}