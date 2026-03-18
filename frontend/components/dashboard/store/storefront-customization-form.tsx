"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Layout, Moon, Palette, Sun, Type, MousePointer2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";

interface StorefrontCustomizationFormProps {
    store: Store;
    onSuccess?: (updated: Store) => void;
    onStateChange?: (state: { isDirty: boolean; isSubmitting: boolean }) => void;
}

export interface StorefrontCustomizationFormHandle {
    submit: () => void;
    reset: () => void;
}

function FormStateSync({
    state,
    onStateChange,
}: {
    state: { isDirty: boolean; isSubmitting: boolean };
    onStateChange?: (state: { isDirty: boolean; isSubmitting: boolean }) => void;
}) {
    useEffect(() => {
        onStateChange?.(state);
    }, [onStateChange, state]);
    return null;
}

const FONT_OPTIONS = [
    { value: "var(--font-geist-sans)", label: "Modern Sans", description: "Clean and professional" },
    { value: "serif", label: "Classic Serif", description: "Elegant and traditional" },
    { value: "mono", label: "Industrial Mono", description: "Technical and precise" },
];

export const StorefrontCustomizationForm = forwardRef<StorefrontCustomizationFormHandle, StorefrontCustomizationFormProps>(
    function StorefrontCustomizationForm({ store, onSuccess, onStateChange }, ref) {
        const queryClient = useQueryClient();
        const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");

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
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className="space-y-6 lg:col-span-3"
                >
                    <Tabs defaultValue="identity" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="identity" className="gap-2 text-xs">
                                <Layout className="size-3.5" /> Identity
                            </TabsTrigger>
                            <TabsTrigger value="colors" className="gap-2 text-xs">
                                <Palette className="size-3.5" /> Colors
                            </TabsTrigger>
                            <TabsTrigger value="style" className="gap-2 text-xs">
                                <MousePointer2 className="size-3.5" /> Shapes & Font
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="identity" className="space-y-6">
                            <Card className="border-none shadow-none bg-transparent">
                                <CardContent className="p-0 space-y-4">
                                    <form.Field name="logoUrl">
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.name}>Logo URL</Label>
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://example.com/logo.png"
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </form.Field>
                                    <form.Field name="bannerUrl">
                                        {(field) => (
                                            <div className="space-y-2">
                                                <Label htmlFor={field.name}>Banner URL</Label>
                                                <Input
                                                    id={field.name}
                                                    placeholder="https://example.com/banner.png"
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </form.Field>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="colors" className="space-y-6">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <form.Field name="primaryColor">
                                    {(field) => (
                                        <div className="space-y-3">
                                            <Label>Primary Color (Buttons)</Label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    className="size-10 cursor-pointer rounded-lg border-none bg-transparent shadow-sm"
                                                />
                                                <Input
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    className="font-mono uppercase h-10"
                                                />
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">Applied to main call-to-actions.</p>
                                        </div>
                                    )}
                                </form.Field>
                                <form.Field name="accentColor">
                                    {(field) => (
                                        <div className="space-y-3">
                                            <Label>Accent Color</Label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    className="size-10 cursor-pointer rounded-lg border-none bg-transparent shadow-sm"
                                                />
                                                <Input
                                                    value={field.state.value}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    className="font-mono uppercase h-10"
                                                />
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">Used for highlights and badges.</p>
                                        </div>
                                    )}
                                </form.Field>
                            </div>
                        </TabsContent>

                        <TabsContent value="style" className="space-y-10">
                            <form.Field name="fontStyle">
                                {(field) => (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Typography</Label>
                                        <div className="grid gap-2">
                                            {FONT_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => field.handleChange(opt.value)}
                                                    className={cn(
                                                        "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                                                        field.state.value === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50 border-border/50"
                                                    )}
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold" style={{ fontFamily: opt.value }}>{opt.label}</p>
                                                        <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                                                    </div>
                                                    {field.state.value === opt.value && <Check className="size-4 text-primary" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </form.Field>

                            <div className="space-y-8">
                                <form.Field name="borderRadius">
                                    {(field) => (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <Label className="text-sm font-semibold">General Roundness (Cards, Inputs)</Label>
                                                <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded-md">{field.state.value ?? 10}px</span>
                                            </div>
                                            <Slider 
                                                value={[Number(field.state.value ?? 10)]}
                                                onValueChange={(v) => field.handleChange(v[0])}
                                                min={0}
                                                max={32}
                                                step={1}
                                                className="py-4"
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name="buttonRadius">
                                    {(field) => (
                                        <div className="space-y-4">
                                            <Label className="text-sm font-semibold">Button Shape</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { value: "medium", label: "Standard (Matches General)", radius: "inherit" },
                                                    { value: "full", label: "Pill Shape", radius: "9999px" },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => field.handleChange(opt.value)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-3 rounded-xl border p-4 transition-all",
                                                            field.state.value === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50 border-border/50"
                                                        )}
                                                    >
                                                        <div 
                                                            className="h-8 w-20 bg-muted-foreground/20 border-2 border-muted-foreground/10" 
                                                            style={{ borderRadius: opt.value === 'full' ? '9999px' : '8px' }} 
                                                        />
                                                        <span className="text-[11px] font-bold">{opt.label}</span>
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

                {/* ── LIVE PREVIEW SECTION ── */}
                <div className="lg:col-span-2">
                    <div className="sticky top-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Eye className="size-4 text-muted-foreground" />
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Storefront Preview</span>
                            </div>
                            <div className="flex items-center rounded-xl border bg-muted/50 p-1 shadow-sm">
                                <button
                                    onClick={() => setPreviewMode("light")}
                                    className={cn("rounded-lg px-2.5 py-1.5 transition-all", previewMode === "light" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground")}
                                >
                                    <Sun className="size-3.5" />
                                </button>
                                <button
                                    onClick={() => setPreviewMode("dark")}
                                    className={cn("rounded-lg px-2.5 py-1.5 transition-all", previewMode === "dark" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground")}
                                >
                                    <Moon className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        <form.Subscribe selector={(s) => s.values}>
                            {(values) => (
                                <StorefrontPreview values={values} mode={previewMode} storeName={store.name} />
                            )}
                        </form.Subscribe>
                    </div>
                </div>
            </div>
        );
    }
);

function StorefrontPreview({ values, mode, storeName }: { values: any; mode: "light" | "dark"; storeName: string }) {
    const compRadius = `${values.borderRadius}px`;
    const btnRadius = values.buttonRadius === "full" ? "9999px" : compRadius;
    
    const getContrastColor = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? "#000000" : "#ffffff";
    };

    const primaryForeground = getContrastColor(values.primaryColor);

    return (
        <div 
            className={cn(
                "w-full overflow-hidden border shadow-2xl transition-all duration-500",
                mode === "dark" ? "bg-[#09090b] text-white border-white/10" : "bg-white text-slate-950 border-slate-200"
            )}
            style={{ 
                borderRadius: "28px",
                fontFamily: values.fontStyle === 'serif' ? 'serif' : values.fontStyle === 'mono' ? 'monospace' : 'inherit'
            }}
        >
            {/* Header Preview */}
            <div className="flex items-center justify-between border-b p-4 px-6" style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-3">
                    <div className="size-8 overflow-hidden border bg-muted flex items-center justify-center font-bold text-[10px]" style={{ borderRadius: "8px" }}>
                        {values.logoUrl ? <img src={values.logoUrl} className="size-full object-cover" /> : storeName[0]}
                    </div>
                    <span className="text-[13px] font-bold truncate max-w-[100px] tracking-tight">{storeName}</span>
                </div>
                <div className="flex gap-2">
                    <div className="h-8 w-14 rounded-full bg-muted/50 border border-border/20 flex items-center justify-center gap-2">
                        <div className="size-3.5 border-2 border-current rounded-[2px]" />
                        <div className="size-1.5 rounded-full bg-current opacity-20" />
                    </div>
                </div>
            </div>

            {/* Banner Preview */}
            <div className="relative h-28 w-full bg-muted overflow-hidden">
                {values.bannerUrl ? (
                    <img src={values.bannerUrl} className="size-full object-cover" />
                ) : (
                    <div className="size-full bg-linear-to-br from-muted-foreground/10 to-muted" />
                )}
                <div className="absolute inset-0 bg-black/5" />
            </div>

            <div className="p-6 space-y-6">
                {/* Product Card Preview */}
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4 p-4 border bg-card/50 transition-all" style={{ borderRadius: compRadius, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                        <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold leading-none tracking-tight">Classic Burger</h4>
                                <div 
                                    className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60 border border-slate-200 dark:border-white/5" 
                                >
                                    Popular
                                </div>
                            </div>
                            <p className="text-[11px] opacity-50 line-clamp-2 leading-snug">Grass-fed beef, melted cheddar, and secret aioli.</p>
                            <p className="text-xs font-black pt-1" style={{ color: mode === 'dark' ? 'white' : 'black' }}>$12.00</p>
                        </div>
                        <div className="size-16 rounded-xl bg-muted border overflow-hidden" style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                            <div className="size-full bg-linear-to-tr from-muted-foreground/10 to-transparent" />
                        </div>
                    </div>
                </div>

                {/* Primary Button Preview */}
                <button 
                    className="w-full py-3.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.97]"
                    style={{ 
                        backgroundColor: values.primaryColor, 
                        color: primaryForeground,
                        borderRadius: btnRadius,
                        boxShadow: mode === 'light' ? `0 12px 24px -8px ${values.primaryColor}50` : 'none'
                    }}
                >
                    Add to Cart • $12.00
                </button>

                {/* Secondary Elements */}
                <div className="flex justify-center gap-6 border-t pt-5" style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center gap-2 opacity-40">
                        <Sun className="size-3" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Sun-Fri</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-40">
                        <Type className="size-3" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Geist Sans</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
