"use client";

import { StoreEditForm, StoreEditFormHandle } from "@/components/dashboard/store/store-edit-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { Store } from "@/queries/stores";
import { useQuery } from "@tanstack/react-query";
import { use, useRef, useState } from "react";
import StoreSubNav from "../_components/store-sub-nav";

interface StoreOverviewPageProps {
    params: Promise<{ storeId: string }>;
}

export default function StoreOverviewPage({ params }: StoreOverviewPageProps) {
    const { storeId } = use(params)
    const formRef = useRef<StoreEditFormHandle>(null);
    const [formState, setFormState] = useState({ isDirty: false, isSubmitting: false });

    const { data: store, isPending, refetch } = useQuery({
        queryKey: ["store", storeId],
        queryFn: async () => fetchWithAccessToken<Store>(`/stores/${storeId}`),
        enabled: !!storeId,
    })

    if (isPending) {
        return (
            <div className="p-6 py-3 space-y-6">
                <div className="mx-auto w-full max-w-4xl space-y-4">
                    {/* Basic Info Card Skeleton */}
                    <div className="rounded-md border p-6 ">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-6 w-24" />
                        </div>

                        <Skeleton className="h-6 w-48 mt-4" />
                        <Skeleton className="h-8 w-full mt-2" />

                        <Skeleton className="h-6 w-48 mt-4" />
                        <Skeleton className="h-16 w-full mt-2" />

                        <Skeleton className="h-6 w-48 mt-4" />
                        <Skeleton className="h-8 w-full mt-2" />

                    </div>

                    {/* Contact Info Card Skeleton */}
                    <div className="rounded-md border p-6">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>

                    {/* Time / Business Hours Card Skeleton */}
                    <div className="rounded-md border p-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-48" />
                        </div>
                        <div className="mt-4 space-y-3">
                            <Skeleton className="h-10 w-1/3" />
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom action bar skeleton (spacer + buttons) */}
                <div className="sticky inset-x-0 bottom-0 z-40 border-t bg-background-elevated/70 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-2 p-4 py-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-32" />
                    </div>
                </div>
            </div>
        )
    }

    if (!store) {
        return <div className="p-6">Store not found.</div>
    }

    return (
        <>
            <StoreSubNav pending={isPending} storeId={storeId} storeName={store?.name} />
            <div className="p-4 md:p-6">
                <StoreEditForm
                    ref={formRef}
                    store={store}
                    mode="edit"
                    onSuccess={() => refetch()}
                    onStateChange={setFormState}
                />
            </div>
            <div className="sticky rounded-b-md inset-x-0 bottom-0 z-40 border-t bg-background-elevated/70 backdrop-blur">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-2 p-4 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => formRef.current?.reset()}
                        disabled={formState.isSubmitting}
                    >
                        Reset
                    </Button>
                    <Button
                        type="button"
                        onClick={() => formRef.current?.submit()}
                        disabled={!formState.isDirty || formState.isSubmitting}
                    >
                        {formState.isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

        </>
    );
}
