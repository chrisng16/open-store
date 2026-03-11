"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useCartPricing } from "@/lib/cart-pricing";
import { useCartMutations, useCartSummary } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { getStripe } from "@/lib/stripe";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const stripePromise = getStripe();

export default function CheckoutPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const store = useStore();
    const { items } = useCartSummary();
    const { clearCart } = useCartMutations();
    const { pricedItems, subtotal, tax, total, isLoading, error } = useCartPricing({
        storeId: store.id,
        items,
    });

    if (items.length === 0) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center rounded-4xl min-h-[75dvh] border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight">Your cart is empty</h2>
                        <p className="mt-3 text-base text-muted-foreground">
                            Add some items from the menu to proceed to checkout.
                        </p>
                        <Link href={`/store/${slug}`}>
                            <Button className="mt-6 rounded-full px-6">Browse menu</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            <CheckoutForm
                slug={slug}
                storeId={store.id}
                items={pricedItems}
                subtotal={subtotal}
                tax={tax}
                total={total}
                clearCart={clearCart}
                isPricingLoading={isLoading}
                pricingError={error}
            />
        </Elements>
    );
}

function CheckoutForm({
    slug,
    storeId,
    items,
    subtotal,
    tax,
    total,
    clearCart,
    isPricingLoading,
    pricingError,
}: {
    slug: string;
    storeId: string;
    items: {
        id: string;
        product_id: string;
        product_name: string;
        quantity: number;
        unit_amount: number;
        options: {
            option_id: string;
            option_name: string;
            unit_amount: number;
            quantity: number;
        }[];
        line_total: number;
    }[];
    subtotal: number;
    tax: number;
    total: number;
    clearCart: () => void;
    isPricingLoading: boolean;
    pricingError: string | null;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const cardElementOptions = useMemo(
        () => ({
            style: {
                base: {
                    color: isDark ? "#f5f5f5" : "#171717",
                    fontFamily: 'Poppins, "Helvetica Neue", Helvetica, sans-serif',
                    fontSize: "16px",
                    fontSmoothing: "antialiased" as const,
                    "::placeholder": {
                        color: isDark ? "#a1a1aa" : "#737373",
                    },
                    iconColor: isDark ? "#d4d4d8" : "#404040",
                },
                invalid: {
                    color: "#ef4444",
                    iconColor: "#ef4444",
                },
                complete: {
                    color: isDark ? "#f5f5f5" : "#171717",
                },
            },
        }),
        [isDark]
    );

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!stripe || !elements) {
                throw new Error("Payment form is still loading. Please try again.");
            }

            const card = elements.getElement(CardElement);
            if (!card) {
                throw new Error("Card details are missing.");
            }

            const orderItems = items.map((item) => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_amount: item.unit_amount,
                options: item.options.map((option) => ({
                    option_id: option.option_id,
                    option_name: option.option_name,
                    unit_amount: option.unit_amount,
                    quantity: option.quantity,
                })),
            }));

            const amountInCents = total;

            const paymentIntent = (await api.payments.createIntent(
                storeId,
                amountInCents
            )) as { client_secret: string; payment_intent_id: string };

            const confirmation = await stripe.confirmCardPayment(
                paymentIntent.client_secret,
                {
                    payment_method: {
                        card,
                        billing_details: {
                            name: name || undefined,
                            email: email || undefined,
                            phone: phone || undefined,
                        },
                    },
                }
            );

            if (confirmation.error) {
                throw new Error(confirmation.error.message || "Payment failed");
            }

            if (confirmation.paymentIntent?.status !== "succeeded") {
                throw new Error("Payment was not completed. Please try again.");
            }

            const order = (await api.orders.create(storeId, {
                customer_name: name || null,
                customer_email: email || null,
                customer_phone: phone || null,
                notes: notes || null,
                items: orderItems,
            })) as { id: string; order_number: number };

            clearCart();
            router.push(`/store/${slug}/order/${order.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-6 rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Checkout</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Secure checkout</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter contact details, review your order, and complete payment in one pass.</p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                <div className="space-y-6">
                    <Card className="rounded-[1.75rem] border-border/70">
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Order Notes (optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any special instructions..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[1.75rem] border-border/70">
                        <CardHeader>
                            <CardTitle>Payment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="rounded-2xl border border-border/70 px-4 py-4"
                                style={{ backgroundColor: isDark ? "#18181b" : "#ffffff" }}
                            >
                                <CardElement key={`card-element-${resolvedTheme ?? "system"}`} options={cardElementOptions} />
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                                Test card: 4242 4242 4242 4242, any future expiry, any CVC.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4 lg:sticky lg:top-28">
                    <Card className="rounded-[1.75rem] border-border/70">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {isPricingLoading ? (
                                <>
                                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                                </>
                            ) : (
                                items.map((item) => (
                                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                                        <span>
                                            {item.quantity}x {item.product_name}
                                            {item.options.length > 0 && (
                                                <span className="text-muted-foreground">
                                                    {" "}
                                                    ({item.options.map((option) => option.option_name).join(", ")})
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0">${(item.line_total / 100).toFixed(2)}</span>
                                    </div>
                                ))
                            )}

                            <Separator className="my-2" />

                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>${(subtotal / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Tax (8%)</span>
                                <span>${(tax / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold">
                                <span>Total</span>
                                <span>${(total / 100).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {pricingError && <p className="text-sm text-destructive">{pricingError}</p>}

                    <Button
                        type="submit"
                        className="w-full rounded-full"
                        size="lg"
                        disabled={loading || !stripe || !elements || isPricingLoading || !!pricingError}
                    >
                        {loading
                            ? "Processing payment..."
                            : isPricingLoading
                                ? "Refreshing prices..."
                                : `Pay & Place Order · $${(total / 100).toFixed(2)}`}
                    </Button>
                </div>
            </form>
        </div>
    );
}
