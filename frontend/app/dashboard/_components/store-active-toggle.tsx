import { Switch } from "@/components/ui/switch";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { Store } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StoreActiveToggleProps {
    store: Store | undefined;
}

export function StoreActiveToggle({ store }: StoreActiveToggleProps) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (isActive: boolean) => {
            return fetchWithAccessToken(`/stores/${store?.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: isActive }),
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["store", store?.id] });
            toast.success("Store active state updated");
        },
        onError: () => {
            toast.error("Failed to update store state");
        }
    });

    if (!store) return null;

    return (
        <div className="mt-2 flex items-center gap-2">
            <Switch
                checked={store.isActive}
                onCheckedChange={(checked) => mutation.mutate(checked)}
                disabled={mutation.isPending}
                id="store-active-toggle"
            />
            <label htmlFor="store-active-toggle" className="text-xs text-muted-foreground">
                {store.isActive ? "Active" : "Inactive"}
            </label>
        </div>
    );
}