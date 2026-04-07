"use client";

import StoreSubNav from "@/app/dashboard/_components/store-sub-nav";
import { NotAllowedState } from "@/components/dashboard/common/not-allowed-state";
import { Card, CardContent } from "@/components/ui/card";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { AuthFetchError, fetchWithAccessToken } from "@/lib/auth-fetch";
import type { PaginatedResponse } from "@/lib/pagination";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Clock3, ReceiptText, ShoppingBag } from "lucide-react";
import { use } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

import { Store } from "@/lib/types";


type OrderStatus =
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";

type OrderItem = {
    id: string;
    quantity: number;
};

type Order = {
    id: string;
    status: OrderStatus;
    totalAmount: number;
    currency: string;
    decimalPlaces: number;
    items: OrderItem[];
};

type Metrics = {
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
    activeQueueCount: number;
    itemCount: number;
    completedCount: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set<OrderStatus>(["pending", "confirmed", "preparing", "ready"]);

function formatCurrency(amount: number, currency = "USD", decimalPlaces = 2) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    }).format(amount / Math.pow(10, decimalPlaces));
}

function computeMetrics(orders: Order[]): Metrics {
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const itemCount = orders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
        0
    );
    return {
        totalOrders: orders.length,
        totalRevenue,
        averageTicket: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
        activeQueueCount: orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
        itemCount,
        completedCount: orders.filter((o) => o.status === "completed").length,
    };
}

// ─── Metrics display ─────────────────────────────────────────────────────────

function MetricsGrid({
    metrics,
    currency,
    decimalPlaces,
}: {
    metrics: Metrics;
    currency: string;
    decimalPlaces: number;
}) {
    const items = [
        {
            label: "Total orders",
            value: String(metrics.totalOrders),
            meta: `${metrics.completedCount} completed`,
            icon: ShoppingBag,
        },
        {
            label: "Gross sales",
            value: formatCurrency(metrics.totalRevenue, currency, decimalPlaces),
            meta: `${metrics.completedCount} completed orders`,
            icon: CircleDollarSign,
        },
        {
            label: "Average ticket",
            value: formatCurrency(metrics.averageTicket, currency, decimalPlaces),
            meta: `${metrics.itemCount} items total`,
            icon: ReceiptText,
        },
        {
            label: "Active queue",
            value: String(metrics.activeQueueCount),
            meta: "Pending through ready",
            icon: Clock3,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <Card key={item.label} className="gap-0 overflow-hidden border bg-background-elevated/80 py-0">
                    <CardContent className="flex items-start justify-between gap-4 px-5 py-5">
                        <div className="space-y-1">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                {item.label}
                            </div>
                            <div className="text-2xl font-semibold tracking-tight">{item.value}</div>
                            <div className="text-sm text-muted-foreground">{item.meta}</div>
                        </div>
                        <div className="rounded-full border bg-background p-2.5 text-muted-foreground">
                            <item.icon className="size-4" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

function AnalyticsDashboard({ storeId }: { storeId: string }) {
    const capabilities = useStoreCapabilities(storeId);
    const storeQuery = useQuery({
        queryKey: ["store", storeId],
        queryFn: () => fetchWithAccessToken<Store>(`/stores/${storeId}`),
        staleTime: 5 * 60 * 1000,
    });

    const ordersQuery = useQuery({
        queryKey: ["orders-analytics", storeId],
        queryFn: () => fetchWithAccessToken<PaginatedResponse<Order>>(`/stores/${storeId}/orders?page=1&page_size=500`),
        staleTime: 60_000,
    });

    const orders = ordersQuery.data?.items ?? [];
    const metrics = computeMetrics(orders);
    const currency = orders[0]?.currency ?? "USD";
    const decimalPlaces = orders[0]?.decimalPlaces ?? 2;

    const isForbidden =
        !capabilities.isLoading &&
        (!capabilities.canViewAnalytics ||
            (ordersQuery.error instanceof AuthFetchError && ordersQuery.error.status === 403));

    if (isForbidden) {
        return (
            <NotAllowedState
                title="Analytics access denied"
                message="You do not have permission to view analytics for this store."
                returnHref={`/dashboard/${storeId}`}
            />
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <StoreSubNav
                store={storeQuery.data}
                pending={storeQuery.isPending}
            />
            <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-6">
                <div className="flex flex-col gap-6 py-6">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            All-time order metrics for this store.
                        </p>
                    </div>
                    {ordersQuery.isPending ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i} className="gap-0 border bg-background-elevated/80 py-0">
                                    <CardContent className="px-5 py-5">
                                        <div className="h-16 animate-pulse rounded-md bg-muted" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <MetricsGrid metrics={metrics} currency={currency} decimalPlaces={decimalPlaces} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);
    return <AnalyticsDashboard storeId={storeId} />;
}
