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
import { cn } from "@/lib/utils";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const stripePromise = getStripe();

// ─── Platform fee: 5% covers Stripe (2.9% + $0.30), Connect fees,
//     chargebacks (~0.5%), refund-loss (~0.2%), and infra (~0.3%)
//     with ~1.35% margin remaining.
export const PLATFORM_FEE_RATE = 0.05; // 5%

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Step indicator ───────────────────────────────────────────────
type Step = "contact" | "payment" | "review";
const STEPS: { id: Step; label: string }[] = [
    { id: "contact", label: "Contact" },
    { id: "payment", label: "Payment" },
    { id: "review", label: "Review" },
];

function StepIndicator({ current }: { current: Step }) {
    const idx = STEPS.findIndex((s) => s.id === current);
    return (
        <div className="flex items-center gap-0" aria-label="Checkout steps">
            {STEPS.map((step, i) => {
                const done = i < idx;
                const active = i === idx;
                return (
                    <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                                    done
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : active
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-muted text-muted-foreground"
                                )}
                            >
                                {done ? (
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    i + 1
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-[10px] font-medium tracking-wide",
                                    active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={cn(
                                    "mb-4 h-0.5 w-10 transition-all duration-500 sm:w-16",
                                    i < idx ? "bg-primary" : "bg-border"
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Inline field error ───────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="mt-1 flex items-center gap-1 text-xs text-destructive" role="alert">
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {message}
        </p>
    );
}

// ─── Animated total ───────────────────────────────────────────────
function AnimatedTotal({ value }: { value: number }) {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);

    useEffect(() => {
        if (prevRef.current === value) return;
        const start = prevRef.current;
        const end = value;
        const duration = 400;
        const startTime = performance.now();

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(start + (end - start) * eased));
            if (progress < 1) requestAnimationFrame(tick);
            else prevRef.current = end;
        };
        requestAnimationFrame(tick);
    }, [value]);

    return <span>${(display / 100).toFixed(2)}</span>;
}

// ─── Empty cart ───────────────────────────────────────────────────
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
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                            </svg>
                        </div>
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

// ─── Main checkout form ───────────────────────────────────────────
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

    // Step management
    const [step, setStep] = useState<Step>("contact");

    // Form fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");

    // Validation errors (shown only after attempted advance)
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [cardComplete, setCardComplete] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Platform fee (5%)
    const platformFee = Math.round(total * PLATFORM_FEE_RATE);
    const grandTotal = total + platformFee;

    // ── Validation ────────────────────────────────────────────────
    const emailError = touched.email && email && !validateEmail(email) ? "Please enter a valid email address." : undefined;
    const nameError = touched.name && !name.trim() ? "Name is required." : undefined;
    const contactValid = name.trim().length > 0 && (!email || validateEmail(email));

    // ── Card element options ──────────────────────────────────────
    const cardElementOptions = useMemo(
        () => ({
            style: {
                base: {
                    color: isDark ? "#f5f5f5" : "#171717",
                    fontFamily: 'Poppins, "Helvetica Neue", Helvetica, sans-serif',
                    fontSize: "16px",
                    fontSmoothing: "antialiased" as const,
                    "::placeholder": { color: isDark ? "#a1a1aa" : "#737373" },
                    iconColor: isDark ? "#d4d4d8" : "#404040",
                },
                invalid: { color: "#ef4444", iconColor: "#ef4444" },
                complete: { color: isDark ? "#f5f5f5" : "#171717" },
            },
        }),
        [isDark]
    );

    // ── Step navigation ───────────────────────────────────────────
    function handleAdvanceContact() {
        setTouched({ name: true, email: true });
        if (!contactValid) return;
        setStep("payment");
    }

    function handleAdvancePayment() {
        if (!cardComplete) {
            setCardError("Please complete your card details.");
            return;
        }
        setCardError(null);
        setStep("review");
    }

    // ── Submit ────────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!stripe || !elements) throw new Error("Payment form is still loading. Please try again.");
            const card = elements.getElement(CardElement);
            if (!card) throw new Error("Card details are missing.");

            const orderItems = items.map((item) => ({
                productId: item.product_id,
                quantity: item.quantity,
                options: item.options.map((opt) => ({
                    optionId: opt.option_id,
                    quantity: opt.quantity,
                })),
            }));

            const order = await api.orders.create(storeId, {
                customerName: name || undefined,
                customerEmail: email || undefined,
                customerPhone: phone || undefined,
                notes: notes || undefined,
                items: orderItems,
            });

            const paymentIntent = await api.payments.createIntent(order.id);

            const confirmation = await stripe.confirmCardPayment(paymentIntent.clientSecret, {
                payment_method: {
                    card,
                    billing_details: {
                        name: name || undefined,
                        email: email || undefined,
                        phone: phone || undefined,
                    },
                },
            });

            if (confirmation.error) throw new Error(confirmation.error.message || "Payment failed");
            if (confirmation.paymentIntent?.status !== "succeeded")
                throw new Error("Payment was not completed. Please try again.");

            clearCart();
            const accessParam = order.orderAccessToken
                ? `?access=${encodeURIComponent(order.orderAccessToken)}`
                : "";
            router.push(`/store/${slug}/orders/${order.id}${accessParam}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setLoading(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6 rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Checkout</p>
                        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Secure checkout</h2>
                    </div>
                    <StepIndicator current={step} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                {/* ── Left column ── */}
                <div className="space-y-6">

                    {/* STEP 1: Contact */}
                    <Card className={cn("rounded-[1.75rem] border-border/70 transition-all duration-300", step !== "contact" && "opacity-60")}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                    step === "contact" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
                                )}>1</span>
                                Contact Information
                            </CardTitle>
                            {step !== "contact" && (
                                <button
                                    type="button"
                                    onClick={() => setStep("contact")}
                                    className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    Edit
                                </button>
                            )}
                        </CardHeader>
                        {step === "contact" ? (
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="name">
                                            Name <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                                            placeholder="Your full name"
                                            autoComplete="name"
                                            className={cn(nameError && "border-destructive focus-visible:ring-destructive/30")}
                                        />
                                        <FieldError message={nameError} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(formatPhone(e.target.value))}
                                            placeholder="(555) 123-4567"
                                            autoComplete="tel"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        className={cn(emailError && "border-destructive focus-visible:ring-destructive/30")}
                                    />
                                    <FieldError message={emailError} />
                                    <p className="text-xs text-muted-foreground">Optional — for order confirmation.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="notes">Special Instructions</Label>
                                    <Textarea
                                        id="notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Allergies, customizations, or anything else…"
                                        rows={3}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    className="w-full rounded-full"
                                    onClick={handleAdvanceContact}
                                    disabled={!name.trim()}
                                >
                                    Continue to Payment
                                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                </Button>
                            </CardContent>
                        ) : (
                            // Collapsed summary
                            <CardContent className="pb-5">
                                <p className="text-sm font-medium">{name}</p>
                                {email && <p className="text-sm text-muted-foreground">{email}</p>}
                                {phone && <p className="text-sm text-muted-foreground">{phone}</p>}
                                {notes && <p className="mt-1 text-xs italic text-muted-foreground">"{notes}"</p>}
                            </CardContent>
                        )}
                    </Card>

                    {/* STEP 2: Payment */}
                    <Card className={cn(
                        "rounded-[1.75rem] border-border/70 transition-all duration-300",
                        step === "contact" && "pointer-events-none opacity-40",
                        step === "review" && "opacity-60"
                    )}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                    step === "payment" ? "bg-primary text-primary-foreground" : step === "review" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                )}>2</span>
                                Payment
                            </CardTitle>
                            {step === "review" && (
                                <button
                                    type="button"
                                    onClick={() => setStep("payment")}
                                    className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    Edit
                                </button>
                            )}
                        </CardHeader>
                        {step === "payment" ? (
                            <CardContent className="space-y-4">
                                <div
                                    className={cn(
                                        "rounded-2xl border px-4 py-4 transition-colors",
                                        cardError ? "border-destructive" : "border-border/70"
                                    )}
                                    style={{ backgroundColor: isDark ? "#18181b" : "#ffffff" }}
                                >
                                    <CardElement
                                        key={`card-element-${resolvedTheme ?? "system"}`}
                                        options={cardElementOptions}
                                        onChange={(e) => {
                                            setCardComplete(e.complete);
                                            setCardError(e.error?.message ?? null);
                                        }}
                                    />
                                </div>
                                {cardError && <FieldError message={cardError} />}

                                {/* Trust signals */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                    </svg>
                                    256-bit SSL encrypted · Powered by Stripe
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Test card: <span className="font-mono">4242 4242 4242 4242</span>, any future expiry, any CVC.
                                </p>

                                <Button
                                    type="button"
                                    className="w-full rounded-full"
                                    onClick={handleAdvancePayment}
                                    disabled={!cardComplete}
                                >
                                    Review Order
                                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                </Button>
                            </CardContent>
                        ) : step === "review" ? (
                            <CardContent className="pb-5">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                    </svg>
                                    Card ending in ····
                                </div>
                            </CardContent>
                        ) : null}
                    </Card>

                    {/* STEP 3: Review & Place Order (mobile — shown inline on small screens) */}
                    {step === "review" && (
                        <div className="block lg:hidden">
                            <PlaceOrderButton
                                loading={loading}
                                stripe={stripe}
                                elements={elements}
                                isPricingLoading={isPricingLoading}
                                pricingError={pricingError}
                                grandTotal={grandTotal}
                                error={error}
                            />
                        </div>
                    )}
                </div>

                {/* ── Right column: sticky order summary ── */}
                <div className="space-y-4 lg:sticky lg:top-28">
                    <Card className="rounded-[1.75rem] border-border/70">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {isPricingLoading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                                    ))}
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                                        <span>
                                            <span className="font-medium">{item.quantity}×</span>{" "}
                                            {item.product_name}
                                            {item.options.length > 0 && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {item.options.map((o) => o.option_name).join(", ")}
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0 tabular-nums">${(item.line_total / 100).toFixed(2)}</span>
                                    </div>
                                ))
                            )}

                            <Separator className="my-2" />

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="tabular-nums">${(subtotal / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Tax (8%)</span>
                                    <span className="tabular-nums">${(tax / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        Service fee (5%)
                                        <span title="Covers payment processing, platform operations, and chargeback protection." className="cursor-help">
                                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM10 9a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 9z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    </span>
                                    <span className="tabular-nums">${(platformFee / 100).toFixed(2)}</span>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between text-lg font-semibold">
                                <span>Total</span>
                                <AnimatedTotal value={grandTotal} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Desktop place-order button */}
                    <div className="hidden lg:block">
                        <PlaceOrderButton
                            loading={loading}
                            stripe={stripe}
                            elements={elements}
                            isPricingLoading={isPricingLoading}
                            pricingError={pricingError}
                            grandTotal={grandTotal}
                            error={error}
                            step={step}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
}

// ─── Place order button + errors ──────────────────────────────────
function PlaceOrderButton({
    loading,
    stripe,
    elements,
    isPricingLoading,
    pricingError,
    grandTotal,
    error,
    step,
}: {
    loading: boolean;
    stripe: ReturnType<typeof useStripe>;
    elements: ReturnType<typeof useElements>;
    isPricingLoading: boolean;
    pricingError: string | null;
    grandTotal: number;
    error: string | null;
    step?: Step;
}) {
    const notReady = step !== undefined && step !== "review";

    return (
        <div className="space-y-3">
            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}
            {pricingError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {pricingError}
                </div>
            )}
            <Button
                type="submit"
                className="w-full rounded-full"
                size="lg"
                disabled={loading || !stripe || !elements || isPricingLoading || !!pricingError || notReady}
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing payment…
                    </span>
                ) : isPricingLoading ? (
                    "Refreshing prices…"
                ) : notReady ? (
                    "Complete steps above"
                ) : (
                    <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                        Pay & Place Order · ${(grandTotal / 100).toFixed(2)}
                    </span>
                )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
                By placing your order you agree to our{" "}
                <a href="/terms" className="underline underline-offset-2 hover:no-underline">Terms</a>
                {" "}and{" "}
                <a href="/privacy" className="underline underline-offset-2 hover:no-underline">Privacy Policy</a>.
            </p>
        </div>
    );
}