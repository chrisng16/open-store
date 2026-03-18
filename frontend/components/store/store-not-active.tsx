export function StoreNotActive({ storeName }: { storeName?: string }) {
    return (
        <div className="py-16 text-center">
            <div className="mx-auto max-w-md rounded-lg border bg-background-elevated p-8 shadow-md">
                <h2 className="text-2xl font-bold mb-2">{storeName || "Store"} is not active</h2>
                <p className="text-muted-foreground mb-4">
                    This store is currently inactive and not accepting orders.
                </p>
                <div className="flex justify-center">
                    <svg width="48" height="48" fill="none" viewBox="0 0 48 48" className="text-destructive">
                        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="4" />
                        <line x1="16" y1="16" x2="32" y2="32" stroke="currentColor" strokeWidth="4" />
                        <line x1="32" y1="16" x2="16" y2="32" stroke="currentColor" strokeWidth="4" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
