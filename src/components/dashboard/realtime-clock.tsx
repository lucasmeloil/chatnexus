"use client";

import { useEffect, useState } from "react";
import moment from "moment-timezone";

export function RealtimeClock() {
    const [hours, setHours] = useState("--");
    const [minutes, setMinutes] = useState("--");
    const [seconds, setSeconds] = useState("--");
    const [dateStr, setDateStr] = useState("");
    const [timezone, setTimezone] = useState("America/Sao_Paulo");
    const [mounted, setMounted] = useState(false);
    const [blink, setBlink] = useState(true);

    useEffect(() => {
        setMounted(true);
        // Fetch global timezone
        fetch('/api/settings/system')
            .then(r => r.json())
            .then(data => {
                if (data && data.data && data.data.timezone) {
                    setTimezone(data.data.timezone);
                }
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const updateTime = () => {
            const now = moment().tz(timezone);
            setHours(now.format("HH"));
            setMinutes(now.format("mm"));
            setSeconds(now.format("ss"));
            setDateStr(now.format("DD/MM/YYYY"));
            setBlink(prev => !prev);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [timezone, mounted]);

    if (!mounted) return null;

    // Clean display for timezone label (e.g. "São Paulo", "Brasília", etc.)
    const cleanTz = timezone.replace(/_/g, " ").split("/").pop() || timezone;

    return (
        <div 
            title={`Horário oficial (${timezone}) • ${dateStr}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 dark:bg-black border border-emerald-500/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_0_14px_rgba(16,185,129,0.2)] text-emerald-400 select-none relative overflow-hidden group transition-all"
        >
            {/* Top glass reflection highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            {/* Glowing LED status dot */}
            <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,1)]" />
            </span>

            {/* Digital LED Digits */}
            <div className="font-mono font-bold tracking-wider text-xs sm:text-sm text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.85)] flex items-center">
                <span>{hours}</span>
                <span className={`mx-0.5 transition-opacity duration-150 ${blink ? "opacity-100" : "opacity-30"}`}>:</span>
                <span>{minutes}</span>
                <span className={`mx-0.5 transition-opacity duration-150 ${blink ? "opacity-100" : "opacity-30"}`}>:</span>
                <span className="text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,1)]">{seconds}</span>
            </div>

            {/* Timezone pill */}
            <div className="border-l border-emerald-500/30 pl-2 ml-0.5 hidden md:flex flex-col justify-center">
                <span className="text-[9px] font-mono font-semibold tracking-wider text-emerald-500/90 uppercase leading-none">
                    {cleanTz}
                </span>
            </div>
        </div>
    );
}
