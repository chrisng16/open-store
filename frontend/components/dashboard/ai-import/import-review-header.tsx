"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getFileNameFromUrl } from "./utils";

type ImportReviewHeaderProps = {
    status: string;
    fileUrl: string;
    fileSizeBytes: number | null;
    fileSizeMb: number | null;
    createdAt: string;
    processingStartedAt: string | null;
    ingestedAt: string | null;
    showIngestInfo?: boolean;

    ingestDurationSeconds: number | null;
    processingElapsedSeconds: number | null;
    aiProcessingSeconds: number | null;
    aiSecondsPerMb: number | null;
    aiMbPerSecond: number | null;
    parser: string | null;
    model: string | null;
    promptVersion: string | null;
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
    fileSizeBytes,
    fileSizeMb,
    createdAt,
    processingStartedAt,
    ingestedAt,
    ingestDurationSeconds,
    processingElapsedSeconds,
    aiProcessingSeconds,
    aiSecondsPerMb,
    aiMbPerSecond,
    parser,
    model,
    promptVersion,
    isPublished,
    hasDirtyChanges,
    acceptedCount,
    applyPending,
    publishPending,
    onApply,
    onOpenPublishConfirm,
    showIngestInfo = false,
}: ImportReviewHeaderProps) {
    const createdLabel = new Date(createdAt).toLocaleString();
    const processingStartedLabel = processingStartedAt ? new Date(processingStartedAt).toLocaleString() : null;
    const ingestedLabel = ingestedAt ? new Date(ingestedAt).toLocaleString() : null;

    const fileSizeLabel = fileSizeMb != null
        ? `${fileSizeMb.toFixed(2)} MB`
        : fileSizeBytes != null
            ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
            : null;

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
                        {showIngestInfo && (
                            <>
                                <p className="text-xs text-muted-foreground">
                                    Created: {createdLabel}
                                    {processingStartedLabel ? ` · AI Start: ${processingStartedLabel}` : ""}
                                    {ingestedLabel ? ` · Ingested: ${ingestedLabel}` : ""}
                                    {fileSizeLabel ? ` · File: ${fileSizeLabel}` : ""}
                                    {ingestDurationSeconds != null ? ` · Ingest: ${ingestDurationSeconds}s` : ""}
                                    {processingElapsedSeconds != null ? ` · Processing: ${processingElapsedSeconds}s` : ""}
                                    {aiProcessingSeconds != null ? ` · AI Processing: ${aiProcessingSeconds}s` : ""}
                                    {aiSecondsPerMb != null ? ` · AI sec/MB: ${aiSecondsPerMb.toFixed(2)}` : ""}
                                    {aiMbPerSecond != null ? ` · AI MB/s: ${aiMbPerSecond.toFixed(3)}` : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Parser: {parser || "n/a"}
                                    {model ? ` · Model: ${model}` : ""}
                                    {promptVersion ? ` · Prompt: ${promptVersion}` : ""}
                                </p>
                            </>
                        )}
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
