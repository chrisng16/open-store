
"use client";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store-context";
import { ArrowRight, Clock3, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

const trustNotes = [
    {
        icon: ShieldCheck,
        title: "Secure checkout",
        copy: "Fast pickup ordering with protected payments.",
    },
    {
        icon: Clock3,
        title: "Freshly timed",
        copy: "Menus are published for real service windows, not guesswork.",
    },
    {
        icon: Sparkles,
        title: "Local-first",
        copy: "Built for neighborhood stores and repeat regulars.",
    },
];

export default function StoreFooter() {
    const store = useStore();

    return (
        <footer className="mt-6 border-t border-border/60 bg-card/35">
            <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
                <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.05)] md:p-8">
                    <div aria-hidden className="absolute inset-x-6 top-0 h-1 rounded-full" style={{ backgroundColor: "var(--store-accent)" }} />
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)] lg:items-end">
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--store-accent)" }} />
                                {store.isActive ? "Open for pickup" : "Ordering paused"}
                            </div>

                            <div className="max-w-2xl space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.42em] text-muted-foreground" style={{ color: "var(--store-primary)" }}>
                                    Visit. Order. Pick up.
                                </p>
                                <h2 className="max-w-xl text-3xl font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
                                    {store.name}
                                </h2>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                                    {store.description || "Neighborhood service, clean ordering, and a menu that stays easy to browse from first glance to checkout."}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Link href={`/store/${store.slug}/menu`}>
                                    <Button className="group rounded-full px-5 shadow-sm">
                                        Browse menu
                                        <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                                    </Button>
                                </Link>
                                <Link href={`/store/${store.slug}/checkout`}>
                                    <Button variant="outline" className="rounded-full px-5">
                                        Review cart
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            {trustNotes.map(({ icon: Icon, title, copy }) => (
                                <div
                                    key={title}
                                    className="rounded-[1.5rem] border border-border/60 bg-background/90 p-4"
                                >
                                    <Icon className="mb-3 size-4" style={{ color: "var(--store-accent)" }} />
                                    <p className="text-sm font-semibold text-foreground">{title}</p>
                                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{copy}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 rounded-[2rem] border border-border/60 bg-background/85 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_0.8fr_0.8fr]">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Plan pickup with confidence.</p>
                            <p className="max-w-md text-sm leading-6 text-muted-foreground">
                                Clear navigation, direct contact details, and a checkout flow built for quick neighborhood orders.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {store.address && (
                                <div className="rounded-4xl border border-border/60 bg-card p-4">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                        <MapPin className="size-3.5" style={{ color: "var(--store-primary)" }} />
                                        Location
                                    </div>
                                    <p className="text-sm leading-6 text-foreground">{store.address}</p>
                                </div>
                            )}

                            {store.phone && (
                                <div className="rounded-4xl border border-border/60 bg-card p-4">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                        <Phone className="size-3.5" style={{ color: "var(--store-primary)" }} />
                                        Order help
                                    </div>
                                    <a
                                        href={`tel:${store.phone}`}
                                        className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors"
                                        style={{ textDecorationColor: "var(--store-primary)" }}
                                    >
                                        {store.phone}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Explore</p>
                        <nav className="grid gap-2 text-sm" aria-label="Footer navigation">
                            <Link className="rounded-full px-3 py-2 transition-colors hover:bg-card" href={`/store/${store.slug}`}>
                                Home
                            </Link>
                            <Link className="rounded-full px-3 py-2 transition-colors hover:bg-card" href={`/store/${store.slug}/menu`}>
                                Full menu
                            </Link>
                            <Link className="rounded-full px-3 py-2 transition-colors hover:bg-card" href={`/store/${store.slug}/checkout`}>
                                Checkout
                            </Link>
                            <Link className="rounded-full px-3 py-2 transition-colors hover:bg-card" href={`/store/${store.slug}/orders`}>
                                Track order
                            </Link>
                        </nav>
                    </div>

                    <div>
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Service notes</p>
                        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                            <p>
                                Pickup availability and featured items update with the store catalog, so guests see what can actually be ordered now.
                            </p>
                            <p>
                                Need a fast reorder or a question answered before checkout? Use the direct contact details above.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <p>
                        © {new Date().getFullYear()} {store.name}. Powered by Open Store.
                    </p>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
                        Customer-facing pickup experience
                    </p>
                </div>
            </div>
        </footer>
    );
}
