// components/dashboard/stores/business-hours/time-utils.ts
export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type TimeRange = { startMin: number; endMin: number }; // [startMin, endMin)

export type DayHours =
    | { status: "closed" }
    | { status: "open24" }
    | { status: "ranges"; ranges: TimeRange[] };

export type WeekHours = Record<DayKey, DayHours>;

export const DAY_ORDER: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DAY_LABELS: Record<DayKey, string> = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
};

export const DAY_CHIPS: Record<DayKey, string> = {
    sun: "S",
    mon: "M",
    tue: "T",
    wed: "W",
    thu: "T",
    fri: "F",
    sat: "S",
};

export function getNextDay(day: DayKey): DayKey {
    const idx = DAY_ORDER.indexOf(day);
    return DAY_ORDER[(idx + 1) % DAY_ORDER.length];
}

export function getPrevDay(day: DayKey): DayKey {
    const idx = DAY_ORDER.indexOf(day);
    return DAY_ORDER[(idx - 1 + DAY_ORDER.length) % DAY_ORDER.length];
}

export function clampMinutes(min: number) {
    if (Number.isNaN(min)) return 0;
    return Math.max(0, Math.min(1440, min));
}

export function inputValueToMinutes(v: string): number {
    // "HH:MM" => minutes
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return NaN;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
    return hh * 60 + mm;
}

export function minutesToInputValue(min: number): string {
    // IMPORTANT: <input type="time"> only supports 00:00–23:59.
    // Return an empty string for non-finite values so inputs can be blank.
    if (!Number.isFinite(min)) return "";
    let m = clampMinutes(min);
    if (m >= 1440) m = 1439;

    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function minutesToTimeLabel(min: number): string {
    let m = clampMinutes(min);
    // Display 1440 as 12:00 AM (end-of-day); usually you won’t use start=1440.
    if (m === 1440) m = 0;

    const hh24 = Math.floor(m / 60);
    const mm = m % 60;

    const ampm = hh24 >= 12 ? "PM" : "AM";
    let hh12 = hh24 % 12;
    if (hh12 === 0) hh12 = 12;

    return `${hh12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/**
 * Sort + merge ranges.
 *
 * By default we merge overlapping OR touching ranges (next.startMin <= last.endMin)
 * which matches the "within a day" UX (e.g., 9:00–12:00 plus 12:00–17:00 becomes 9:00–17:00).
 *
 * For cross-day merges (overnight spillover into the next day), merging *touching* ranges can
 * produce surprising displays: e.g., a spillover [00:00–02:00] touching a separate range
 * [02:00–17:30] would become [00:00–17:30], causing the previous day to appear open until 5:30 PM.
 * In those cases, set `mergeTouching` to false so only *overlaps* merge.
 */
export function normalizeAndMergeRanges(
    ranges: TimeRange[],
    opts: { mergeTouching?: boolean } = {}
): TimeRange[] {
    const mergeTouching = opts.mergeTouching ?? true;

    const cleaned = ranges
        .map((r) => ({
            startMin: clampMinutes(r.startMin),
            endMin: clampMinutes(r.endMin),
        }))
        .filter((r) => Number.isFinite(r.startMin) && Number.isFinite(r.endMin))
        .filter((r) => r.startMin < r.endMin);

    cleaned.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

    const merged: TimeRange[] = [];
    for (const r of cleaned) {
        if (merged.length === 0) {
            merged.push({ ...r });
            continue;
        }
        const last = merged[merged.length - 1];
        const shouldMerge = mergeTouching ? r.startMin <= last.endMin : r.startMin < last.endMin;
        if (shouldMerge) {
            last.endMin = Math.max(last.endMin, r.endMin);
        } else {
            merged.push({ ...r });
        }
    }
    return merged;
}

export function formatDayHours(day: DayHours): string {
    if (day.status === "closed") return "Closed";
    if (day.status === "open24") return "Open 24 hours";
    const merged = normalizeAndMergeRanges(day.ranges);
    if (merged.length === 0) return "Closed";
    return merged
        .map((r) => `${minutesToTimeLabel(r.startMin)} - ${minutesToTimeLabel(r.endMin)}`)
        .join(", ");
}

export function formatDayHoursForSelector(week: WeekHours, dayKey: DayKey): string {
    const day = week[dayKey];
    if (day.status === "closed") return "Closed";
    if (day.status === "open24") return "Open 24 hours";

    const todayRanges = day.status === "ranges" ? normalizeAndMergeRanges(day.ranges) : [];
    if (todayRanges.length === 0) return "Closed";

    // Hide midnight-start segments if they are spillover from the previous day.
    const prevKey = getPrevDay(dayKey);
    const prev = week[prevKey];
    const prevRanges = prev.status === "ranges" ? normalizeAndMergeRanges(prev.ranges) : [];
    const prevHasEndOfDay = prevRanges.some((r) => r.endMin === 1440);
    const todayHasMidnightStart = todayRanges.some((r) => r.startMin === 0);

    if (prevHasEndOfDay && todayHasMidnightStart) {
        const filtered = todayRanges.filter((r) => r.startMin !== 0);
        if (filtered.length === 0) return "Closed";
        return filtered
            .map((r) => `${minutesToTimeLabel(r.startMin)} - ${minutesToTimeLabel(r.endMin)}`)
            .join(", ");
    }

    // Otherwise, collapse overnight spillover that continues into the next day.
    const nextKey = getNextDay(dayKey);
    const next = week[nextKey];
    const nextRanges = next.status === "ranges" ? normalizeAndMergeRanges(next.ranges) : [];

    const endOfDayRange = todayRanges.find((r) => r.endMin === 1440) ?? null;
    const startOfDayRange = nextRanges.find((r) => r.startMin === 0) ?? null;

    if (endOfDayRange && startOfDayRange) {
        const parts: string[] = [];
        for (const r of todayRanges) {
            if (r.startMin === endOfDayRange.startMin && r.endMin === 1440) {
                parts.push(
                    `${minutesToTimeLabel(r.startMin)} - ${minutesToTimeLabel(startOfDayRange.endMin)} (next day)`
                );
            } else {
                parts.push(`${minutesToTimeLabel(r.startMin)} - ${minutesToTimeLabel(r.endMin)}`);
            }
        }
        return parts.join(", ");
    }

    return todayRanges
        .map((r) => `${minutesToTimeLabel(r.startMin)} - ${minutesToTimeLabel(r.endMin)}`)
        .join(", ");
}

export function isSameDayHours(a: DayHours, b: DayHours): boolean {
    if (a.status !== b.status) return false;
    if (a.status === "closed" || a.status === "open24") return true;
    if (a.status !== "ranges" || b.status !== "ranges") return false;
    const ar = normalizeAndMergeRanges(a.ranges);
    const br = normalizeAndMergeRanges(b.ranges);
    if (ar.length !== br.length) return false;
    for (let i = 0; i < ar.length; i++) {
        if (ar[i].startMin !== br[i].startMin || ar[i].endMin !== br[i].endMin) return false;
    }
    return true;
}


export const defaultWeekHours: WeekHours = {
    sun: { status: "closed" },
    mon: { status: "ranges", ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] },
    tue: { status: "ranges", ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] },
    wed: { status: "ranges", ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] },
    thu: { status: "ranges", ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] },
    fri: { status: "ranges", ranges: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }] },
    sat: { status: "closed" },
};
