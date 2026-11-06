"use client";

import { ExternalLink } from "lucide-react";

export function DashboardFooter() {
    return (
        <footer className="bg-background/80 backdrop-blur-xl border-t border-border/40 h-10 sm:h-11 flex items-center justify-between px-4 sm:px-6 w-full shrink-0 select-none text-xs text-muted-foreground z-20">
            <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs text-muted-foreground/90">Desenvolvido por</span>
                <a
                    href="https://www.nexussofttech.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group tracking-wide cursor-pointer"
                    title="Visitar site oficial da NEXUS SOFT TECH (www.nexussofttech.com.br)"
                >
                    <span className="group-hover:underline underline-offset-2">NEXUS SOFT TECH</span>
                    <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                </a>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] text-muted-foreground/80">
                <span className="hidden md:inline font-mono text-[10px] text-muted-foreground/60">Tecnologia em Atendimento Inteligente</span>
                <div className="h-3 w-px bg-border/40 hidden md:block" />
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] sm:text-xs">Sistema Operacional</span>
                </span>
            </div>
        </footer>
    );
}

