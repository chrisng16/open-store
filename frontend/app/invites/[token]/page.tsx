"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvite } from "@/queries/team";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function InviteAcceptPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = use(params);
    const router = useRouter();
    const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        void supabase.auth.getUser().then(({ data }) => {
            setIsSignedIn(!!data.user);
        });
    }, []);

    const acceptMutation = useMutation({
        mutationFn: async () => acceptInvite(token),
        onSuccess: (result) => {
            router.push(`/dashboard/${result.storeId}`);
            router.refresh();
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : "Could not accept this invite";
            setErrorMessage(message);
        },
    });

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-10">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Join store team</CardTitle>
                    <CardDescription>
                        Accept this invitation to get manager access for the store.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isSignedIn === false && (
                        <p className="text-sm text-muted-foreground">
                            Sign in with the invited email before accepting this invite.
                        </p>
                    )}

                    {errorMessage && (
                        <p className="text-sm text-destructive">{errorMessage}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {isSignedIn ? (
                            <Button
                                onClick={() => {
                                    setErrorMessage(null);
                                    acceptMutation.mutate();
                                }}
                                disabled={acceptMutation.isPending}
                            >
                                {acceptMutation.isPending ? "Accepting..." : "Accept invite"}
                            </Button>
                        ) : (
                            <>
                                <Button asChild>
                                    <Link href="/login">Sign in</Link>
                                </Button>
                                <Button asChild variant="outline">
                                    <Link href="/signup">Create account</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
