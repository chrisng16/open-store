import { api } from "@/lib/api";
import { StoreProvider } from "@/lib/store-context";
import { StorePublic } from "@/lib/types";
import { notFound } from "next/navigation";
import StoreFooter from "./_components/store-footer";
import StoreHeader from "./_components/store-header";
import { StoreThemeVars } from "./_components/store-theme-vars";

export default async function StoreLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    let store: StorePublic;
    try {
        store = await api.stores.getBySlug(slug);
    } catch (e) {
        return notFound();
    }

    if (!store) notFound();

    const theme = store.themeConfig;
    const primaryColor = theme?.primaryColor as string || "#171717";
    const accentColor = theme?.accentColor as string || "#f59e0b";

    // Simple hex to contrast color (white/black)
    const getContrastColor = (hex: string | any) => {
        if (typeof hex !== 'string') return "#ffffff";
        const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
        if (cleanHex.length !== 6) return "#ffffff";
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? "#000000" : "#ffffff";
    };

    const compRadius = `${theme?.borderRadius ?? 10}px`;
    const btnRadius = theme?.buttonRadius === "full" ? "9999px" : compRadius;
    const fontStyle = (theme?.fontStyle || "var(--font-geist-sans)") as string;

    const cssVars = {
        "--primary": primaryColor,
        "--primary-foreground": getContrastColor(primaryColor),
        "--accent": accentColor,
        "--accent-foreground": getContrastColor(accentColor),
        "--radius": compRadius,
        "--button-radius": btnRadius,
    };

    return (
        <StoreProvider store={store as any}>
            <StoreThemeVars vars={cssVars} />  {/* ← sets vars on :root */}
            <div style={{ fontFamily: fontStyle }} className="bg-background text-foreground transition-all duration-500">
                <StoreHeader store={store} slug={slug} />
                <main>{children}</main>
                <StoreFooter />
            </div>
        </StoreProvider>
    );
}
