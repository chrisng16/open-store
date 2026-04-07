"use client";

import {
    type FormDirtyState,
} from "@/components/dashboard/store/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    Info,
    Layout,
    Minus,
    Moon,
    MousePointer2,
    Palette,
    Plus,
    Search,
    ShoppingBag,
    Smartphone,
    Sun
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";

interface StorefrontCustomizationFormProps {
    store: Store;
    onSuccess?: (updated: Store) => void;
    onStateChange?: (state: FormDirtyState) => void;
}

export interface StorefrontCustomizationFormHandle {
    submit: () => void;
    reset: () => void;
}

function FormStateSync({
    state,
    onStateChange,
}: {
    state: FormDirtyState;
    onStateChange?: (state: FormDirtyState) => void;
}) {
    useEffect(() => {
        onStateChange?.(state);
    }, [onStateChange, state]);
    return null;
}

const FONT_OPTIONS = [
    { value: "var(--font-geist-sans)", label: "Geist Sans", description: "Modern and professional" },
    { value: "var(--font-geist-mono)", label: "Geist Mono", description: "Technical and precise" },
    { value: "Inter, sans-serif", label: "Inter", description: "Standard and highly legible" },
    { value: "serif", label: "System Serif", description: "Elegant and traditional" },
    { value: "system-ui, sans-serif", label: "System Native", description: "Familiar and fast" },
];

const SHAPE_SNAPS = [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64];

const PRESET_PALETTES = [
    { name: "Neutral", primary: "#171717", accent: "#f59e0b" },
    { name: "Ocean", primary: "#0ea5e9", accent: "#38bdf8" },
    { name: "Emerald", primary: "#059669", accent: "#10b981" },
    { name: "Rose", primary: "#e11d48", accent: "#fb7185" },
    { name: "Violet", primary: "#7c3aed", accent: "#a78bfa" },
    { name: "Amber", primary: "#d97706", accent: "#f59e0b" },
];

type PreviewScene = "storefront" | "product" | "cart" | "success";

export const StorefrontCustomizationForm = forwardRef<StorefrontCustomizationFormHandle, StorefrontCustomizationFormProps>(
    function StorefrontCustomizationForm({ store, onSuccess, onStateChange }, ref) {
        const queryClient = useQueryClient();
        const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
        const [previewScene, setPreviewScene] = useState<PreviewScene>("storefront");

        const saveStoreMutation = useMutation({
            mutationFn: async (value: any) => {
                const payload = {
                    logo_url: value.logoUrl || null,
                    banner_url: value.bannerUrl || null,
                    theme_config: {
                        primaryColor: value.primaryColor || "#171717",
                        accentColor: value.accentColor || "#f59e0b",
                        borderRadius: value.borderRadius || 10,
                        buttonRadius: value.buttonRadius || "medium",
                        fontStyle: value.fontStyle || "var(--font-geist-sans)",
                    }
                };

                return fetchWithAccessToken<Store>(`/stores/${store.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            onSuccess: async (updated) => {
                await queryClient.invalidateQueries({ queryKey: ["stores"] });
                await queryClient.invalidateQueries({ queryKey: ["store", updated.id] });
                form.reset();
                toast.success("Storefront customization saved");
                onSuccess?.(updated);
            },
            onError: (error) => {
                toast.error(error instanceof Error ? error.message : "Failed to save customization");
            },
        });

        const currentTheme = store.themeConfig as any;

        const form = useForm({
            defaultValues: {
                logoUrl: store.logoUrl ?? "",
                bannerUrl: store.bannerUrl ?? "",
                primaryColor: currentTheme?.primaryColor ?? "#171717",
                accentColor: currentTheme?.accentColor ?? "#f59e0b",
                borderRadius: currentTheme?.borderRadius ?? 10,
                buttonRadius: currentTheme?.buttonRadius ?? "medium",
                fontStyle: currentTheme?.fontStyle ?? "var(--font-geist-sans)",
            },
            onSubmit: async ({ value }) => {
                await saveStoreMutation.mutateAsync(value);
            },
        });

        useImperativeHandle(
            ref,
            () => ({
                submit: () => void form.handleSubmit(),
                reset: () => form.reset(),
            }),
            [form]
        );

        return (
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
                <div className="lg:col-span-7 space-y-8">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void form.handleSubmit();
                        }}
                        className="space-y-8"
                    >
                        <Tabs defaultValue="identity" className="w-full">
                            <TabsList className="inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground w-full sm:w-auto mb-8">
                                <TabsTrigger value="identity" className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2">
                                    <Layout className="size-4" /> Identity
                                </TabsTrigger>
                                <TabsTrigger value="colors" className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2">
                                    <Palette className="size-4" /> Colors
                                </TabsTrigger>
                                <TabsTrigger value="style" className="rounded-lg px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2">
                                    <MousePointer2 className="size-4" /> Style
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="identity" className="space-y-6 animate-in fade-in-50 duration-500">
                                <div className="grid gap-6">
                                    <form.Field name="logoUrl">
                                        {(field) => (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <Label htmlFor={field.name} className="text-sm font-semibold">Store Logo</Label>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Optional</span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="size-16 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border/50 shrink-0">
                                                        {field.state.value ? (
                                                            <img src={field.state.value} className="size-full object-cover" />
                                                        ) : (
                                                            <ShoppingBag className="size-6 text-muted-foreground/40" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <Input
                                                            id={field.name}
                                                            placeholder="https://example.com/logo.png"
                                                            value={field.state.value}
                                                            onChange={(e) => field.handleChange(e.target.value)}
                                                            className="h-10 rounded-xl"
                                                        />
                                                        <p className="text-[11px] text-muted-foreground">Transparent PNG recommended. 512x512px.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field name="bannerUrl">
                                        {(field) => (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <Label htmlFor={field.name} className="text-sm font-semibold">Store Banner</Label>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Optional</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="h-32 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border/50">
                                                        {field.state.value ? (
                                                            <img src={field.state.value} className="size-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 opacity-40">
                                                                <Layout className="size-8" />
                                                                <span className="text-xs font-medium">Banner Preview</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Input
                                                        id={field.name}
                                                        placeholder="https://example.com/banner.png"
                                                        value={field.state.value}
                                                        onChange={(e) => field.handleChange(e.target.value)}
                                                        className="h-10 rounded-xl"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground">Appears at the top of your storefront. 1200x400px recommended.</p>
                                                </div>
                                            </div>
                                        )}
                                    </form.Field>
                                </div>
                            </TabsContent>

                            <TabsContent value="colors" className="space-y-10 animate-in fade-in-50 duration-500">
                                <div className="grid gap-10">
                                    <div className="space-y-4">
                                        <Label className="text-sm font-semibold">Quick Palettes</Label>
                                        <div className="flex flex-wrap gap-3">
                                            {PRESET_PALETTES.map((p) => (
                                                <button
                                                    key={p.name}
                                                    type="button"
                                                    onClick={() => {
                                                        form.setFieldValue("primaryColor", p.primary);
                                                        form.setFieldValue("accentColor", p.accent);
                                                    }}
                                                    className="group flex items-center gap-2 rounded-full border bg-background pl-2 pr-3 py-1.5 transition-all hover:border-primary/50"
                                                >
                                                    <div className="flex -space-x-1.5">
                                                        <div className="size-4 rounded-full border border-background shadow-sm" style={{ backgroundColor: p.primary }} />
                                                        <div className="size-4 rounded-full border border-background shadow-sm" style={{ backgroundColor: p.accent }} />
                                                    </div>
                                                    <span className="text-xs font-medium">{p.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-8 sm:grid-cols-2">
                                        <form.Field name="primaryColor">
                                            {(field) => (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-sm font-semibold">Primary Brand</Label>
                                                        <div className="size-4 rounded-full" style={{ backgroundColor: field.state.value }} />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative size-12 shrink-0">
                                                            <input
                                                                type="color"
                                                                value={field.state.value}
                                                                onChange={(e) => field.handleChange(e.target.value)}
                                                                className="absolute inset-0 size-full cursor-pointer opacity-0"
                                                            />
                                                            <div className="size-full rounded-xl border shadow-sm" style={{ backgroundColor: field.state.value }} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <Input
                                                                value={field.state.value}
                                                                onChange={(e) => field.handleChange(e.target.value)}
                                                                className="font-mono uppercase h-12 rounded-xl"
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed">Used for primary buttons, active states, and your main brand presence.</p>
                                                </div>
                                            )}
                                        </form.Field>

                                        <form.Field name="accentColor">
                                            {(field) => (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-sm font-semibold">Accent & Highlights</Label>
                                                        <div className="size-4 rounded-full" style={{ backgroundColor: field.state.value }} />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative size-12 shrink-0">
                                                            <input
                                                                type="color"
                                                                value={field.state.value}
                                                                onChange={(e) => field.handleChange(e.target.value)}
                                                                className="absolute inset-0 size-full cursor-pointer opacity-0"
                                                            />
                                                            <div className="size-full rounded-xl border shadow-sm" style={{ backgroundColor: field.state.value }} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <Input
                                                                value={field.state.value}
                                                                onChange={(e) => field.handleChange(e.target.value)}
                                                                className="font-mono uppercase h-12 rounded-xl"
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed">Applied to badges, labels, and secondary interactive elements.</p>
                                                </div>
                                            )}
                                        </form.Field>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="style" className="space-y-12 animate-in fade-in-50 duration-500">
                                <form.Field name="fontStyle">
                                    {(field) => (
                                        <div className="space-y-4">
                                            <Label className="text-sm font-semibold">Typography Pairing</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {FONT_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => field.handleChange(opt.value)}
                                                        className={cn(
                                                            "group relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all",
                                                            field.state.value === opt.value
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                                : "hover:bg-muted/50 border-border/50"
                                                        )}
                                                    >
                                                        <span className="text-sm font-bold tracking-tight" style={{ fontFamily: opt.value }}>{opt.label}</span>
                                                        <span className="text-[10px] text-muted-foreground">{opt.description}</span>
                                                        {field.state.value === opt.value && (
                                                            <div className="absolute right-3 top-3">
                                                                <CheckCircle2 className="size-4 text-primary" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </form.Field>

                                <div className="space-y-10">
                                    <form.Field name="borderRadius">
                                        {(field) => (
                                            <div className="space-y-6">
                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-1">
                                                        <Label className="text-sm font-semibold">Interface Roundness</Label>
                                                        <p className="text-[11px] text-muted-foreground">Applies to cards, inputs, and sections.</p>
                                                    </div>
                                                    <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-lg border">{field.state.value ?? 12}px</span>
                                                </div>
                                                <div className="px-1">
                                                    <Slider
                                                        value={[Number(field.state.value ?? 12)]}
                                                        onValueChange={(v) => {
                                                            // Snap logic
                                                            const val = v[0];
                                                            const snapped = SHAPE_SNAPS.reduce((prev, curr) =>
                                                                Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                                                            );
                                                            field.handleChange(snapped);
                                                        }}
                                                        min={0}
                                                        max={64}
                                                        step={1}
                                                        className="py-4"
                                                    />
                                                    <div className="flex justify-between px-1 mt-1">
                                                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Sharp</span>
                                                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Round</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </form.Field>

                                    <form.Field name="buttonRadius">
                                        {(field) => (
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold">Button Aesthetics</Label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {[
                                                        { value: "medium", label: "Standard", sub: "Matches Interface" },
                                                        { value: "full", label: "Pill Shape", sub: "Circular Ends" },
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => field.handleChange(opt.value)}
                                                            className={cn(
                                                                "group flex flex-col gap-4 rounded-2xl border p-5 transition-all text-left",
                                                                field.state.value === opt.value
                                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                                    : "hover:bg-muted/50 border-border/50"
                                                            )}
                                                        >
                                                            <div className="w-full h-10 flex items-center justify-center">
                                                                <div
                                                                    className="h-9 w-24 bg-primary/20 border-2 border-primary/10 shadow-sm flex items-center justify-center"
                                                                    style={{ borderRadius: opt.value === 'full' ? '9999px' : '8px' }}
                                                                >
                                                                    <div className="h-1 w-8 bg-primary/40 rounded-full" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-bold">{opt.label}</p>
                                                                <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </form.Field>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <form.Subscribe
                            selector={(state) => ({
                                isDirty: state.isDirty,
                                isSubmitting: state.isSubmitting || saveStoreMutation.isPending,
                            })}
                        >
                            {(state) => (
                                <FormStateSync state={state} onStateChange={onStateChange} />
                            )}
                        </form.Subscribe>
                    </form>
                </div>

                {/* ── LIVE PREVIEW SECTION ── */}
                <div className="lg:col-span-5 relative">
                    <div className="sticky top-6">
                        <div className="mb-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <Smartphone className="size-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Storefront Preview</span>
                                        <span className="text-[10px] text-muted-foreground/60 font-medium">Real-time visualization</span>
                                    </div>
                                </div>

                                <div className="flex items-center rounded-xl border bg-muted/50 p-1 shadow-xs">
                                    <button
                                        onClick={() => setPreviewMode("light")}
                                        className={cn("rounded-lg p-1.5 transition-all", previewMode === "light" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground")}
                                    >
                                        <Sun className="size-4" />
                                    </button>
                                    <button
                                        onClick={() => setPreviewMode("dark")}
                                        className={cn("rounded-lg p-1.5 transition-all", previewMode === "dark" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground")}
                                    >
                                        <Moon className="size-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(["storefront", "product", "cart", "success"] as const).map((scene) => (
                                    <button
                                        key={scene}
                                        onClick={() => setPreviewScene(scene)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                                            previewScene === scene
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/50 text-muted-foreground border-transparent hover:border-border/50"
                                        )}
                                    >
                                        {scene}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form.Subscribe selector={(s) => s.values}>
                            {(values) => (
                                <StorefrontPreview
                                    values={values}
                                    mode={previewMode}
                                    scene={previewScene}
                                    storeName={store.name}
                                />
                            )}
                        </form.Subscribe>
                    </div>
                </div>
            </div>
        );
    }
);

function StorefrontPreview({ values, mode, scene, storeName }: { values: any; mode: "light" | "dark"; scene: PreviewScene; storeName: string }) {
    const compRadius = `${values.borderRadius}px`;
    const btnRadius = values.buttonRadius === "full" ? "9999px" : compRadius;

    const getContrastColor = (hex: string) => {
        if (!hex || typeof hex !== 'string') return "#ffffff";
        const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
        if (cleanHex.length !== 6) return "#ffffff";
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? "#000000" : "#ffffff";
    };

    const primaryForeground = getContrastColor(values.primaryColor);
    const accentForeground = getContrastColor(values.accentColor);

    return (
        <div
            className={cn(
                "w-full aspect-[9/16] max-h-[700px] overflow-hidden border shadow-2xl transition-all duration-500 flex flex-col relative",
                mode === "dark" ? "bg-[#09090b] text-white border-white/10" : "bg-[#f8fafc] text-slate-950 border-slate-200"
            )}
            style={{
                borderRadius: "40px",
                fontFamily: values.fontStyle === 'serif' ? 'serif' : values.fontStyle === 'mono' ? 'monospace' : values.fontStyle
            }}
        >
            {/* Device Frame Top */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-slate-950 dark:bg-white/10 z-50 flex items-center justify-center">
                <div className="size-1 rounded-full bg-white/10 dark:bg-white/20 mr-2" />
                <div className="w-8 h-1 rounded-full bg-white/10 dark:bg-white/20" />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide pt-8 flex flex-col">
                <AnimatePresence mode="wait">
                    {scene === "storefront" && (
                        <motion.div
                            key="storefront"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="flex-1 flex flex-col"
                        >
                            {/* Header */}
                            <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-inherit/80 backdrop-blur-md z-10 border-b" style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                                <div className="flex items-center gap-2.5">
                                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                                        {values.logoUrl ? <img src={values.logoUrl} className="size-full object-cover" /> : <ShoppingBag className="size-4 opacity-50" />}
                                    </div>
                                    <span className="text-xs font-black tracking-tighter truncate max-w-[120px] uppercase">{storeName}</span>
                                </div>
                                <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center">
                                    <Search className="size-3.5 opacity-50" />
                                </div>
                            </div>

                            {/* Banner */}
                            <div className="px-6 py-4">
                                <div className="h-40 rounded-3xl bg-muted overflow-hidden relative group">
                                    {values.bannerUrl ? (
                                        <img src={values.bannerUrl} className="size-full object-cover" />
                                    ) : (
                                        <div className="size-full bg-linear-to-br from-primary/10 to-accent/5" />
                                    )}
                                    <div className="absolute inset-0 bg-black/5" />
                                </div>
                            </div>

                            {/* Menu Categories */}
                            <div className="px-6 pb-2 overflow-x-auto scrollbar-hide flex gap-2">
                                {["Popular", "Burgers", "Sides", "Drinks"].map((cat, i) => (
                                    <div
                                        key={cat}
                                        className="px-3 py-1.5 rounded-full text-[10px] font-bold border shrink-0"
                                        style={{
                                            backgroundColor: i === 0 ? values.primaryColor : 'transparent',
                                            color: i === 0 ? primaryForeground : 'inherit',
                                            borderColor: i === 0 ? values.primaryColor : mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {cat}
                                    </div>
                                ))}
                            </div>

                            {/* Products */}
                            <div className="px-6 py-4 space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="p-4 border bg-card/20 flex gap-4 transition-all"
                                        style={{ borderRadius: compRadius, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                    >
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold leading-tight">Product {i}</h4>
                                                {i === 1 && (
                                                    <div className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider" style={{ backgroundColor: values.accentColor, color: accentForeground }}>
                                                        Best Seller
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] opacity-50 line-clamp-2 leading-relaxed">A delicious preview of what your customers will see on your menu.</p>
                                            <p className="text-xs font-black pt-1">$12.00</p>
                                        </div>
                                        <div className="size-20 rounded-2xl bg-muted/50 shrink-0 border border-black/5 overflow-hidden">
                                            <div className="size-full bg-linear-to-tr from-primary/5 to-transparent" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Floating Cart Button */}
                            <div className="mt-auto p-6 bg-inherit">
                                <div
                                    className="w-full h-14 flex items-center justify-between px-6 shadow-xl"
                                    style={{
                                        backgroundColor: values.primaryColor,
                                        color: primaryForeground,
                                        borderRadius: btnRadius
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-6 rounded-lg bg-white/20 flex items-center justify-center font-bold text-[10px]">2</div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">View Cart</span>
                                    </div>
                                    <span className="text-xs font-black">$24.00</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {scene === "product" && (
                        <motion.div
                            key="product"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="flex-1 flex flex-col p-6 space-y-6"
                        >
                            <div className="aspect-square rounded-[40px] bg-muted overflow-hidden border shadow-lg relative">
                                <div className="size-full bg-linear-to-br from-primary/20 via-muted to-accent/10" />
                                <button className="absolute top-4 left-4 size-10 rounded-full bg-white/90 dark:bg-black/80 flex items-center justify-center shadow-md">
                                    <Layout className="size-4 rotate-180" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-xl font-black tracking-tighter uppercase">Signature Dish</h2>
                                        <div className="text-xl font-black">$18.00</div>
                                    </div>
                                    <p className="text-xs opacity-60 leading-relaxed">
                                        A premium menu item showcase. This is where your product details, descriptions, and options come to life.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Choose Options</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[1, 2].map((j) => (
                                            <div
                                                key={j}
                                                className="p-3 border flex items-center justify-between"
                                                style={{ borderRadius: `calc(${compRadius} * 0.7)` }}
                                            >
                                                <span className="text-xs font-bold">Extra Topping {j}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] opacity-40">+$2.00</span>
                                                    <div className={cn("size-4 rounded-full border flex items-center justify-center", j === 1 ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                                        {j === 1 && <Check className="size-2.5 text-primary-foreground" />}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <div className="flex items-center bg-muted rounded-full p-1 border">
                                        <button className="size-8 rounded-full flex items-center justify-center hover:bg-background"><Minus className="size-3" /></button>
                                        <span className="w-8 text-center text-xs font-bold">1</span>
                                        <button className="size-8 rounded-full flex items-center justify-center hover:bg-background"><Plus className="size-3" /></button>
                                    </div>
                                    <button
                                        className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest shadow-lg"
                                        style={{ backgroundColor: values.primaryColor, color: primaryForeground, borderRadius: btnRadius }}
                                    >
                                        Add to Cart • $20.00
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {scene === "cart" && (
                        <motion.div
                            key="cart"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col p-6"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Your Cart</h2>
                                <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">2 Items</span>
                            </div>

                            <div className="flex-1 space-y-6">
                                {[1, 2].map((i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="size-16 rounded-2xl bg-muted shrink-0" />
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-xs font-bold uppercase">Item {i}</span>
                                                <span className="text-xs font-bold">$12.00</span>
                                            </div>
                                            <p className="text-[10px] opacity-50">Standard Choice</p>
                                            <div className="flex items-center gap-2 pt-1">
                                                <button className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100">Remove</button>
                                                <span className="text-[9px] opacity-20">/</span>
                                                <button className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100">Edit</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto space-y-4 pt-6 border-t" style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] opacity-50">
                                        <span>Subtotal</span>
                                        <span>$24.00</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] opacity-50">
                                        <span>Estimated Tax</span>
                                        <span>$2.40</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black pt-2 uppercase">
                                        <span>Total</span>
                                        <span>$26.40</span>
                                    </div>
                                </div>

                                <button
                                    className="w-full h-14 text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"
                                    style={{ backgroundColor: values.primaryColor, color: primaryForeground, borderRadius: btnRadius }}
                                >
                                    <CreditCard className="size-4" />
                                    Checkout Now
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {scene === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                        >
                            <div
                                className="size-24 rounded-[32px] mb-8 flex items-center justify-center shadow-2xl animate-bounce"
                                style={{ backgroundColor: values.primaryColor, color: primaryForeground, borderRadius: compRadius }}
                            >
                                <CheckCircle2 className="size-10" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Order Confirmed!</h2>
                            <p className="text-xs opacity-50 mb-8 leading-relaxed">
                                Your order has been placed successfully. We&apos;ll notify you when it&apos;s ready for pickup.
                            </p>

                            <div
                                className="w-full p-6 border bg-card/10 space-y-4"
                                style={{ borderRadius: compRadius, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                            >
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="opacity-50 uppercase font-black">Order ID</span>
                                    <span className="font-mono font-bold">#OS-1234</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="opacity-50 uppercase font-black">Wait Time</span>
                                    <span className="flex items-center gap-1 font-bold"><Clock className="size-3" /> 15-20 mins</span>
                                </div>
                            </div>

                            <button className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 flex items-center gap-2">
                                Back to Store <ArrowRight className="size-3" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Indicator */}
            <div className="p-4 flex flex-col items-center gap-4">
                <div className="w-1/3 h-1.5 rounded-full bg-slate-950/10 dark:bg-white/10" />
                <div className="flex items-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-[0.3em]">
                    <span className="flex items-center gap-1.5"><Info className="size-3" /> Info</span>
                    <span className="flex items-center gap-1.5"><Layout className="size-3" /> Menu</span>
                    <span className="flex items-center gap-1.5"><ShoppingBag className="size-3" /> Cart</span>
                </div>
            </div>
        </div>
    );
}
