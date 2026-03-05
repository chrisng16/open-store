"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getFileNameFromUrl } from "./utils";

type ImportReviewHeaderProps = {
    status: string;
    fileUrl: string;
    isPublished: boolean;
    hasDirtyChanges: boolean;
    acceptedCount: number;
    applyPending: boolean;
    publishPending: boolean;
    onApply: () => void;
    onOpenPublishConfirm: () => void;
};

export function ImportReviewHeader({
    status,
    fileUrl,
    isPublished,
    hasDirtyChanges,
    acceptedCount,
    applyPending,
    publishPending,
    onApply,
    onOpenPublishConfirm,
}: ImportReviewHeaderProps) {
    return (
        <div className="sticky top-0 z-20 shrink-0">
            <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
                <div className="flex items-center justify-between px-6 py-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge className="text-[0.7rem] h-5">{status}</Badge>
                            <h1 className="text-xl font-semibold">Review Import</h1>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{getFileNameFromUrl(fileUrl)}</p>
                    </div>
                    {isPublished ? (
                        <p className="text-xs text-muted-foreground">This import is published and locked.</p>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onApply}
                                disabled={!hasDirtyChanges || applyPending || publishPending}
                            >
                                {applyPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Apply Changes
                            </Button>
                            {acceptedCount > 0 && (
                                <Button
                                    onClick={onOpenPublishConfirm}
                                    size="sm"
                                    disabled={publishPending || applyPending}
                                >
                                    {(publishPending || applyPending) ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Publish {acceptedCount} Items to Menu
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
