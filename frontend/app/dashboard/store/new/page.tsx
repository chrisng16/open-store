"use client";

import { StoreEditForm, StoreEditFormHandle } from "@/components/dashboard/store/store-edit-form";
import type { FormDirtyState } from "@/components/dashboard/store/types";
import { Button } from "@/components/ui/button";
import { Store } from "@/queries/stores";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function NewStorePage() {
    const router = useRouter();

    const formRef = useRef<StoreEditFormHandle>(null);
    const [formState, setFormState] = useState<FormDirtyState>({
        isDirty: false,
        isSubmitting: false,
    });

    return (
        <div className="relative">
            <div className="rounded-t-md border-b flex items-center px-6 py-3 sticky top-0 z-10 bg-background-elevated/70 backdrop-blur">
                <div className="mx-auto max-w-4xl w-full px-6">
                    <h1 className="text-xl font-bold">Create New Store</h1>
                </div>
            </div>
            <div className="mx-auto max-w-4xl p-6">
                <StoreEditForm
                    ref={formRef}
                    onStateChange={setFormState}
                    onSuccess={(store: Store) => {
                        router.push(`/dashboard/${store.id}/onboarding`);
                    }}
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

        </div>
    );
}
