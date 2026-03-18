"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StoreData = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    themeConfig: {
        primaryColor?: string;
        accentColor?: string;
        fontFamily?: string;
        borderRadius?: string;
    } | null;
    isActive: boolean;
    address: string | null;
    phone: string | null;
};

const StoreContext = createContext<StoreData | null>(null);

export function StoreProvider({
    store,
    children,
}: {
    store: StoreData;
    children: ReactNode;
}) {
    return (
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    );
}

export function useStore(): StoreData {
    const store = useContext(StoreContext);
    if (!store) {
        throw new Error("useStore must be used within a StoreProvider");
    }
    return store;
}
