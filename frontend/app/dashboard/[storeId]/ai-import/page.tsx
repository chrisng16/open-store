"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { denormalizeRequest } from "@/lib/normalize-response";
import { uploadFileWithSignedUrl } from "@/lib/uploads";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUp, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import ImportSubNav from "./_components/import-sub-nav";

type MenuImport = {
    id: string;
    fileUrl: string;
    status: string;
    items: { id: string; status: string }[];
    createdAt: string;
};

function getFileNameFromUrl(fileUrl: string): string {
    try {
        const pathname = new URL(fileUrl).pathname;
        const name = pathname.split("/").filter(Boolean).pop();
        return name || "Imported menu";
    } catch {
        return fileUrl.split("/").filter(Boolean).pop() || "Imported menu";
    }
}

export default function AIImportPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const router = useRouter();
    const { storeId } = use(params);

    const { data: imports = [], isPending, refetch } = useQuery({
        queryKey: ["menu-imports", storeId],
        queryFn: async () =>
            fetchWithAccessToken<MenuImport[]>(`/stores/${storeId}/menu-imports`),
        enabled: !!storeId,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const upload = await uploadFileWithSignedUrl(storeId, file, "menuImportFile");

            await fetchWithAccessToken(`/stores/${storeId}/menu-imports/from-upload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    denormalizeRequest({
                        uploadId: upload.uploadId,
                    })
                ),
            });
        },
        onSuccess: () => {
            void refetch();
        },
    });

    const processMutation = useMutation({
        mutationFn: async (importId: string) => {
            await fetchWithAccessToken(`/stores/${storeId}/menu-imports/${importId}/process`, {
                method: "POST",
            });
            return importId;
        },
        onSuccess: (importId) => {
            void refetch();
            router.push(`/dashboard/${storeId}/ai-import/${importId}`);
        },
    });

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !storeId) return;
        await uploadMutation.mutateAsync(file).catch(() => {
            // ignore
        });
        e.target.value = "";
    }

    const statusVariant = (status: string) => {
        switch (status) {
            case "review":
            case "published":
                return "default" as const;
            case "processing":
                return "secondary" as const;
            case "failed":
                return "destructive" as const;
            default:
                return "outline" as const;
        }
    };

    return (

        <>
            <ImportSubNav
                storeId={storeId}
                uploadMutation={uploadMutation}
                handleUpload={handleUpload}
            />
            <div className="p-6">
                {/* Drag-drop zone */}
                <Card
                    className="mb-6 border-dashed shadow-none"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (!file || !storeId) return;
                        await uploadMutation.mutateAsync(file).catch(() => {
                            // ignore
                        });
                    }}
                >
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileUp className="mb-2 h-10 w-10" />
                        <p className="text-sm">Drag & drop a menu file here</p>
                        <p className="text-xs">PDF, PNG, JPG, CSV, or XLSX</p>
                    </CardContent>
                </Card>

                {/* Import history */}
                <h2 className="mb-3 text-lg font-semibold">Import History</h2>

                {isPending ? (
                    <div className="text-muted-foreground">Loading...</div>
                ) : imports.length === 0 ? (
                    <p className="text-muted-foreground">No imports yet</p>
                ) : (
                    <div className="space-y-3">
                        {imports.map((imp) => (
                            <div
                                key={imp.id}
                                className="rounded-lg border bg-background-elevated-2 text-card-foreground shadow-sm transition-shadow hover:shadow-md overflow-hidden"
                            >
                                <Link
                                    href={`/dashboard/${storeId}/ai-import/${imp.id}`}
                                    className="block p-4"
                                >
                                    <div className="flex items-center justify-between gap-3 w-full overflow-hidden">
                                        {/* LEFT */}
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Badge variant={statusVariant(imp.status)} className="h-4 text-xs shrink-0">
                                                {imp.status}
                                            </Badge>
                                            <span className="text-sm font-medium truncate">
                                                {getFileNameFromUrl(imp.fileUrl)}
                                            </span>
                                        </div>

                                        {/* RIGHT */}
                                        {(imp.status === "uploading" || imp.status === "failed") && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={processMutation.isPending}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    processMutation.mutate(imp.id);
                                                }}
                                                className="shrink-0"
                                            >
                                                {processMutation.isPending ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Play className="mr-2 h-4 w-4" />
                                                )}
                                                Process
                                            </Button>
                                        )}
                                    </div>

                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {Array.isArray(imp.items) && (
                                            <span>
                                                {imp.items.filter((item) => item.status === "approved").length}/{imp.items.length} items accepted
                                                {" • "}
                                            </span>
                                        )}
                                        {new Date(imp.createdAt).toLocaleString()}
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
