import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStoreBySlug(slug: string) {
    const res = await fetch(`${API_URL}/stores/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
}

async function getOrder(storeId: string, orderId: string) {
    const res = await fetch(`${API_URL}/stores/${storeId}/orders/${orderId}`, {
        cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    confirmed: { label: "Confirmed", variant: "default" },
    preparing: { label: "Preparing", variant: "secondary" },
    ready: { label: "Ready", variant: "default" },
    completed: { label: "Completed", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export default async function OrderPage({
    params,
}: {
    params: Promise<{ slug: string; orderId: string }>;
}) {
    const { slug, orderId } = await params;
    const store = await getStoreBySlug(slug);
    if (!store) notFound();

    const order = await getOrder(store.id, orderId);
    if (!order) notFound();

    const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-6">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold">Order Confirmed!</h1>
                <p className="mt-1 text-muted-foreground">
                    Order #{order.order_number}
                </p>
                <Badge variant={statusInfo.variant} className="mt-2">
                    {statusInfo.label}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {order.items?.map((item: { id: string; quantity: number; product_name: string; total_price: number; modifiers?: { id: string; modifier_name: string }[] }) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <div>
                                <span>
                                    {item.quantity}x {item.product_name}
                                </span>
                                {item.modifiers && item.modifiers.length > 0 && (
                                    <p className="text-muted-foreground text-xs">
                                        {item.modifiers.map((m: { modifier_name: string }) => m.modifier_name).join(", ")}
                                    </p>
                                )}
                            </div>
                            <span>${Number(item.total_price).toFixed(2)}</span>
                        </div>
                    ))}

                    <Separator />

                    <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${Number(order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tax</span>
                        <span>${Number(order.tax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>${Number(order.total).toFixed(2)}</span>
                    </div>
                </CardContent>
            </Card>

            {(order.customer_name || order.customer_email) && (
                <Card className="mt-4">
                    <CardContent className="pt-6 text-sm space-y-1">
                        {order.customer_name && <p><span className="font-medium">Name:</span> {order.customer_name}</p>}
                        {order.customer_email && <p><span className="font-medium">Email:</span> {order.customer_email}</p>}
                        {order.customer_phone && <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>}
                        {order.notes && <p><span className="font-medium">Notes:</span> {order.notes}</p>}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
