"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { useMutation, useQuery } from "@tanstack/react-query";
import { use } from "react";

type OrderItem = {
    id: string;
    productName: string;
    quantity: number;
    totalPrice: number;
};

type Order = {
    id: string;
    orderNumber: number;
    status: string;
    totalAmount: number;
    customerName: string | null;
    customerEmail: string | null;
    items: OrderItem[];
    createdAt: string;
};

const STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
];

export default function OrdersPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);

    const { data: orders = [], isPending, refetch } = useQuery({
        queryKey: ["orders", storeId],
        queryFn: async () => fetchWithAccessToken<Order[]>(`/stores/${storeId}/orders`),
        enabled: !!storeId,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
            await fetchWithAccessToken<void>(`/stores/${storeId}/orders/${orderId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(denormalizeRequest({ status: newStatus })),
            });
        },
        onSuccess: () => {
            void refetch();
        },
    });

    console.log("Orders:", orders);

    if (isPending)
        return <div className="p-6 text-muted-foreground">Loading orders...</div>;

    return (
        <div className="p-6">
            <h1 className="mb-6 text-2xl font-bold">All Orders</h1>

            {orders.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No orders yet
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">
                                        {order.orderNumber}
                                    </TableCell>
                                    <TableCell>{order.customerName || "—"}</TableCell>
                                    <TableCell className="max-w-50 truncate text-sm">
                                        {order.items
                                            ?.map((i) => `${i.quantity}x ${i.productName}`)
                                            .join(", ")}
                                    </TableCell>
                                    <TableCell>${Number(order.totalAmount / 100).toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Select
                                            value={order.status}
                                            onValueChange={(val) =>
                                                updateStatusMutation.mutate({
                                                    orderId: order.id,
                                                    newStatus: val,
                                                })
                                            }
                                        >
                                            <SelectTrigger className="h-8 w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUSES.map((s) => (
                                                    <SelectItem key={s} value={s}>
                                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
