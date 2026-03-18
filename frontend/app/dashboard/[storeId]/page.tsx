"use client";

import { StoreEditForm, StoreEditFormHandle } from "@/components/dashboard/store/store-edit-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { Store } from "@/lib/types";
import { useStoreOnboardingStatusQuery } from "@/queries/stores";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Save, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import StoreSubNav from "../_components/store-sub-nav";

interface StoreOverviewPageProps {
    params: Promise<{ storeId: string }>;
}

export default function StoreOverviewPage({ params }: StoreOverviewPageProps) {
    const { storeId } = use(params)
    const router = useRouter();
    const formRef = useRef<StoreEditFormHandle>(null);
    const [formState, setFormState] = useState({ isDirty: false, isSubmitting: false });
    const { data: onboardingStatus, isPending: onboardingPending } =
        useStoreOnboardingStatusQuery(storeId);

    const { data: store, isPending, refetch } = useQuery({
        queryKey: ["store", storeId],
        queryFn: async () => fetchWithAccessToken<Store>(`/stores/${storeId}`),
        enabled: !!storeId,
    })

    useEffect(() => {
        if (!onboardingPending && onboardingStatus && !onboardingStatus.onboardingComplete) {
            router.replace(`/dashboard/${storeId}/onboarding`);
        }
    }, [onboardingPending, onboardingStatus, router, storeId]);

    if (isPending || onboardingPending) {
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="shrink-0">
                    <StoreSubNav pending={isPending} store={store} />
                </div>
                {contentSkeleton}
            </div>
        )
    }

    if (!store) {
        return <div className="p-6">Store not found.</div>
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0">
                <StoreSubNav pending={isPending} store={store} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <StoreEditForm
                    ref={formRef}
                    store={store}
                    mode="edit"
                    onSuccess={() => refetch()}
                    onStateChange={setFormState}
                />
            </div>
            <div className="shrink-0 rounded-b-md border-t bg-background-elevated/70 backdrop-blur">
                <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 p-4 py-3">
                    <div className="flex flex-col">
                        {formState.isDirty ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <AlertCircle className="size-3" />
                                Unsaved changes
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <CheckCircle2 className="size-3" />
                                All changes saved
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-xs"
                            onClick={() => formRef.current?.reset()}
                            disabled={!formState.isDirty || formState.isSubmitting}
                        >
                            <Undo2 className="mr-1.5 size-3.5" />
                            Reset
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="rounded-full px-6 text-xs font-semibold"
                            onClick={() => formRef.current?.submit()}
                            disabled={!formState.isDirty || formState.isSubmitting}
                        >
                            {formState.isSubmitting ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            ) : (
                                <Save className="mr-1.5 size-3.5" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}


const contentSkeleton = <>
    <div className="min-h-0 flex-1 overflow-y-auto p-6 py-3">
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
    </div>
    <div className="shrink-0 border-t bg-background-elevated/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-2 p-4 py-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
        </div>
    </div>
</>
