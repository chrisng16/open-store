"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTypedFormContext } from "@/lib/form-context";
import { Plus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeSlot = {
    from: string; // "HH:MM" 24-hour
    to: string;   // "HH:MM" 24-hour
};

export type DayHours = {
    enabled: boolean;
    open24Hours: boolean;
    slots: TimeSlot[];
};

export type BusinessHours = {
    [day: string]: DayHours;
};

export const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const;

export type Day = (typeof DAYS)[number];

export const DEFAULT_BUSINESS_HOURS: BusinessHours = Object.fromEntries(
    DAYS.map((day) => [
        day,
        { enabled: false, open24Hours: false, slots: [{ from: "09:00", to: "17:00" }] },
    ])
);

// ─── Sub-component: single day row ────────────────────────────────────────────

interface DayRowProps {
    day: Day;
    hours: DayHours;
    onChange: (updated: DayHours) => void;
}

function DayRow({ day, hours, onChange }: DayRowProps) {
    const { enabled, open24Hours, slots } = hours;

    const setEnabled = (val: boolean) => onChange({ ...hours, enabled: val });
    const setOpen24 = (val: boolean) => onChange({ ...hours, open24Hours: val });

    const updateSlot = (index: number, field: keyof TimeSlot, value: string) => {
        const updated = slots.map((s, i) =>
            i === index ? { ...s, [field]: value } : s
        );
        onChange({ ...hours, slots: updated });
    };

    const addSlot = () =>
        onChange({ ...hours, slots: [...slots, { from: "09:00", to: "17:00" }] });

    const removeSlot = (index: number) =>
        onChange({ ...hours, slots: slots.filter((_, i) => i !== index) });

    return (
        <div
            className={`rounded-md border transition-all duration-200 ${enabled
                ? "border-border bg-card shadow-sm"
                : "border-border/40 bg-muted/30"
                }`}
        >
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3">
                <span
                    className={`text-sm font-medium transition-colors ${enabled ? "text-foreground" : "text-muted-foreground"
                        }`}
                >
                    {day}
                </span>
                <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    aria-label={`Toggle ${day}`}
                />
            </div>

            {/* Expanded content */}
            {enabled && (
                <div className="border-t border-border/60 px-4 pb-3 pt-3 space-y-3">
                    {/* 24h toggle */}
                    <div className="flex items-center gap-2">
                        <Switch
                            id={`${day}-24h`}
                            checked={open24Hours}
                            onCheckedChange={setOpen24}
                            aria-label={`${day} open 24 hours`}
                        />
                        <Label
                            htmlFor={`${day}-24h`}
                            className="text-xs text-muted-foreground cursor-pointer select-none"
                        >
                            Open 24 hours
                        </Label>
                    </div>

                    {!open24Hours ? (
                        <>
                            <div className="space-y-2">
                                {slots.map((slot, index) => (
                                    <div key={index} className="flex items-center gap-2">

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground pl-2">From</span>
                                            <Input
                                                type="time"
                                                value={slot.from}
                                                onChange={(e) => updateSlot(index, "from", e.target.value)}
                                                className="h-8 w-24 shrink-0 text-sm tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                                aria-label={`${day} slot ${index + 1} from`}
                                                step={900}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground pl-2">To</span>
                                            <Input
                                                type="time"
                                                value={slot.to}
                                                onChange={(e) => updateSlot(index, "to", e.target.value)}
                                                className="h-8 w-24 shrink-0 text-sm tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                                aria-label={`${day} slot ${index + 1} to`}
                                                step={900}
                                            />
                                        </div>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeSlot(index)}
                                            disabled={slots.length === 1}
                                            aria-label={`Remove slot ${index + 1} for ${day}`}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                                onClick={addSlot}
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Add More
                            </Button>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">
                            Open all day — no time restrictions
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * BusinessHoursForm
 *
 * Drop this inside any form that was created with useAppForm() from
 * @/lib/form-context and wrapped in <form.AppForm>.
 *
 * The parent's defaultValues must include:
 *   businessHours: DEFAULT_BUSINESS_HOURS
 */
export function BusinessHoursForm() {
    const form = useTypedFormContext<{ businessHours: BusinessHours }>();

    return (
        <form.Field name="businessHours">
            {(field) => {
                const hours: BusinessHours =
                    (field.state.value as BusinessHours) ?? DEFAULT_BUSINESS_HOURS;

                const handleDayChange = (day: Day, updated: DayHours) =>
                    field.handleChange({ ...hours, [day]: updated });

                return (
                    <div className="space-y-2">
                        <Label>Business Hours</Label>
                        <div className="space-y-2">
                            {DAYS.map((day) => (
                                <DayRow
                                    key={day}
                                    day={day}
                                    hours={hours[day] ?? DEFAULT_BUSINESS_HOURS[day]}
                                    onChange={(updated) => handleDayChange(day, updated)}
                                />
                            ))}
                        </div>
                    </div>
                );
            }}
        </form.Field>
    );
}