import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";
import { CartClearer } from "./_components/cart-clearer";
import { OrderPoller } from "./_components/order-poller";
import { OrderTracker } from "./_components/order-tracker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function getStoreBySlug(slug: string) {
    const res = await fetch(`${API_URL}/stores/slug/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
}

async function getOrder(storeId: string, orderId: string, accessToken?: string) {
    // Standardize on "access" query parameter.
    const query = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
    const res = await fetch(`${API_URL}/stores/${storeId}/orders/${orderId}${query}`, {
        cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
}

const STATUS_CONFIG: Record<string, {
    label: string;
    heading: string;
    variant: "default" | "secondary" | "destructive" | "outline";
}> = {
    pending: { label: "Pending", heading: "Order received", variant: "outline" },
    confirmed: { label: "Confirmed", heading: "Order confirmed", variant: "default" },
    preparing: { label: "Preparing", heading: "Being prepared", variant: "secondary" },
    ready: { label: "Ready", heading: "Ready for pickup", variant: "default" },
    completed: { label: "Completed", heading: "Order completed", variant: "secondary" },
    cancelled: { label: "Cancelled", heading: "Order cancelled", variant: "destructive" },
};

export default async function OrderPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string; orderId: string }>;
    searchParams: Promise<{ access?: string; payment_intent?: string; session_id?: string }>;
}) {
    const { slug, orderId } = await params;
    // access is the project convention for guest lookup.
    // payment_intent is appended by Stripe Elements.
    const { access, payment_intent, session_id } = await searchParams;

    const store = await getStoreBySlug(slug);
    if (!store) notFound();

    const order = await getOrder(store.id, orderId, access);
    if (!order) notFound();

    const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;

    // payment_intent or session_id present → customer just completed payment and Stripe redirected
    // them here. Use it to clear the cart and poll for order status updates.
    //
    // Important: "payment received" ≠ "order confirmed".  The webhook that flips
    // order.status to confirmed (payment_intent.succeeded) may not have fired
    // yet by the time the customer lands here.  So the banner acknowledges the
    // payment without making a claim about the order status — the status badge
    // below reflects whatever the DB actually says right now.
    const isSuccess = !!payment_intent || !!session_id;
    const isTerminal = ["completed", "cancelled"].includes(order.status);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {isSuccess && <CartClearer />}
            {!isTerminal && <OrderPoller status={order.status} />}
            
            {isSuccess && (
                <div className="mb-6 rounded-2xl bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3 text-green-600">
                    <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-semibold text-sm">Payment received!</p>
                        <p className="text-xs opacity-90">We&apos;ve got your order — the store will be notified shortly.</p>
                    </div>
                </div>
            )}

            <div className="mb-6 rounded-[2rem] border border-border/70 bg-card p-6 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Order #{order.display_id || order.order_reference}
                </p>
                {/* Heading reflects actual order status rather than always
                    showing "Order confirmed" — the webhook may not have fired
                    yet when the customer first lands here. */}
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                    {statusInfo.heading}
                </h1>
                <Badge variant={statusInfo.variant} className="mt-3 rounded-full px-3 py-1">
                    {statusInfo.label}
                </Badge>
            </div>

            <OrderTracker currentStatus={order.status} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <Card className="rounded-[1.75rem] border-border/70">
                    <CardHeader>
                        <CardTitle>Order Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {order.items?.map((item: {
                            id: string;
                            quantity: number;
                            product_name: string;
                            total_amount: number;
                            options?: { id: string; option_name: string }[];
                        }) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <div>
                                    <span>{item.quantity}× {item.product_name}</span>
                                    {item.options && item.options.length > 0 && (
                                        <p className="text-muted-foreground text-xs">
                                            {item.options.map((o) => o.option_name).join(", ")}
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
                                <span>Service fee</span>
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
                                {order.customer_name && (
                                    <p><span className="font-medium">Name:</span> {order.customer_name}</p>
                                )}
                                {order.customer_email && (
                                    <p><span className="font-medium">Email:</span> {order.customer_email}</p>
                                )}
                                {order.customer_phone && (
                                    <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>
                                )}
                                {order.notes && (
                                    <p><span className="font-medium">Notes:</span> {order.notes}</p>
                                )}
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