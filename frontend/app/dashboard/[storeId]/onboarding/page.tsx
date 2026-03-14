"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { useStoreOnboardingStatusQuery } from "@/queries/stores";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { redirect } from "next/navigation";
import { use } from "react";

type OnboardingPageProps = {
    params: Promise<{ storeId: string }>;
};

const stepToPath = (storeId: string, stepId: string | null) => {
    if (stepId === "store_details") return `/dashboard/${storeId}`;
    if (stepId === "stripe_connect") return `/dashboard/${storeId}/payments`;
    if (stepId === "menu_setup") return `/dashboard/${storeId}/ai-import`;
    return `/dashboard/${storeId}`;
};

export default function StoreOnboardingPage({ params }: OnboardingPageProps) {
    const { storeId } = use(params);
    const queryClient = useQueryClient();
    const { data, isLoading } = useStoreOnboardingStatusQuery(storeId);


    const refreshMutation = useMutation({
        mutationFn: async () => {
            return fetchWithAccessToken(`/stores/${storeId}/onboarding-status/refresh`, {
                method: "POST",
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["store", storeId, "onboarding-status"],
            });
            await queryClient.invalidateQueries({ queryKey: ["store", storeId] });
            await queryClient.invalidateQueries({ queryKey: ["stores"] });
        },
    });

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl space-y-4 p-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!data) {
        return <div className="p-6">Unable to load onboarding status.</div>;
    }

    if (data.onboardingComplete) {
        redirect(`/dashboard/${storeId}`);
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Store onboarding</CardTitle>
                    <CardDescription>
                        Complete required steps to make your store ready for orders.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                            Completed {data.completedRequiredSteps} of {data.totalRequiredSteps} required steps
                        </p>
                        <div className="flex items-center gap-2">
                            <Badge variant={data.onboardingComplete ? "default" : "secondary"}>
                                {data.onboardingComplete ? "Ready" : "In progress"}
                            </Badge>
                            <Badge variant={data.isActive ? "default" : "outline"}>
                                {data.isActive ? "Store open" : "Store not open yet"}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => refreshMutation.mutate()}
                            disabled={refreshMutation.isPending}
                        >
                            {refreshMutation.isPending ? "Refreshing..." : "Refresh status"}
                        </Button>
                        <Link href={stepToPath(storeId, data.nextStepId)}>
                            <Button>Continue</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Checklist</CardTitle>
                    <CardDescription>Required onboarding steps</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {data.steps.map((step) => (
                        <div
                            key={step.id}
                            className="rounded-md border p-4 flex items-center justify-between gap-4"
                        >
                            <div className="space-y-1">
                                <p className="font-medium">{step.title}</p>
                                {!step.completed && step.blockingReasons.length > 0 ? (
                                    <p className="text-sm text-muted-foreground">{step.blockingReasons[0]}</p>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={step.completed ? "default" : "secondary"}>
                                    {step.completed ? "Complete" : "Pending"}
                                </Badge>
                                <Link href={stepToPath(storeId, step.id)}>
                                    <Button variant="outline" size="sm">
                                        Open
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
