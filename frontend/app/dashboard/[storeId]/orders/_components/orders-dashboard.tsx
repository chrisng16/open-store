"use client";

import { DataTable } from "@/components/dashboard/common/data-table";
import { DataTableColumnHeader } from "@/components/dashboard/common/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
    CalendarDays,
    Calendar as CalendarIcon,
    FilterX,
    Mail,
    Package2,
    Phone,
    RefreshCw,
    Search,
    X
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

type StoreSummary = {
    id: string;
    name: string;
    slug: string;
};

type OrderStatus =
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";

type OrderItemOption = {
    id: string;
    optionName: string;
    quantity: number;
    unitAmount: number;
};

type OrderItem = {
    id: string;
    productName: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    options: OrderItemOption[];
};

type Order = {
    id: string;
    orderNumber: number;
    status: OrderStatus;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    decimalPlaces: number;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    notes: string | null;
    items: OrderItem[];
    createdAt: string;
    updatedAt: string;
};

type RangePreset =
    | "all"
    | "today"
    | "yesterday"
    | "last7"
    | "last14"
    | "last30"
    | "weekToDate"
    | "monthToDate"
    | "custom";

type OrdersFilters = {
    range: RangePreset;
    from: string | null;
    to: string | null;
    statuses: OrderStatus[];
    q: string;
};

type SearchParamsReader = {
    get(name: string): string | null;
};

const STATUS_OPTIONS: OrderStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
];

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
    { value: "all", label: "All" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "weekToDate", label: "Week to date" },
    { value: "monthToDate", label: "Month to date" },
    { value: "last7", label: "Last 7" },
    { value: "last14", label: "Last 14" },
    { value: "last30", label: "Last 30" },
    { value: "custom", label: "Custom" },
];

const DEFAULT_RANGE: RangePreset = "today";

function parseOrdersFilters(searchParams: SearchParamsReader): OrdersFilters {
    const rawRange = searchParams.get("range");
    const range = RANGE_OPTIONS.some((option) => option.value === rawRange)
        ? (rawRange as RangePreset)
        : DEFAULT_RANGE;

    const from = normalizeDateInput(searchParams.get("from"));
    const to = normalizeDateInput(searchParams.get("to"));
    const q = (searchParams.get("q") ?? "").trim();
    const statuses = (searchParams.get("status") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is OrderStatus => STATUS_OPTIONS.includes(value as OrderStatus));

    return {
        range,
        from,
        to,
        statuses,
        q,
    };
}

function normalizeDateInput(value: string | null) {
    if (!value) {
        return null;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseDateString(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
}

function getDateRange(filters: OrdersFilters) {
    const today = startOfDay(new Date());

    if (filters.range === "all") {
        return { start: null, endExclusive: null };
    }

    if (filters.range === "today") {
        return { start: today, endExclusive: addDays(today, 1) };
    }

    if (filters.range === "yesterday") {
        const yesterday = addDays(today, -1);
        return { start: yesterday, endExclusive: today };
    }

    if (filters.range === "last7") {
        return { start: addDays(today, -6), endExclusive: addDays(today, 1) };
    }

    if (filters.range === "last14") {
        return { start: addDays(today, -13), endExclusive: addDays(today, 1) };
    }

    if (filters.range === "last30") {
        return { start: addDays(today, -29), endExclusive: addDays(today, 1) };
    }

    if (filters.range === "weekToDate") {
        const day = today.getDay();
        const offsetToMonday = (day + 6) % 7;
        return { start: addDays(today, -offsetToMonday), endExclusive: addDays(today, 1) };
    }

    if (filters.range === "monthToDate") {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart, endExclusive: addDays(today, 1) };
    }

    return {
        start: filters.from ? parseDateString(filters.from) : null,
        endExclusive: filters.to ? addDays(parseDateString(filters.to), 1) : null,
    };
}

function formatCurrency(amount: number, currency = "USD", decimalPlaces = 2) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    }).format(amount / Math.pow(10, decimalPlaces));
}

function formatStatusLabel(status: OrderStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusBadgeClassName(status: OrderStatus) {
    switch (status) {
        case "pending":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "confirmed":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "preparing":
            return "border-indigo-200 bg-indigo-50 text-indigo-700";
        case "ready":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "completed":
            return "border-zinc-200 bg-zinc-100 text-zinc-700";
        case "cancelled":
            return "border-rose-200 bg-rose-50 text-rose-700";
        default:
            return "border-border bg-muted text-foreground";
    }
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatRelativeDate(value: string) {
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (Math.abs(diffMinutes) < 60) {
        return formatter.format(-diffMinutes, "minute");
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
        return formatter.format(-diffHours, "hour");
    }

    const diffDays = Math.round(diffHours / 24);
    return formatter.format(-diffDays, "day");
}

function getRangeSummary(filters: OrdersFilters) {
    if (filters.range === "all") {
        return "All orders";
    }

    if (filters.range === "today") {
        return "Today";
    }

    if (filters.range === "yesterday") {
        return "Yesterday";
    }

    if (filters.range === "last7") {
        return "Last 7 days";
    }

    if (filters.range === "last14") {
        return "Last 14 days";
    }

    if (filters.range === "last30") {
        return "Last 30 days";
    }

    if (filters.range === "weekToDate") {
        return "Week to date";
    }

    if (filters.range === "monthToDate") {
        return "Month to date";
    }

    if (filters.from && filters.to && filters.from === filters.to) {
        return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parseDateString(filters.from));
    }

    if (filters.from && filters.to) {
        return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parseDateString(filters.from))} to ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parseDateString(filters.to))}`;
    }

    if (filters.from) {
        return `From ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parseDateString(filters.from))}`;
    }

    if (filters.to) {
        return `Up to ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parseDateString(filters.to))}`;
    }

    return "Custom range";
}

function formatCompactDate(value: string) {
    const date = parseDateString(value);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

function formatMonthYear(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
    }).format(date);
}

function isSameDay(left: Date, right: Date) {
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
}

function isToday(date: Date) {
    return isSameDay(date, startOfDay(new Date()));
}

function isYesterday(date: Date) {
    return isSameDay(date, addDays(startOfDay(new Date()), -1));
}

function isFullMonthRange(from: Date, to: Date) {
    if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) {
        return false;
    }

    if (from.getDate() !== 1) {
        return false;
    }

    const lastDayOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    return to.getDate() === lastDayOfMonth;
}

function formatSingleDayLabel(date: Date) {
    if (isToday(date)) {
        return "Today";
    }

    if (isYesterday(date)) {
        return "Yesterday";
    }

    return formatCompactDate(formatDateParam(date));
}

function getRangeTriggerLabel(filters: OrdersFilters) {
    if (filters.range === "today") {
        return "Today";
    }

    if (filters.range === "yesterday") {
        return "Yesterday";
    }

    if (filters.range !== "custom") {
        return getRangeSummary(filters);
    }

    if (filters.from && filters.to) {
        const fromDate = parseDateString(filters.from);
        const toDate = parseDateString(filters.to);

        if (isSameDay(fromDate, toDate)) {
            return formatSingleDayLabel(fromDate);
        }

        if (isFullMonthRange(fromDate, toDate)) {
            return formatMonthYear(fromDate);
        }

        return `${formatCompactDate(filters.from)} - ${formatCompactDate(filters.to)}`;
    }

    if (filters.from) {
        return formatSingleDayLabel(parseDateString(filters.from));
    }

    if (filters.to) {
        return formatSingleDayLabel(parseDateString(filters.to));
    }

    return "Custom range";
}

function formatDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function useDebouncedValue<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [delay, value]);

    return debouncedValue;
}

function buildOrdersQueryParams(filters: OrdersFilters): URLSearchParams {
    const params = new URLSearchParams();
    params.set("limit", "500");

    const { start, endExclusive } = getDateRange(filters);
    if (start) {
        params.set("created_from", formatDateParam(start));
    }
    if (endExclusive) {
        const lastDay = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
        params.set("created_to", formatDateParam(lastDay));
    }
    if (filters.statuses.length > 0) {
        params.set("status", filters.statuses.join(","));
    }
    if (filters.q.trim()) {
        params.set("q", filters.q.trim());
    }
    return params;
}

function buildFiltersSearchParams(filters: OrdersFilters): URLSearchParams {
    const params = new URLSearchParams();

    params.set("range", filters.range);

    if (filters.range === "custom") {
        if (filters.from) {
            params.set("from", filters.from);
        }

        if (filters.to) {
            params.set("to", filters.to);
        }
    }

    if (filters.statuses.length > 0) {
        params.set("status", filters.statuses.join(","));
    }

    if (filters.q) {
        params.set("q", filters.q);
    }

    return params;
}

function areFiltersEqual(left: OrdersFilters, right: OrdersFilters) {
    return (
        left.range === right.range &&
        left.from === right.from &&
        left.to === right.to &&
        left.q === right.q &&
        left.statuses.length === right.statuses.length &&
        left.statuses.every((status, index) => status === right.statuses[index])
    );
}

function getOrdersTableColumns({
    onUpdateStatus,
    updatingOrderId,
}: {
    onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
    updatingOrderId: string | null;
}): ColumnDef<Order>[] {
    return [
        {
            accessorKey: "orderNumber",
            size: 96,
            minSize: 88,
            maxSize: 108,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Order" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <span
                    className="h-auto px-0 py-0 font-semibold"
                >
                    #{row.original.orderNumber}
                </span>
            ),
        },
        {
            id: "customer",
            accessorFn: (order) =>
                `${order.customerName ?? ""} ${order.customerEmail ?? ""} ${order.customerPhone ?? ""}`,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Customer" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="font-medium">{row.original.customerName || "Walk-in order"}</div>
                    <div className="text-xs text-muted-foreground">
                        {row.original.customerEmail || row.original.customerPhone || "No contact details"}
                    </div>
                </div>
            ),
        },
        {
            id: "items",
            accessorFn: (order) => order.items.map((item) => item.productName).join(", "),
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Items" className="-ml-3" />
            ),
            cell: ({ row }) => {
                const visibleItems = row.original.items.slice(0, 2);
                const remaining = row.original.items.length - visibleItems.length;

                return (
                    <div className="max-w-70 space-y-1">
                        {visibleItems.map((item) => (
                            <div key={item.id} className="truncate text-sm text-foreground">
                                {item.quantity}x {item.productName}
                            </div>
                        ))}
                        {remaining > 0 ? (
                            <div className="text-xs text-muted-foreground">+{remaining} more item{remaining === 1 ? "" : "s"}</div>
                        ) : null}
                    </div>
                );
            },
        },
        {
            accessorKey: "totalAmount",
            size: 112,
            minSize: 100,
            maxSize: 124,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <div className="font-medium">
                    {formatCurrency(
                        row.original.totalAmount,
                        row.original.currency,
                        row.original.decimalPlaces
                    )}
                </div>
            ),
        },
        {
            accessorKey: "createdAt",
            size: 172,
            minSize: 160,
            maxSize: 190,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Placed" className="-ml-3" />
            ),
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="text-sm font-medium">{formatRelativeDate(row.original.createdAt)}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</div>
                </div>
            ),
        },
        {
            accessorKey: "status",
            size: 188,
            minSize: 176,
            maxSize: 216,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Status" className="-ml-3" />
            ),
            cell: ({ row }) => {
                const isUpdating = updatingOrderId === row.original.id;

                return (
                    <div className="space-y-2">
                        <Select
                            value={row.original.status}
                            onValueChange={(value) => onUpdateStatus(row.original.id, value as OrderStatus)}
                            disabled={isUpdating}
                        >
                            <SelectTrigger className="h-8 w-full min-w-33">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {formatStatusLabel(status)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            },
        },
    ];
}

function OrderDetailsSheet({
    order,
    onOpenChange,
}: {
    order: Order | null;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Sheet open={!!order} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
                {order ? (
                    <>
                        <SheetHeader className="border-b px-6 py-5">
                            <div className="flex items-start justify-between gap-4 pr-8">
                                <div className="space-y-2">
                                    <SheetTitle className="text-xl">Order #{order.orderNumber}</SheetTitle>
                                    <SheetDescription>
                                        Placed {formatDateTime(order.createdAt)}
                                    </SheetDescription>
                                </div>
                                <Badge variant="outline" className={cn("h-6 px-2", getStatusBadgeClassName(order.status))}>
                                    {formatStatusLabel(order.status)}
                                </Badge>
                            </div>
                        </SheetHeader>
                        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                            <section className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border bg-background px-4 py-3">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                        <Mail className="size-4 text-muted-foreground" /> Customer
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <div className="font-medium text-foreground">
                                            {order.customerName || "Walk-in order"}
                                        </div>
                                        <div>{order.customerEmail || "No email provided"}</div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="size-3.5" />
                                            <span>{order.customerPhone || "No phone provided"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-md border bg-background px-4 py-3">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                        <CalendarDays className="size-4 text-muted-foreground" /> Activity
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <div>Created: {formatDateTime(order.createdAt)}</div>
                                        <div>Updated: {formatDateTime(order.updatedAt)}</div>
                                        <div>Queue state: {formatStatusLabel(order.status)}</div>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Package2 className="size-4 text-muted-foreground" /> Items
                                </div>
                                <div className="space-y-3">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="rounded-md border bg-background px-4 py-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="font-medium">
                                                        {item.quantity}x {item.productName}
                                                    </div>
                                                    {item.options.length > 0 ? (
                                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                            {item.options.map((option) => (
                                                                <div key={option.id}>
                                                                    {option.quantity}x {option.optionName}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div className="text-sm font-medium">
                                                    {formatCurrency(item.totalAmount, order.currency, order.decimalPlaces)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {order.notes ? (
                                <section className="space-y-2 rounded-md border bg-background px-4 py-3">
                                    <div className="text-sm font-medium">Notes</div>
                                    <div className="text-sm text-muted-foreground">{order.notes}</div>
                                </section>
                            ) : null}

                            <section className="space-y-2 rounded-md border bg-background px-4 py-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(order.subtotalAmount, order.currency, order.decimalPlaces)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span>{formatCurrency(order.taxAmount, order.currency, order.decimalPlaces)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                                    <span>Total</span>
                                    <span>{formatCurrency(order.totalAmount, order.currency, order.decimalPlaces)}</span>
                                </div>
                            </section>
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

function OrdersSubNav({
    storeName,
    storeSlug,
    filters,
    filteredOrders,
    hasNonDefaultFilters,
    onSearchChange,
    onSetRange,
    onSetCustomRange,
    onSetStatusTab,
    onClearFilters,
    onRefresh,
    isRefreshing,
}: {
    storeName: string | undefined;
    storeSlug: string | undefined;
    filters: OrdersFilters;
    filteredOrders: number;
    hasNonDefaultFilters: boolean;
    onSearchChange: (value: string) => void;
    onSetRange: (range: RangePreset) => void;
    onSetCustomRange: (from: string, to: string) => void;
    onSetStatusTab: (value: "all" | OrderStatus) => void;
    onClearFilters: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}) {
    const activeStatusTab: "all" | OrderStatus =
        filters.statuses.length === 1 ? filters.statuses[0] : "all";

    const selectedCalendarRange: DateRange | undefined = useMemo(() => {
        const { start, endExclusive } = getDateRange(filters);
        const today = startOfDay(new Date());

        if (!start) {
            return { from: today, to: today };
        }

        const to = endExclusive ? addDays(endExclusive, -1) : start;
        return { from: start, to };
    }, [filters]);

    const defaultCalendarMonth = useMemo(() => {
        const anchorDate = selectedCalendarRange?.to ?? selectedCalendarRange?.from ?? new Date();
        return new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1);
    }, [selectedCalendarRange]);

    function handleCalendarSelect(range: DateRange | undefined) {
        if (!range?.from) {
            onSetRange(DEFAULT_RANGE);
            return;
        }

        const from = formatDateParam(range.from);
        const to = formatDateParam(range.to ?? range.from);
        onSetCustomRange(from, to);
    }

    const datePresetOptions = RANGE_OPTIONS.filter(
        (option) => !["custom", "all", "today", "yesterday"].includes(option.value)
    );
    const triggerRangeLabel = getRangeTriggerLabel(filters);

    return (
        <div className="rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between gap-4 w-full px-5 pt-3">
                <div className="flex items-center shrink-0 gap-4">
                    <span className="text-base font-semibold">Orders Center</span>
                    <Tabs
                        value={activeStatusTab}
                        onValueChange={(value) => onSetStatusTab(value as "all" | OrderStatus)}
                    >
                        <TabsList className="bg-background">
                            <TabsTrigger value="all" className="h-8 px-2 text-xs">All</TabsTrigger>
                            {STATUS_OPTIONS.map((status) => (
                                <TabsTrigger key={status} value={status} className="h-8 px-2 text-xs">
                                    {formatStatusLabel(status)}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                <div>
                    {hasNonDefaultFilters ? (
                        <Button variant="ghost" size="sm" onClick={onClearFilters}>
                            <FilterX className="size-4" /> Reset
                        </Button>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        title="Refresh orders"
                    >
                        <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-3">
                <InputGroup className="hidden h-8 w-72 lg:flex rounded-full">
                    <InputGroupAddon align="inline-start">
                        <InputGroupText>
                            <Search className="size-4" />
                        </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                        value={filters.q}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search order, customer, phone"
                    />
                </InputGroup>

                {/* Date Selector Popover */}
                <div className="flex items-center gap-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-full active:scale-98 pr-2">
                                <CalendarIcon className="size-4" />
                                <span className="max-w-40 truncate">{triggerRangeLabel}</span>
                                {filters.range !== DEFAULT_RANGE ? (
                                    <span
                                        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        role="button"
                                        aria-label="Reset date range"
                                        title="Reset date range"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            onSetRange(DEFAULT_RANGE);
                                        }}
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                    >
                                        <X className="size-3.5" />
                                    </span>
                                ) : null}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-auto p-0 bg-background-elevated-2">
                            <div className="grid md:grid-cols-[150px_1fr]">
                                <div className="border-b p-2 md:border-b-0 md:border-r">
                                    <div>
                                        {datePresetOptions.map((option) => (
                                            <Button
                                                key={option.value}
                                                variant={filters.range === option.value ? "secondary" : "ghost"}
                                                className="w-full justify-start rounded-sm"
                                                size={'sm'}
                                                onClick={() => onSetRange(option.value)}
                                            >
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-2">
                                    <Calendar
                                        mode="range"
                                        numberOfMonths={2}
                                        selected={selectedCalendarRange}
                                        onSelect={handleCalendarSelect}
                                        defaultMonth={defaultCalendarMonth}
                                        disabled={{ after: new Date() }}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}

export function OrdersDashboard({ storeId }: { storeId: string }) {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const urlFilters = useMemo(() => parseOrdersFilters(searchParams), [searchParams]);
    const [filters, setFilters] = useState<OrdersFilters>(urlFilters);
    const debouncedSearchQuery = useDebouncedValue(filters.q, 250);
    const queryFilters = useMemo(
        () => ({
            ...filters,
            q: debouncedSearchQuery,
        }),
        [debouncedSearchQuery, filters]
    );
    const deferredFilters = useDeferredValue(queryFilters);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

    useEffect(() => {
        setFilters((current) => (areFiltersEqual(current, urlFilters) ? current : urlFilters));
    }, [urlFilters]);

    const storeQuery = useQuery({
        queryKey: ["store", storeId],
        queryFn: async () => fetchWithAccessToken<StoreSummary>(`/stores/${storeId}`),
        enabled: !!storeId,
        staleTime: 5 * 60 * 1000,
    });

    const ordersQuery = useQuery({
        queryKey: [
            "orders",
            storeId,
            {
                status: deferredFilters.statuses.join(","),
                range: deferredFilters.range,
                from: deferredFilters.from,
                to: deferredFilters.to,
                q: deferredFilters.q,
            },
        ],
        queryFn: async () => {
            const params = buildOrdersQueryParams(deferredFilters);
            return fetchWithAccessToken<Order[]>(`/stores/${storeId}/orders?${params}`);
        },
        enabled: !!storeId,
        refetchInterval: 30_000,
        refetchIntervalInBackground: true,
        placeholderData: (previousData) => previousData,
    });

    function updateFilters(mutator: (current: OrdersFilters) => OrdersFilters) {
        const nextFilters = mutator(filters);

        if (areFiltersEqual(filters, nextFilters)) {
            return;
        }

        setFilters(nextFilters);

        const nextQuery = buildFiltersSearchParams(nextFilters).toString();

        startTransition(() => {
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        });
    }

    function setSearchQuery(value: string) {
        updateFilters((current) => ({
            ...current,
            q: value,
        }));
    }

    function setRange(range: RangePreset) {
        updateFilters((current) => ({
            ...current,
            range,
            from: range === "custom" ? current.from : null,
            to: range === "custom" ? current.to : null,
        }));
    }

    function setCustomRange(from: string, to: string) {
        updateFilters((current) => ({
            ...current,
            range: "custom",
            from,
            to,
        }));
    }

    function setStatusTab(status: "all" | OrderStatus) {
        updateFilters((current) => ({
            ...current,
            statuses: status === "all" ? [] : [status],
        }));
    }

    function clearFilters() {
        updateFilters(() => ({
            range: DEFAULT_RANGE,
            from: null,
            to: null,
            statuses: [],
            q: "",
        }));
    }

    const allOrders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
    const selectedOrder = useMemo(
        () => allOrders.find((order) => order.id === selectedOrderId) ?? null,
        [allOrders, selectedOrderId]
    );

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: OrderStatus }) => {
            return fetchWithAccessToken<Order>(`/stores/${storeId}/orders/${orderId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(denormalizeRequest({ status: newStatus })),
            });
        },
        onMutate: async ({ orderId, newStatus }) => {
            setUpdatingOrderId(orderId);
            await queryClient.cancelQueries({ queryKey: ["orders", storeId] });

            const previousOrders = queryClient.getQueryData<Order[]>(["orders", storeId]) ?? [];
            queryClient.setQueryData<Order[]>(["orders", storeId], (current = []) =>
                current.map((order) =>
                    order.id === orderId
                        ? {
                            ...order,
                            status: newStatus,
                        }
                        : order
                )
            );

            return { previousOrders };
        },
        onError: (error, _variables, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["orders", storeId], context.previousOrders);
            }
            toast.error(error instanceof Error ? error.message : "Failed to update order status");
        },
        onSuccess: (order) => {
            toast.success(`Order #${order.orderNumber} marked ${formatStatusLabel(order.status).toLowerCase()}`);
        },
        onSettled: async () => {
            setUpdatingOrderId(null);
            await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
        },
    });

    const columns = useMemo(
        () =>
            getOrdersTableColumns({
                onUpdateStatus: (orderId, newStatus) => {
                    updateStatusMutation.mutate({ orderId, newStatus });
                },
                updatingOrderId,
            }),
        [updateStatusMutation, updatingOrderId]
    );

    const hasNonDefaultFilters =
        filters.range !== DEFAULT_RANGE || filters.statuses.length > 0 || filters.q.length > 0;

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <OrdersSubNav
                storeName={storeQuery.data?.name}
                storeSlug={storeQuery.data?.slug}
                filters={filters}
                filteredOrders={allOrders.length}
                hasNonDefaultFilters={hasNonDefaultFilters}
                onSearchChange={setSearchQuery}
                onSetRange={setRange}
                onSetCustomRange={setCustomRange}
                onSetStatusTab={setStatusTab}
                onClearFilters={clearFilters}
                onRefresh={() => ordersQuery.refetch()}
                isRefreshing={ordersQuery.isFetching}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="flex min-h-full flex-1 flex-col gap-4 px-4">
                    <div className="min-h-96 flex-1 overflow-hidden">
                        <DataTable
                            columns={columns}
                            data={allOrders}
                            isLoading={ordersQuery.isPending}
                            loadingText="Loading orders..."
                            enableDefaultActionBar={false}
                            showDefaultSearch={false}
                            showViewOptions={false}
                            defaultPageSize={20}
                            getRowId={(order) => order.id}
                            emptyTitle={hasNonDefaultFilters ? "No orders match this view" : "No orders yet"}
                            emptyDescription={
                                hasNonDefaultFilters
                                    ? "Adjust the day, status, or search filters to widen the view."
                                    : "Orders will appear here when customers start checking out."
                            }
                            emptyAction={
                                hasNonDefaultFilters ? (
                                    <Button variant="outline" size="sm" onClick={clearFilters}>
                                        <FilterX className="size-4" /> Clear filters
                                    </Button>
                                ) : null
                            }
                            onRowClick={(order) => setSelectedOrderId(order.id)}
                        />
                    </div>
                </div>
            </div>

            <OrderDetailsSheet order={selectedOrder} onOpenChange={(open) => !open && setSelectedOrderId(null)} />
        </div>
    );
}