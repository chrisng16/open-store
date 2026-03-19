import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStoreBySlug(slug: string) {
    const res = await fetch(`${API_URL}/stores/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
}

async function getOrder(storeId: string, orderId: string, accessToken?: string) {
    const query = accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : "";
    const res = await fetch(`${API_URL}/stores/${storeId}/orders/${orderId}${query}`, {
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
    searchParams,
}: {
    params: Promise<{ slug: string; orderId: string }>;
    searchParams: Promise<{ access?: string }>;
}) {
    const { slug, orderId } = await params;
    const { access } = await searchParams;
    const store = await getStoreBySlug(slug);
    if (!store) notFound();

    const order = await getOrder(store.id, orderId, access);
    if (!order) notFound();

    const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-6 rounded-[2rem] border border-border/70 bg-card p-6 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Order placed</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">Order confirmed</h1>
                <p className="mt-2 text-muted-foreground">
                    Order #{order.display_id || order.order_reference}
                </p>
                <Badge variant={statusInfo.variant} className="mt-3 rounded-full px-3 py-1">
                    {statusInfo.label}
                </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <Card className="rounded-[1.75rem] border-border/70">
                    <CardHeader>
                        <CardTitle>Order Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {order.items?.map((item: { id: string; quantity: number; product_name: string; total_amount: number; options?: { id: string; option_name: string }[] }) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <div>
                                    <span>
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    {item.options && item.options.length > 0 && (
                                        <p className="text-muted-foreground text-xs">
                                            {item.options.map((option: { option_name: string }) => option.option_name).join(", ")}
                                        </p>
                                    )}
                                </div>
                                <span>${(Number(item.total_amount) / 100).toFixed(2)}</span>
                            </div>
                        ))}

                        <Separator />

                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>${(Number(order.subtotal_amount) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Tax</span>
                            <span>${(Number(order.tax_amount) / 100).toFixed(2)}</span>
                        </div>
                        {order.platform_fee_amount > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Service fee (5%)</span>
                                <span>${(Number(order.platform_fee_amount) / 100).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span>${(Number(order.total_amount) / 100).toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4 lg:sticky lg:top-28">
                    {(order.customer_name || order.customer_email) && (
                        <Card className="rounded-[1.75rem] border-border/70">
                            <CardHeader>
                                <CardTitle>Customer</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {order.customer_name && <p><span className="font-medium">Name:</span> {order.customer_name}</p>}
                                {order.customer_email && <p><span className="font-medium">Email:</span> {order.customer_email}</p>}
                                {order.customer_phone && <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>}
                                {order.notes && <p><span className="font-medium">Notes:</span> {order.notes}</p>}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="rounded-[1.75rem] border-border/70">
                        <CardHeader>
                            <CardTitle>What happens next</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p>The store will update your order status as it moves from confirmation to pickup readiness.</p>
                            <p>Keep this page handy if you need to reference your order number when collecting it.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
