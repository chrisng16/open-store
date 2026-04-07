"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import type { Store } from "@/lib/types";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { toast } from "sonner";

import { BusinessHoursSelector } from "@/components/dashboard/store/business-hours-selector";
import { TimezoneSelector } from "@/components/dashboard/store/timezone-selector";
import {
    type FormDirtyState,
    normalizeStoreBusinessHours,
    type StoreEditFormValues,
    type StoreFormMode,
} from "@/components/dashboard/store/types";

// ─── Props & handle ───────────────────────────────────────────────────────────

interface StoreEditFormProps {
    // If `store` is omitted the form runs in "create" mode.
    store?: Store;
    // Optional explicit mode override; if omitted mode is inferred from `store`.
    mode?: StoreFormMode;
    onSuccess?: (updated: Store) => void;
    onStateChange?: (state: FormDirtyState) => void;
}

export interface StoreEditFormHandle {
    submit: () => void;
    reset: () => void;
}

// ─── Tiny helper that syncs form state upward ─────────────────────────────────

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

// ─── Form ─────────────────────────────────────────────────────────────────────

export const StoreEditForm = forwardRef<StoreEditFormHandle, StoreEditFormProps>(
    function StoreEditForm({ store, mode, onSuccess, onStateChange }, ref) {
        const resolvedMode: StoreFormMode = mode ?? (store ? "edit" : "create");
        const isCreate = resolvedMode === "create";
        const queryClient = useQueryClient();

        const saveStoreMutation = useMutation({
            mutationFn: async (value: StoreEditFormValues) => {
                const storeId = store?.id;
                if (!isCreate && !storeId) {
                    throw new Error("Store is required in edit mode");
                }

                const base = {
                    ...value,
                    description: value.description || null,
                    address: value.address || null,
                    phone: value.phone || null,
                } as Record<string, unknown>;

                if (!isCreate) {
                    delete base.slug;
                }

                const payload = denormalizeRequest(base);
                const endpoint = isCreate ? "/stores" : `/stores/${storeId}`;
                const method = isCreate ? "POST" : "PATCH";

                return fetchWithAccessToken<Store>(endpoint, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            onSuccess: async (updated) => {
                await queryClient.invalidateQueries({ queryKey: ["stores"] });
                await queryClient.invalidateQueries({ queryKey: ["store", updated.id] });
                await queryClient.invalidateQueries({
                    queryKey: ["store", updated.id, "onboarding-status"],
                });

                form.reset();
                toast.success(isCreate ? "Store created successfully" : "Store updated successfully");
                onSuccess?.(updated);
            },
            onError: (error) => {
                toast.error(
                    error instanceof Error ? error.message : "Failed to save store"
                );
            },
        });

        const form = useForm({
            defaultValues: {
                name: store?.name ?? "",
                description: store?.description ?? "",
                address: store?.address ?? "",
                phone: store?.phone ?? "",
                // Slug is editable only when creating a store
                slug: store?.slug ?? "",
                // Timezone is now an IANA string, not a free-text field.
                timezone: store?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "PST",
                // Business hours live here; the selector writes to this key directly.
                businessHours: normalizeStoreBusinessHours(store?.businessHours),
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
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void form.handleSubmit();
                }}
                className="mx-auto w-full space-y-4 md:space-y-6 max-w-4xl"
            >
                {/* ── Basic Info ──────────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                        <CardDescription>Store name and description</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Name */}
                        <form.Field
                            name="name"
                            validators={{
                                onChange: ({ value }) => {
                                    if (!value?.trim()) return "Store name is required";
                                    if (value.length > 255)
                                        return "Name must be less than 255 characters";
                                    return undefined;
                                },
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Store Name</Label>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        placeholder="My Store"
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        disabled={form.state.isSubmitting}
                                    />
                                    {field.state.meta.isTouched &&
                                        field.state.meta.errors[0] ? (
                                        <p className="text-sm text-destructive">
                                            {field.state.meta.errors[0]}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </form.Field>

                        {/* Description */}
                        <form.Field name="description">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Description</Label>
                                    <Textarea
                                        id={field.name}
                                        name={field.name}
                                        placeholder="Tell customers about your store..."
                                        rows={3}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        disabled={form.state.isSubmitting}
                                    />
                                </div>
                            )}
                        </form.Field>

                        {/* Slug — read-only for edit, editable for create */}
                        {isCreate ? (
                            <form.Field
                                name="slug"
                                validators={{
                                    onChange: ({ value }) => {
                                        if (!value?.trim()) return "Store slug is required";
                                        if (value.length > 64)
                                            return "Slug must be less than 64 characters";
                                        // basic slug character check
                                        if (!/^[a-z0-9\-]+$/.test(value))
                                            return "Slug may only contain lowercase letters, numbers and hyphens";
                                        return undefined;
                                    },
                                }}
                            >
                                {(field) => (
                                    <div className="space-y-2">
                                        <Label htmlFor={field.name}>Store URL</Label>
                                        <InputGroup>
                                            <InputGroupAddon>
                                                <InputGroupText>/store/</InputGroupText>
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                id={field.name}
                                                name={field.name}
                                                placeholder="my-store"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                disabled={form.state.isSubmitting}
                                                className="flex-1"
                                            />
                                        </InputGroup>
                                        {field.state.meta.isTouched && field.state.meta.errors[0] ? (
                                            <p className="text-sm text-destructive">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Choose a unique store slug (lowercase, hyphens allowed).
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        ) : (
                            <div className="space-y-2">
                                <Label>Store URL</Label>
                                <InputGroup data-disabled="true">
                                    <InputGroupAddon>
                                        <InputGroupText>/store/</InputGroupText>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        value={store!.slug}
                                        disabled
                                        readOnly
                                        className="text-muted-foreground"
                                    />
                                </InputGroup>
                                <p className="text-xs text-muted-foreground">
                                    Store slug cannot be changed
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Contact Info ─────────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                        <CardDescription>Address and phone number</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form.Field name="address">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Address</Label>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        placeholder="123 Main St, City, State"
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        disabled={form.state.isSubmitting}
                                    />
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="phone">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Phone</Label>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        type="tel"
                                        placeholder="+1 (555) 000-0000"
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        disabled={form.state.isSubmitting}
                                    />
                                </div>
                            )}
                        </form.Field>
                    </CardContent>
                </Card>

                {/* ── Time & Hours ──────────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Business Hours</CardTitle>
                        <CardDescription>Timezone and business hours</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Timezone — uses the dropdown selector, not a plain Input */}
                        <form.Field name="timezone">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Timezone</Label>
                                    <TimezoneSelector
                                        value={field.state.value}
                                        onChange={field.handleChange}
                                        onBlur={field.handleBlur}
                                        disabled={form.state.isSubmitting}
                                    />
                                    {field.state.meta.isTouched &&
                                        field.state.meta.errors[0] ? (
                                        <p className="text-sm text-destructive">
                                            {field.state.meta.errors[0]}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </form.Field>

                        {/*
                         * Business hours — the selector is self-contained; it opens
                         * its own dialog internally. We wire it to the form field so
                         * TanStack Form handles dirty tracking and submission automatically.
                         */}
                        <form.Field name="businessHours">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label htmlFor={field.name}>Business Hours</Label>
                                    <BusinessHoursSelector
                                        hours={field.state.value}
                                        onChangeAction={(next) => {
                                            field.handleChange(next);
                                            field.handleBlur(); // mark touched so dirty state fires
                                        }}
                                        disabled={form.state.isSubmitting}
                                    />
                                </div>
                            )}
                        </form.Field>
                    </CardContent>
                </Card>

                {/* Propagate form state to parent */}
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
        );
    }
);