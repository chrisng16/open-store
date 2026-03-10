"use client";

import { CartButton } from "@/components/store/cart-button";
import { ProductDialog } from "@/components/store/product-dialog";
import { Badge } from "@/components/ui/badge";
import { useMenuScrollSpy } from "@/hooks/use-menu-scroll-spy";
import { useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Option = {
    id: string;
    name: string;
    unit_amount: number;
    min_option_choice_quantity: number;
    max_option_choice_quantity: number;
    default_quantity: number;
};
type OptionList = {
    id: string;
    name: string;
    selection_node: "single_select" | "multi_select" | "aggregate_quantity";
    min_num_options: number;
    max_num_options: number;
    min_aggregate_options_quantity: number;
    max_aggregate_options_quantity: number;
    is_optional: boolean;
    options: Option[];
};
type Product = {
    id: string; store_id: string; category_id: string | null;
    name: string; description: string | null; unit_amount: number;
    image_url: string | null; dietary_tags: string[] | null;
    allergens: string[] | null; option_lists: OptionList[];
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
        <div className="relative">
            {/* Left arrow */}
            <button
                type="button"
                onClick={() => scrollBy("left")}
                aria-hidden={!canScrollLeft}
                className={cn(
                    "absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/70 bg-background/95 p-2 shadow-sm transition-all",
                    canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>

            {/* Scrollable tabs */}
            <div
                ref={tabScrollerRef}
                className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto px-12 py-1"
            >
                {sections.map((section) => (
                    <button
                        key={section.id}
                        ref={(node) => { tabButtonRefs.current[section.id] = node; }}
                        type="button"
                        onClick={() => navigateTo(section.id)}
                        className={cn(
                            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-all",
                            activeSection === section.id
                                ? "border-foreground bg-card text-foreground shadow-sm"
                                : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
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
                    "absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/70 bg-background/95 p-2 shadow-sm transition-all",
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            {/* Product dialog */}
            {selectedProduct && (
                <ProductDialog
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    onAddToCart={(product, selections, qty) => {
                        const options = product.option_lists.flatMap((list) =>
                            list.options.flatMap((option) => {
                                const selectedCount = selections[list.id]?.[option.id] ?? 0;
                                if (selectedCount <= 0) return [];

                                return Array.from({ length: selectedCount }, () => ({
                                    option_id: option.id,
                                    option_name: option.name,
                                    unit_amount: Number(option.unit_amount),
                                    quantity: 1,
                                    option_list_id: list.id,
                                }));
                            })
                        );

                        // Snapshot option lists so items remain editable later
                        const product_option_lists = product.option_lists.map((list) => ({
                            id: list.id,
                            name: list.name,
                            selection_node: list.selection_node,
                            min_num_options: list.min_num_options,
                            max_num_options: list.max_num_options,
                            min_aggregate_options_quantity: list.min_aggregate_options_quantity,
                            max_aggregate_options_quantity: list.max_aggregate_options_quantity,
                            is_optional: list.is_optional,
                            options: list.options.map((option) => ({
                                id: option.id,
                                name: option.name,
                                unit_amount: Number(option.unit_amount),
                                min_option_choice_quantity: option.min_option_choice_quantity,
                                max_option_choice_quantity: option.max_option_choice_quantity,
                                default_quantity: option.default_quantity,
                            })),
                        }));

                        setStoreSlug(slug);
                        addItem({
                            product_id: product.id,
                            product_name: product.name,
                            unit_amount: Number(product.unit_amount),
                            quantity: qty,
                            options,
                            image_url: product.image_url,
                            product_option_lists,
                        });
                    }}
                />
            )}

            {/* ── Inline store info (not sticky, scrolls away) ── */}
            <div ref={storeInfoRef} className="py-6">
                <div className="grid gap-5 rounded-[2rem] border border-border/70 bg-card p-6 shadow-[0_18px_48px_rgba(0,0,0,0.05)] lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                    <div className="space-y-5">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground" style={{ color: "var(--store-primary)" }}>
                                Menu browser
                            </p>
                            <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">{storeName}</h2>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                                {storeDescription || "Browse the full menu by section, scan details quickly, and add items without losing your place."}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full px-3 py-1">Pickup only</Badge>
                            <Badge variant="outline" className="rounded-full px-3 py-1">{totalItems} items</Badge>
                            <Badge variant="outline" className="rounded-full px-3 py-1">Built for fast ordering</Badge>
                        </div>
                    </div>
                    <div className="flex w-full h-full items-start justify-end">
                        <CartButton slug={slug} />
                    </div>
                </div>
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
                className="sticky z-20 pt-3"
                style={{ top: navbarHeight }}
            >
                <div className="rounded-[1.75rem] border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/88">
                    {/* Compact store name row — slides in after scrolling past inline header */}
                    <div
                        className={cn(
                            "grid transition-all duration-200",
                            pastStoreInfo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                        )}
                    >
                        {/* Inner div must have overflow-visible so the cart badge isn't clipped */}
                        <div className="overflow-visible">
                            <div className="flex items-center justify-between gap-4 px-2 pb-3">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Now browsing</p>
                                    <h2 className="text-lg font-semibold tracking-tight">{storeName}</h2>
                                </div>
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
            </div>

            {/* ── Menu sections ── */}
            <div className="space-y-12 pb-10 pt-8">
                {sections.map((section) => (
                    <section
                        key={section.id}
                        ref={(node) => { sectionRefs.current[section.id] = node; }}
                    >
                        <header className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">{section.name}</h3>
                                {section.description && (
                                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{section.description}</p>
                                )}
                            </div>
                            {section.description && (
                                <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground md:block">
                                    {section.products.length} item{section.products.length === 1 ? "" : "s"}
                                </p>
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
            <div className="flex h-full items-stretch justify-between gap-4 rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <h4 className="font-semibold leading-snug tracking-tight">{product.name}</h4>
                            <div className="rounded-full border border-border/70 bg-background px-2 py-1 text-xs font-semibold">
                                ${(Number(product.unit_amount) / 100).toFixed(2)}
                            </div>
                        </div>
                        {product.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {product.description}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {product.dietary_tags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="rounded-full text-xs">
                                {DIETARY_ICONS[tag] || ""} {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                {product.image_url ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/70">
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-end">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}