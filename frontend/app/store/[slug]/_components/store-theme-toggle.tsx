"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function StoreThemeToggle({ ...props }: React.ComponentPropsWithoutRef<typeof Button>) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button {...props} variant="ghost" size="icon-sm" className={cn("rounded-full opacity-0", props.className)} >
                <Sun className="size-4" />
            </Button>
        );
    }

    return (
        <Button
            {...props}
            variant="outline"
            size="icon-sm"
            className={cn("rounded-full hover:bg-accent transition-all duration-300", props.className)}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
            {theme === "dark" ? (
                <Sun className="size-4" />
            ) : (
                <Moon className="size-4" />
            )}
        </Button>
    );
}
