"use client";

import React, { useState } from "react";
import { useTheme, Theme } from "@/components/theme-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor, Check, Sparkles } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme, mounted } = useTheme();
    const [open, setOpen] = useState(false);

    // Prevent hydration mismatch during initial mount
    if (!mounted) {
        return (
            <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/50 rounded-full h-10 w-10 text-muted-foreground cursor-pointer"
                aria-label="Carregando tema"
            >
                <div className="h-5 w-5 rounded-full bg-muted/50 animate-pulse" />
            </Button>
        );
    }

    const options: { value: Theme; label: string; desc: string; icon: React.ElementType }[] = [
        {
            value: "light",
            label: "Tema Claro",
            desc: "Visual clean e luminoso",
            icon: Sun,
        },
        {
            value: "dark",
            label: "Tema Escuro",
            desc: "Visual escuro futurista",
            icon: Moon,
        },
        {
            value: "system",
            label: "Automático",
            desc: "Segue a preferência do dispositivo",
            icon: Monitor,
        },
    ];

    const currentIcon = resolvedTheme === "dark" ? (
        <Moon className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-transform group-hover:scale-110" />
    ) : (
        <Sun className="h-5 w-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-transform group-hover:rotate-45" />
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="group hover:bg-muted/60 rounded-full h-10 w-10 relative cursor-pointer transition-all duration-200"
                    title={`Tema atual: ${theme === "system" ? `Automático (${resolvedTheme === "dark" ? "Escuro" : "Claro"})` : theme === "dark" ? "Escuro" : "Claro"}. Clique para escolher tema.`}
                    aria-label="Escolher tema claro ou escuro"
                >
                    {currentIcon}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 p-2.5 rounded-2xl border border-border/60 shadow-2xl glass-panel animate-in fade-in zoom-in-95 duration-150"
                align="end"
            >
                <div className="px-2.5 py-2 border-b border-border/40 flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Aparência do Sistema
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Selecione o modo de exibição preferido
                        </p>
                    </div>
                </div>

                <div className="p-1 space-y-1">
                    {options.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = theme === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setTheme(opt.value);
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                    isSelected
                                        ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs"
                                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent"
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`p-1.5 rounded-lg shrink-0 ${
                                        isSelected 
                                            ? "bg-primary text-primary-foreground shadow-2xs" 
                                            : "bg-muted text-muted-foreground"
                                    }`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-foreground leading-tight">
                                            {opt.label}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                                            {opt.desc}
                                        </div>
                                    </div>
                                </div>

                                {isSelected && (
                                    <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 ml-2">
                                        <Check className="h-3.5 w-3.5" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

