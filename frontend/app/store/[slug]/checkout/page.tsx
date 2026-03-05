"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import { getStripe } from "@/lib/stripe";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const stripePromise = getStripe();

export default function CheckoutPage() {
    const params = useParams<{ slug: string }>();
    const slug = params.slug;
    const items = useCartStore((s) => s.items);
    const getSubtotal = useCartStore((s) => s.getSubtotal);
    const clearCart = useCartStore((s) => s.clearCart);

    const subtotal = getSubtotal();
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    if (items.length === 0) {
        return (
            <div className="container mx-auto max-w-2xl px-4 py-10 text-center">
                <h2 className="text-2xl font-bold">Your cart is empty</h2>
                <p className="mt-2 text-muted-foreground">Add items before checkout.</p>
                <Link href={`/store/${slug}/menu`}>
                    <Button className="mt-5">Back to menu</Button>
                </Link>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            <CheckoutForm
                slug={slug}
                items={items}
                subtotal={subtotal}
                tax={tax}
                total={total}
                clearCart={clearCart}
            />
        </Elements>
    );
}

function CheckoutForm({
    slug,
    items,
    subtotal,
    tax,
    total,
    clearCart,
}: {
    slug: string;
    items: ReturnType<typeof useCartStore.getState>["items"];
    subtotal: number;
    tax: number;
    total: number;
    clearCart: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();

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
                unit_price: item.unit_price,
                modifiers: item.modifiers,
            }));

            const store = (await api.stores.getBySlug(slug)) as { id: string };
            const amountInCents = Math.round(total * 100);

            const paymentIntent = (await api.payments.createIntent(
                store.id,
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

            const order = (await api.orders.create(store.id, {
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
        <div className="container mx-auto max-w-2xl px-4 py-6">
            <h2 className="text-2xl font-bold">Secure Checkout</h2>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <Card>
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

                <Card>
                    <CardHeader>
                        <CardTitle>Payment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border bg-background px-3 py-3">
                            <CardElement />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Test card: 4242 4242 4242 4242, any future expiry, any CVC.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>
                                    {item.quantity}x {item.product_name}
                                    {item.modifiers.length > 0 && (
                                        <span className="text-muted-foreground">
                                            {" "}
                                            ({item.modifiers.map((m) => m.modifier_name).join(", ")})
                                        </span>
                                    )}
                                </span>
                                <span>
                                    $
                                    {(
                                        (item.unit_price +
                                            item.modifiers.reduce(
                                                (s, m) => s + m.price_adjustment,
                                                0
                                            )) *
                                        item.quantity
                                    ).toFixed(2)}
                                </span>
                            </div>
                        ))}

                        <Separator className="my-2" />

                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Tax (8%)</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || !stripe || !elements}
                >
                    {loading ? "Processing payment..." : `Pay & Place Order — $${total.toFixed(2)}`}
                </Button>
            </form>
        </div>
    );
}
