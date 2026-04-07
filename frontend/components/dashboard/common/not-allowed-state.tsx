"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

type NotAllowedStateProps = {
    title?: string;
    message: string;
    returnHref?: string;
};

export function NotAllowedState({
    title = "Not allowed",
    message,
    returnHref = "/dashboard",
}: NotAllowedStateProps) {
    return (
        <div className="flex h-full min-h-0 items-center justify-center p-6">
            <Card className="w-full max-w-xl border-amber-500/20 bg-amber-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700">
                        <ShieldAlert className="h-5 w-5" />
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-amber-700/90">{message}</p>
                    <Link href={returnHref}>
                        <Button variant="outline">Back</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
