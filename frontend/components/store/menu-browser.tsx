"use client";

import { CartButton } from "@/components/store/cart-button";
import { ProductDialog } from "@/components/store/product-dialog";
import { Badge } from "@/components/ui/badge";
import { useMenuScrollSpy } from "@/hooks/use-menu-scroll-spy";
import { useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Modifier = { id: string; name: string; price_adjustment: number };
type ModifierGroup = { id: string; name: string; modifiers: Modifier[]; min_selections: number; max_selections: number };
type Product = {
    id: string; store_id: string; category_id: string | null;
    name: string; description: string | null; base_price: number;
    image_url: string | null; dietary_tags: string[] | null;
    allergens: string[] | null; modifier_groups: ModifierGroup[];
};
type CategorySection = { id: string; name: string; description: string | null; products: Product[] };

const DIETARY_ICONS: Record<string, string> = {
    vegan: "🌱", vegetarian: "🥬", "gluten-free": "🌾",
    "dairy-free": "🥛", "nut-free": "🥜", halal: "☪", kosher: "✡",
};

// ─── Tab bar with arrow buttons ──────────────────────────────────────────────

function TabBar({
    sections,
    activeSection,
    navigateTo,
    tabScrollerRef,
    tabButtonRefs,
}: {
    sections: CategorySection[];
    activeSection: string;
    navigateTo: (id: string) => void;
    tabScrollerRef: React.RefObject<HTMLDivElement | null>;
    tabButtonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
}) {
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const syncArrows = useCallback(() => {
        const el = tabScrollerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, [tabScrollerRef]);

    useEffect(() => {
        const el = tabScrollerRef.current;
        if (!el) return;
        syncArrows();
        el.addEventListener("scroll", syncArrows, { passive: true });
        const ro = new ResizeObserver(syncArrows);
        ro.observe(el);
        return () => { el.removeEventListener("scroll", syncArrows); ro.disconnect(); };
    }, [syncArrows, tabScrollerRef]);

    const scrollBy = (dir: "left" | "right") => {
        tabScrollerRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    };

    return (
        <div className="relative flex items-end border-b">
            {/* Left arrow */}
            <button
                type="button"
                onClick={() => scrollBy("left")}
                aria-hidden={!canScrollLeft}
                className={cn(
                    "absolute left-0 z-10 flex h-full items-center bg-linear-to-r from-background via-background via-70% to-transparent pl-1 pr-4 transition-opacity",
                    canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>

            {/* Scrollable tabs */}
            <div
                ref={tabScrollerRef}
                className="no-scrollbar flex flex-1 items-end gap-1 overflow-x-auto"
            >
                {sections.map((section) => (
                    <button
                        key={section.id}
                        ref={(node) => { tabButtonRefs.current[section.id] = node; }}
                        type="button"
                        onClick={() => navigateTo(section.id)}
                        className={cn(
                            "shrink-0 border-b-4 rounded px-4 pb-3 pt-1 text-sm font-medium whitespace-nowrap transition-colors",
                            activeSection === section.id
                                ? "-mb-px border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {section.name}
                    </button>
                ))}
            </div>

            {/* Right arrow */}
            <button
                type="button"
                onClick={() => scrollBy("right")}
                aria-hidden={!canScrollRight}
                className={cn(
                    "absolute right-0 z-10 flex h-full items-center bg-linear-to-l from-background via-background via-70% to-transparent pr-1 pl-4 transition-opacity",
                    canScrollRight ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MenuBrowser({
    slug, storeName, storeDescription, sections, defaultCategory,
    navbarHeight = 0,
}: {
    slug: string; storeName: string; storeDescription?: string | null;
    sections: CategorySection[]; defaultCategory: string;
    /** Height of the global navbar in px. Used to offset the sticky header. Defaults to 80. */
    navbarHeight?: number;
}) {
    // Ref for the full inline store-info block (not sticky).
    const storeInfoRef = useRef<HTMLDivElement | null>(null);
    // Ref for the compact sticky header that appears after scrolling past store info.
    const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
    const tabScrollerRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Whether the user has scrolled past the inline store-info section.
    const [pastStoreInfo, setPastStoreInfo] = useState(false);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const setStoreSlug = useCartStore((s) => s.setStoreSlug);
    const addItem = useCartStore((s) => s.addItem);

    const totalItems = useMemo(
        () => sections.reduce((sum, s) => sum + s.products.length, 0),
        [sections],
    );

    // Watch when the inline store-info block leaves the viewport.
    useEffect(() => {
        const el = storeInfoRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setPastStoreInfo(!entry.isIntersecting),
            { rootMargin: `-${navbarHeight}px 0px 0px 0px`, threshold: 0 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [navbarHeight]);

    // The sticky offset is navbarHeight + the sticky block's own height + a small gap.
    // navbarHeight accounts for the `top` value the sticky block sits at;
    // offsetHeight measures the block itself (compact row + tab bar).
    const getStickyOffset = useCallback(
        () => navbarHeight + (stickyHeaderRef.current?.offsetHeight ?? 0) + 16,
        [navbarHeight],
    );

    const { activeSection, navigateTo } = useMenuScrollSpy({
        sections,
        defaultSection: defaultCategory,
        getStickyOffset,
        tabScrollerRef,
        sectionRefs,
        tabButtonRefs,
    });

    return (
        <div className="container mx-auto px-4">

            {/* Product dialog */}
            {selectedProduct && (
                <ProductDialog
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    onAddToCart={(product, selections, qty) => {
                        const modifiers = product.modifier_groups.flatMap((group) =>
                            group.modifiers.flatMap((mod) => {
                                const selectedCount = selections[group.id]?.[mod.id] ?? 0;
                                if (selectedCount <= 0) return [];

                                return Array.from({ length: selectedCount }, () => ({
                                    modifier_id: mod.id,
                                    modifier_name: mod.name,
                                    price_adjustment: Number(mod.price_adjustment),
                                    group_id: group.id,
                                }));
                            })
                        );

                        // Snapshot modifier groups so items remain editable later
                        const product_modifier_groups = product.modifier_groups.map((g) => ({
                            id: g.id,
                            name: g.name,
                            min_selections: g.min_selections,
                            max_selections: g.max_selections,
                            modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, price_adjustment: Number(m.price_adjustment) })),
                        }));

                        setStoreSlug(slug);
                        addItem({
                            product_id: product.id,
                            product_name: product.name,
                            unit_price: Number(product.base_price),
                            quantity: qty,
                            modifiers,
                            image_url: product.image_url,
                            product_modifier_groups,
                        });
                    }}
                />
            )}

            {/* ── Inline store info (not sticky, scrolls away) ── */}
            <div ref={storeInfoRef} className="flex flex-wrap items-start justify-between gap-4 py-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{storeName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {storeDescription || "Playful bites, crafted fast for pickup."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Pickup only</Badge>
                        <Badge variant="outline">{totalItems} items</Badge>
                        <Badge variant="outline">Ready in 15–25 min</Badge>
                    </div>
                </div>
                <CartButton slug={slug} />
            </div>

            {/*
             * ── Sticky header block ──
             * Always mounted so refs are stable. Visibility controlled by
             * translate so it doesn't affect layout when hidden.
             *
             * Structure mirrors DoorDash:
             *   - Compact name row  → only visible after scrolling past store info
             *   - Tab bar           → always visible once sticky
             */}
            <div
                ref={stickyHeaderRef}
                className="sticky z-20 bg-background"
                style={{ top: navbarHeight }}
            >
                {/* Compact store name row — slides in after scrolling past inline header */}
                <div
                    className={cn(
                        "grid transition-all duration-200",
                        pastStoreInfo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                >
                    {/* Inner div must have overflow-visible so the cart badge isn't clipped */}
                    <div className="overflow-visible">
                        <div className="flex items-center justify-between gap-4 py-3">
                            <h2 className="text-lg font-bold tracking-tight">{storeName}</h2>
                            <CartButton slug={slug} />
                        </div>
                    </div>
                </div>

                {/* Tab bar — always present in the sticky block */}
                <TabBar
                    sections={sections}
                    activeSection={activeSection}
                    navigateTo={navigateTo}
                    tabScrollerRef={tabScrollerRef}
                    tabButtonRefs={tabButtonRefs}
                />
            </div>

            {/* ── Menu sections ── */}
            <div className="space-y-10 pt-8 pb-10">
                {sections.map((section) => (
                    <section
                        key={section.id}
                        ref={(node) => { sectionRefs.current[section.id] = node; }}
                    >
                        <header className="mb-4">
                            <h3 className="text-xl font-bold tracking-tight md:text-2xl">{section.name}</h3>
                            {section.description && (
                                <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                            )}
                        </header>

                        {section.products.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {section.products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onSelect={() => setSelectedProduct(product)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Nothing in this section yet.</p>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onSelect }: { product: Product; onSelect: () => void }) {
    return (
        <button type="button" onClick={onSelect} className="group w-full text-left">
            <div className="flex h-full items-stretch justify-between gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                        <h4 className="font-semibold leading-snug tracking-tight">{product.name}</h4>
                        {product.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {product.description}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">${Number(product.base_price).toFixed(2)}</p>
                        {product.dietary_tags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {DIETARY_ICONS[tag] || ""} {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                {product.image_url ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-end">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}