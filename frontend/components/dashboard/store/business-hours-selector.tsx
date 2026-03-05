// components/dashboard/stores/business-hours/business-hours-selector.tsx
"use client";

import { Pencil } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { HoursEditDialog } from "@/components/dashboard/store/hours-edit-dialog";
import type { DayKey, WeekHours } from "@/components/dashboard/store/time-utils";
import {
    DAY_LABELS,
    DAY_ORDER,
    formatDayHoursForSelector,
} from "@/components/dashboard/store/time-utils";

type BusinessHoursSelectorProps = {
    hours: WeekHours;
    onChangeAction: (next: WeekHours) => void;
    /** @deprecated No longer needed — TanStack Form tracks dirty state automatically. */
    setFormDirtyAction?: (isDirty: boolean) => void;
    disabled?: boolean;
    className?: string;
};

function daysMonFri(): DayKey[] {
    return ["mon", "tue", "wed", "thu", "fri"];
}

function daysSatSun(): DayKey[] {
    return ["sat", "sun"];
}

export function BusinessHoursSelector(props: BusinessHoursSelectorProps) {
    const { hours, onChangeAction, setFormDirtyAction, disabled, className } = props;

    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [initialSelectedDays, setInitialSelectedDays] = React.useState<DayKey[]>(["mon"]);

    const openForDays = (days: DayKey[]) => {
        setInitialSelectedDays(days);
        setDialogOpen(true);
    };

    return (
        <div className={className}>
            {DAY_ORDER.map((day, idx) => (
                <React.Fragment key={day}>
                    <div className="flex items-center justify-between py-2">
                        <div className="text-sm">{DAY_LABELS[day]}</div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm text-muted-foreground">
                                {formatDayHoursForSelector(hours, day)}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={disabled}
                                onClick={() => openForDays([day])}
                                aria-label={`Edit ${DAY_LABELS[day]}`}
                            >
                                <Pencil />
                            </Button>
                        </div>
                    </div>
                    {idx !== DAY_ORDER.length - 1 && <Separator />}
                </React.Fragment>
            ))}

            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button type="button" variant="outline" disabled={disabled} onClick={() => openForDays(DAY_ORDER)}>
                    Edit all hours
                </Button>
                <Button type="button" variant="outline" disabled={disabled} onClick={() => openForDays(daysMonFri())}>
                    Edit Mon–Fri
                </Button>
                <Button type="button" variant="outline" disabled={disabled} onClick={() => openForDays(daysSatSun())}>
                    Edit Sat–Sun
                </Button>
            </div>

            <HoursEditDialog
                open={dialogOpen}
                onOpenChangeAction={setDialogOpen}
                initialSelectedDays={initialSelectedDays}
                weekHours={hours}
                // TanStack Form tracks dirty state via defaultValues comparison,
                // so we pass a no-op unless a legacy caller still passes the prop.
                setFormDirtyAction={setFormDirtyAction ?? (() => { })}
                onSaveAction={onChangeAction}
            />
        </div>
    );
}