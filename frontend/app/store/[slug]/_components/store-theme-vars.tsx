// _components/store-theme-vars.tsx
"use client";
import { useEffect } from "react";

export function StoreThemeVars({ vars }: { vars: Record<string, string> }) {
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(vars).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        return () => {
            Object.keys(vars).forEach((key) => {
                root.style.removeProperty(key);
            });
        };
    }, [vars]);
    return null;
}