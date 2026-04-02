"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const CONFIRMED_STATUSES = new Set(["confirmed", "preparing", "ready", "completed"]);

async function waitForWebhookConfirmation(storeId: string, orderId: string, orderAccessToken: string | null): Promise<void> {
    const timeoutMs = 60_000;
    const intervalMs = 1_500;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const order = await api.orders.get(storeId, orderId, orderAccessToken || undefined);
        const status = String((order as any).status || "");

        if (CONFIRMED_STATUSES.has(status)) {
            return;
        }

        if (status === "cancelled") {
            throw new Error("Payment failed or was cancelled.");
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error("Payment is still processing. Please wait and try again.");
}

export default function PaymentForm({ storeSlug, storeId, orderAccessToken, orderId }: { storeSlug: string, storeId: string, orderAccessToken: string | null, orderId: string | null }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [awaitingWebhook, setAwaitingWebhook] = useState(false);
    const clearCart = useCartStore(state => state.clearCart);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements || !orderId) return;

        setLoading(true);

        const returnUrl = new URL(`${window.location.origin}/store/${storeSlug}/orders/${orderId}`);
        if (orderAccessToken) {
            returnUrl.searchParams.set("access", orderAccessToken);
        }

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: returnUrl.toString(),
            },
            redirect: "if_required"
        });

        if (error) {
            toast.error(error.message || "Payment failed");
            setLoading(false);
        } else {
            // Success for non-redirect flows; wait for webhook-confirmed status before navigating.
            try {
                setAwaitingWebhook(true);
                await waitForWebhookConfirmation(storeId, orderId, orderAccessToken);
                clearCart();
                toast.success("Payment confirmed!");
                router.push(returnUrl.pathname + returnUrl.search);
            } catch (waitError: any) {
                toast.error(waitError?.message || "Waiting for payment confirmation failed");
            } finally {
                setAwaitingWebhook(false);
                setLoading(false);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement options={{ layout: "tabs" }} />
            <Button type="submit" className="w-full" disabled={loading || !stripe}>
                {loading || awaitingWebhook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Pay Now"}
                {awaitingWebhook ? "Confirming payment..." : null}
            </Button>
        </form>
    );
}