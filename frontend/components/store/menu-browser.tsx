"use client";

import { Badge } from "@/components/ui/badge";
import { useMenuScrollSpy } from "@/hooks/use-menu-scroll-spy";
import { useCartMutations } from "@/lib/cart-store";
import { Product, ProductWithCategoryListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStorefrontProductDialogState } from "@/stores/ui-store";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProductDialog } from "./product-dialog";

type Option = {
    id: string;
    name: string;
    unitAmount: number;
    minOptionChoiceQuantity: number;
    maxOptionChoiceQuantity: number;
    defaultQuantity: number;
};
type OptionList = {
    id: string;
    name: string;
    selectionNode: "single_select" | "multi_select" | "aggregate_quantity";
    minNumOptions: number;
    maxNumOptions: number;
    minAggregateOptionsQuantity: number;
    maxAggregateOptionsQuantity: number;
    isOptional: boolean;
    options: Option[];
};

type CategorySection = { id: string; name: string; description: string | null; products: (ProductWithCategoryListItem)[] };

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
                className="no-scrollbar flex flex-1 items-end gap-1 overflow-x-auto  overflow-y-hidden pointer-events-none px-4"
            >
                {sections.map((section) => (
                    <button
                        key={section.id}
                        ref={(node) => { tabButtonRefs.current[section.id] = node; }}
                        type="button"
                        onClick={() => navigateTo(section.id)}
                        className={cn(
                            "shrink-0 border-b-4 rounded px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors pointer-events-auto",
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
    storeId, slug, storeName, storeDescription, sections, defaultCategory,
    navbarHeight = 64,
    bannerUrl,
    accentColor,
}: {
    storeId: string;
    slug: string; storeName: string; storeDescription?: string | null;
    sections: CategorySection[]; defaultCategory: string;
    /** Height of the global navbar in px. Used to offset the sticky header. Defaults to 80. */
    navbarHeight?: number;
    bannerUrl?: string | null;
    accentColor?: unknown;
}) {
    // Ref for the full inline store-info block (not sticky).
    const storeInfoRef = useRef<HTMLDivElement | null>(null);
    // Ref for the sticky tab bar container.
    const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
    const tabScrollerRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const { setStoreSlug, addItem } = useCartMutations();
    const storefrontProductDialog = useStorefrontProductDialogState();

    const totalItems = useMemo(
        () => sections.reduce((sum, s) => sum + s.products.length, 0),
        [sections],
    );
    const productsById = useMemo(
        () => new Map(sections.flatMap((section) => section.products.map((product) => [product.id, product]))),
        [sections]
    );
    const selectedProduct = storefrontProductDialog.itemId
        ? productsById.get(storefrontProductDialog.itemId) ?? null
        : null;

    // The sticky offset is navbarHeight + the reserved compact row slot + the sticky tab bar height + a small gap.
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
        <div className="container mx-auto px-4 py-3">
            <ProductDialog
                open={storefrontProductDialog.isOpen && !!selectedProduct}
                productId={selectedProduct?.id ?? ""}
                storeId={storeId}
                preview={{
                    name: selectedProduct?.name,
                    description: selectedProduct?.description,
                    imageUrl: selectedProduct?.imageUrl,
                }}
                onClose={storefrontProductDialog.close}
                onAddToCart={(
                    product: Product,
                    selections: Record<string, Record<string, number>>,
                    qty: number
                ) => {
                    const options = product.optionLists.flatMap((list) =>
                        list.options.flatMap((option): {
                            option_id: string;
                            option_name: string;
                            quantity: number;
                            option_list_id: string;
                        }[] => {
                            const selectedCount = selections[list.id]?.[option.id] ?? 0;
                            if (selectedCount <= 0) return [];

                            return [{
                                option_id: option.id,
                                option_name: option.name,
                                quantity: selectedCount,
                                option_list_id: list.id,
                            }];
                        })
                    );

                    toast.success(`Added ${qty} ${product.name} to cart`, {
                        action: {
                            label: "View cart",
                            onClick: () => {
                                const cartUrl = `/store/${slug}/cart`;
                                window.location.href = cartUrl;
                            },
                        }
                    });

                    setStoreSlug(slug);
                    addItem({
                        product_id: product.id,
                        product_name: product.name,
                        quantity: qty,
                        options,
                        image_url: product.imageUrl,
                    });
                    storefrontProductDialog.close();
                }}
            />

            {/* ── Inline store info (not sticky, scrolls away) ── */}
            <div ref={storeInfoRef} className="overflow-hidden border border-border/70 bg-card rounded-2xl mb-6 shadow-sm">
                {bannerUrl ? (
                    <div className="h-48 w-full overflow-hidden md:h-64">
                        <img
                            src={bannerUrl}
                            alt={storeName}
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                        />
                    </div>
                ) : (
                    <div className="h-24 w-full bg-linear-to-br from-muted/50 to-muted md:h-32" />
                )}

                <div className="flex flex-wrap items-start justify-between gap-4 p-6 md:p-8">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight md:text-4xl">{storeName}</h2>
                        <p className="max-w-2xl text-sm text-muted-foreground md:text-base leading-relaxed">
                            {storeDescription || "Playful bites, crafted fast for pickup."}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Badge variant="secondary">Pickup only</Badge>
                            <Badge variant="outline" className="font-medium">{totalItems} items</Badge>
                            <Badge variant="outline" className="font-medium text-emerald-600 border-emerald-500/20 bg-emerald-500/5">Ready in 15-25 min</Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky tab bar in a separate container below the compact nav slot */}
            <div
                ref={stickyHeaderRef}
                className="sticky z-30 bg-background"
                style={{ top: navbarHeight - 8 }}
            >
                <TabBar
                    sections={sections}
                    activeSection={activeSection}
                    navigateTo={navigateTo}
                    tabScrollerRef={tabScrollerRef}
                    tabButtonRefs={tabButtonRefs}
                />
            </div>

            {/* ── Menu sections ── */}
            <div className="space-y-10 pt-10">
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
                                        onSelect={() => storefrontProductDialog.open(product.id)}
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

function ProductCard({
    product,
    onSelect,
}: {
    product: Product;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className="group w-full text-left"
        >
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
                        <p className="text-sm font-bold">${(Number(product.unitAmount) / 100).toFixed(2)}</p>
                        {product.dietaryTags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {DIETARY_ICONS[tag] || ""} {tag}
                            </Badge>
                        ))}
                    </div>
                </div>

                {product.imageUrl ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-end">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}