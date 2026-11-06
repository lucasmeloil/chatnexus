"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    resolvedTheme: "light" | "dark";
    mounted: boolean;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "nexus-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = React.useState<Theme>("system");
    const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");
    const [mounted, setMounted] = React.useState(false);

    // Apply classes and styles to documentElement
    const applyTheme = React.useCallback((targetTheme: Theme) => {
        if (typeof window === "undefined") return;

        const root = document.documentElement;
        let isDark = false;

        if (targetTheme === "dark") {
            isDark = true;
        } else if (targetTheme === "light") {
            isDark = false;
        } else {
            isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }

        if (isDark) {
            root.classList.add("dark");
            root.style.colorScheme = "dark";
        } else {
            root.classList.remove("dark");
            root.style.colorScheme = "light";
        }

        setResolvedTheme(isDark ? "dark" : "light");
    }, []);

    // Initial load from localStorage
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
            const initial = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
            setThemeState(initial);
            applyTheme(initial);
        } catch {
            applyTheme("system");
        }
        setMounted(true);
    }, [applyTheme]);

    // Listen for OS system theme changes
    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (theme === "system") {
                applyTheme("system");
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme, applyTheme]);

    const setTheme = React.useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {}
        applyTheme(newTheme);
        window.dispatchEvent(new CustomEvent("nexus:theme-changed", { detail: { theme: newTheme } }));
    }, [applyTheme]);

    const toggleTheme = React.useCallback(() => {
        const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(next);
    }, [resolvedTheme, setTheme]);

    const value = React.useMemo(() => ({
        theme,
        setTheme,
        toggleTheme,
        resolvedTheme,
        mounted,
    }), [theme, setTheme, toggleTheme, resolvedTheme, mounted]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = React.useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

