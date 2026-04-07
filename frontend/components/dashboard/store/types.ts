import type { BusinessDayHours, Store } from "@/lib/types";

import { DAY_ORDER, defaultWeekHours, type DayHours, type DayKey, type WeekHours } from "@/components/dashboard/store/time-utils";

export type FormDirtyState = {
    isDirty: boolean;
    isSubmitting: boolean;
};

export type StoreFormMode = "create" | "edit";

export type StoreEditFormValues = {
    name: string;
    description: string;
    address: string;
    phone: string;
    slug: string;
    timezone: string;
    businessHours: WeekHours;
};

function cloneDayHours(day: DayHours): DayHours {
    if (day.status === "ranges") {
        return {
            status: "ranges",
            ranges: day.ranges.map((range) => ({ ...range })),
        };
    }
    return { ...day };
}

function normalizeDayHours(day?: BusinessDayHours | null): DayHours {
    if (!day || day.status === "closed") {
        return { status: "closed" };
    }

    if (day.status === "open24") {
        return { status: "open24" };
    }

    const ranges = (day.ranges ?? [])
        .filter((range) => Number.isFinite(range.startMin) && Number.isFinite(range.endMin))
        .map((range) => ({
            startMin: range.startMin,
            endMin: range.endMin,
        }));

    return ranges.length ? { status: "ranges", ranges } : { status: "closed" };
}

export function normalizeStoreBusinessHours(
    businessHours?: Store["businessHours"]
): WeekHours {
    if (!businessHours) {
        return { ...defaultWeekHours };
    }

    const normalized = {} as WeekHours;

    for (const day of DAY_ORDER) {
        const dayKey = day as DayKey;
        const fallback = defaultWeekHours[dayKey];
        const source = businessHours[dayKey];
        normalized[dayKey] = source
            ? normalizeDayHours(source)
            : cloneDayHours(fallback);
    }

    return normalized;
}
