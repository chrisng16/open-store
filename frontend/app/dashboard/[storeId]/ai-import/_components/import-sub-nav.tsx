"use client"

import { Button } from "@/components/ui/button";
import { UseMutationResult } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";

export default function ImportSubNav({ storeId, uploadMutation, handleUpload }: { storeId: string; uploadMutation: UseMutationResult<void, unknown, File, unknown>; handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>; }) {

    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-3">
                <div>
                    <h1 className="font-semibold">AI Menu Import</h1>
                    <p className="text-xs text-muted-foreground">Upload a menu PDF, image, or spreadsheet — AI will extract items
                        automatically</p>
                </div>
                <div>
                    <label htmlFor="menu-upload">
                        <Button asChild disabled={uploadMutation.isPending} size={"sm"}>
                            <span>
                                {uploadMutation.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <FileUp className="size-4" />
                                )}
                                {uploadMutation.isPending ? "Uploading..." : "Upload Menu"}
                            </span>
                        </Button>
                    </label>
                    <input
                        id="menu-upload"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                        onChange={handleUpload}
                        className="hidden"
                    />
                </div>
            </div>
        </div>
    )
}
