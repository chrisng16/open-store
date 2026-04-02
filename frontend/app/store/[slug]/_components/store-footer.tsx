"use client";

import { useStore } from "@/lib/store-context";
import { Clock3, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function StoreFooter() {
    const store = useStore();

    return (
        <footer className="border-t bg-card/50">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
                    {/* Brand Section */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center gap-3">
                            {store.logoUrl && (
                                <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-lg border object-cover" />
                            )}
                            <h2 className="text-xl font-bold">{store.name}</h2>
                        </div>
                        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                            {store.description || "Neighborhood service, clean ordering, and a menu that stays easy to browse from first glance to checkout."}
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                <span>Secure Payments</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock3 className="h-4 w-4 text-primary" />
                                <span>Real-time Menu</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground">Navigation</h4>
                        <nav className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                            <Link href={`/store/${store.slug}`} className="hover:text-primary transition-colors">Home</Link>
                            <Link href={`/store/${store.slug}/menu`} className="hover:text-primary transition-colors">Full Menu</Link>
                            <Link href={`/store/${store.slug}/checkout`} className="hover:text-primary transition-colors">Checkout</Link>
                            <Link href={`/store/${store.slug}/orders`} className="hover:text-primary transition-colors">Track Orders</Link>
                        </nav>
                    </div>

                    {/* Contact */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-foreground">Contact</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            {store.address && (
                                <div className="flex gap-2">
                                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                                    <span>{store.address}</span>
                                </div>
                            )}
                            {store.phone && (
                                <div className="flex gap-2">
                                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                                    <a href={`tel:${store.phone}`} className="hover:text-primary transition-colors">{store.phone}</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} {store.name}. Powered by Open Store.</p>
                    <div className="flex items-center gap-4">
                        <Link href="#" className="hover:text-foreground">Privacy</Link>
                        <Link href="#" className="hover:text-foreground">Terms</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
