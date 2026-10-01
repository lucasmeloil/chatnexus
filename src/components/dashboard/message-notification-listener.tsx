"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, ArrowRight, BellRing, Volume2 } from "lucide-react";
import { useSocket } from "@/components/chat/socket-context";
import { useSession } from "@/components/dashboard/session-provider";
import {
    playNotificationSound,
    sendBrowserNotification,
    requestNotificationPermission,
    unlockAudioSystem,
    isMuteActiveChatEnabled,
    getActiveOpenChatJid,
    isNotificationSoundEnabled,
    isFloatingNotificationEnabled
} from "@/lib/notification-sound";
import { isSameChatJid } from "@/lib/jid-utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FloatingAlert {
    id: string;
    sessionId: string;
    remoteJid: string;
    senderTitle: string;
    cleanPhone: string;
    displayBody: string;
    timestamp: Date;
}

interface IncomingMessagePayload {
    sessionId: string;
    message: {
        id?: string;
        keyId?: string;
        remoteJid: string;
        pushName?: string | null;
        content?: string | null;
        type?: string;
        timestamp?: string;
        fromMe?: boolean;
    };
}

export function MessageNotificationListener() {
    const { socket: socketFromCtx, getSocket } = useSocket();
    const { sessions, sessionId } = useSession();
    const router = useRouter();
    const [alerts, setAlerts] = useState<FloatingAlert[]>([]);
    const askedPermissionRef = useRef(false);
    const recentAlertsRef = useRef(new Set<string>());

    const activeSocket = socketFromCtx || getSocket();

    // Join all session rooms so this client receives messages for every connected number
    useEffect(() => {
        const s = socketFromCtx || getSocket();
        if (!s) return;

        const joinRooms = () => {
            if (sessionId) s.emit("join-session", sessionId);
            if (Array.isArray(sessions)) {
                sessions.forEach(sess => {
                    if (sess?.sessionId) s.emit("join-session", sess.sessionId);
                });
            }
        };

        if (s.connected) joinRooms();
        s.on("connect", joinRooms);
        return () => {
            s.off("connect", joinRooms);
        };
    }, [socketFromCtx, getSocket, sessionId, sessions]);

    // Request browser notification permission once
    useEffect(() => {
        if (!askedPermissionRef.current && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "default") {
                askedPermissionRef.current = true;
                requestNotificationPermission();
            }
        }
    }, []);

    // Clear alerts immediately if notifications or floating alerts are disabled
    useEffect(() => {
        const handleSound = (e: any) => {
            if (e.detail?.enabled === false) setAlerts([]);
        };
        const handleFloating = (e: any) => {
            if (e.detail?.enabled === false) setAlerts([]);
        };
        window.addEventListener("nexus:sound-enabled-changed", handleSound);
        window.addEventListener("nexus:floating-notification-changed", handleFloating);
        return () => {
            window.removeEventListener("nexus:sound-enabled-changed", handleSound);
            window.removeEventListener("nexus:floating-notification-changed", handleFloating);
        };
    }, []);

    const processIncoming = useCallback((payload: IncomingMessagePayload) => {
        if (!payload?.message) return;
        const { message } = payload;
        const remoteJid = message.remoteJid;
        if (!remoteJid) return;
        if (message.fromMe) return;

        // Skip status broadcast messages
        if (remoteJid.includes("status@broadcast")) return;

        // If the notification button is not activated, neither floating notifications nor sound should appear or be heard!
        if (!isNotificationSoundEnabled()) {
            return;
        }

        // Mute active chat: If the operator currently has this conversation open AND is looking at it, do not notify!
        const isCurrentOpenChat = (): boolean => {
            if (typeof window === "undefined") return false;
            // If the browser tab or window does not have focus, operator is away or in another app, always notify!
            if (!document.hasFocus()) return false;

            const activeJid = getActiveOpenChatJid();
            if (activeJid && isSameChatJid(activeJid, remoteJid)) {
                return true;
            }
            return false;
        };

        if (isMuteActiveChatEnabled() && isCurrentOpenChat()) {
            return;
        }

        // Deduplicate messages across all socket channels
        const msgId = message.keyId || message.id || `${remoteJid}_${message.timestamp || message.content}`;
        if (recentAlertsRef.current.has(msgId)) return;
        recentAlertsRef.current.add(msgId);

        // Keep set size bounded
        if (recentAlertsRef.current.size > 150) {
            const first = recentAlertsRef.current.values().next().value;
            if (first) recentAlertsRef.current.delete(first);
        }

        const isGroup = remoteJid.endsWith("@g.us");
        const cleanPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const senderTitle = message.pushName
            ? `${message.pushName} (${cleanPhone})`
            : cleanPhone;

        const displayTitle = isGroup ? `[Grupo] ${senderTitle}` : senderTitle;
        let displayBody = message.content || "";

        if (!displayBody) {
            if (message.type === "IMAGE") displayBody = "📷 Foto recebida";
            else if (message.type === "VIDEO") displayBody = "🎥 Vídeo recebido";
            else if (message.type === "AUDIO") displayBody = "🎵 Áudio recebido";
            else if (message.type === "STICKER") displayBody = "🏷️ Figurinha recebida";
            else if (message.type === "DOCUMENT") displayBody = "📄 Documento recebido";
            else if (message.type === "LOCATION") displayBody = "📍 Localização recebida";
            else displayBody = "Nova mensagem recebida";
        }

        // 1. Play audio chime (sinal sonoro)
        playNotificationSound();

        // 2. Trigger native OS/Browser notification
        sendBrowserNotification(
            `Nova mensagem: ${displayTitle}`,
            {
                body: displayBody,
                tag: `msg-${remoteJid}`,
            },
            () => {
                const targetJid = remoteJid;
                const number = targetJid.split("@")[0];
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("nexus:open-chat", {
                        detail: { jid: targetJid, name: displayTitle }
                    }));
                }
                const cleanPath = targetJid.includes("@g.us")
                    ? `/dashboard/chat/${encodeURIComponent(targetJid)}`
                    : `/dashboard/chat/${encodeURIComponent(number)}`;
                router.push(cleanPath);
            }
        );

        // 3. Add to visual floating alert card ONLY if floating notifications are enabled
        if (isFloatingNotificationEnabled()) {
            const alertId = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const newAlert: FloatingAlert = {
                id: alertId,
                sessionId: payload.sessionId || sessionId || "",
                remoteJid,
                senderTitle: displayTitle,
                cleanPhone,
                displayBody,
                timestamp: new Date()
            };

            setAlerts(prev => [newAlert, ...prev.slice(0, 3)]);

            // Auto-dismiss floating banner card after 9 seconds
            setTimeout(() => {
                setAlerts(prev => prev.filter(a => a.id !== alertId));
            }, 9000);
        }
    }, [sessionId, router]);

    // Attach listeners across all 3 message channels
    useEffect(() => {
        const s = activeSocket;
        if (!s) return;

        // Channel 1: Global instant incoming message broadcast
        const handleIncoming = (payload: IncomingMessagePayload) => {
            processIncoming(payload);
        };

        // Channel 2: Room message.update event (post-database save)
        const handleUpdate = (messages: any[]) => {
            if (!Array.isArray(messages)) return;
            for (const m of messages) {
                if (m && !m.fromMe) {
                    processIncoming({
                        sessionId: m.sessionId || sessionId || "",
                        message: m
                    });
                }
            }
        };

        // Channel 3: Room message.upsert raw event
        const handleUpsert = (payload: any) => {
            const msgs = payload?.messages;
            if (payload?.type !== 'notify' || !Array.isArray(msgs)) return;
            for (const msg of msgs) {
                if (msg && !msg.key?.fromMe && msg.key?.remoteJid && !msg.key.remoteJid.includes('status@broadcast')) {
                    let text = "";
                    let mType = "TEXT";
                    if (msg.message) {
                        const m = msg.message;
                        text = m.conversation || m.extendedTextMessage?.text || (m.imageMessage ? "📷 Foto" : "") || (m.videoMessage ? "🎥 Vídeo" : "") || (m.audioMessage ? "🎵 Áudio" : "") || "Nova mensagem";
                    }
                    processIncoming({
                        sessionId: payload.sessionId || sessionId || "",
                        message: {
                            keyId: msg.key.id,
                            remoteJid: msg.key.remoteJid,
                            pushName: msg.pushName || null,
                            content: text,
                            type: mType,
                            timestamp: new Date().toISOString(),
                            fromMe: false
                        }
                    });
                }
            }
        };

        s.on("incoming.message", handleIncoming);
        s.on("message.update", handleUpdate);
        s.on("message.upsert", handleUpsert);

        return () => {
            s.off("incoming.message", handleIncoming);
            s.off("message.update", handleUpdate);
            s.off("message.upsert", handleUpsert);
        };
    }, [activeSocket, processIncoming, sessionId]);

    // Global test function for debugging
    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).__nexusTestNotification = () => {
                unlockAudioSystem();
                processIncoming({
                    sessionId: sessionId || "test",
                    message: {
                        keyId: `test-${Date.now()}`,
                        remoteJid: "5511999998888@s.whatsapp.net",
                        pushName: "Cliente Teste",
                        content: "Olá! Testando a notificação flutuante e o sinal sonoro do NEXUS CHAT 🚀",
                        type: "TEXT",
                        timestamp: new Date().toISOString(),
                        fromMe: false
                    }
                });
            };
        }
    }, [processIncoming, sessionId]);

    const handleDismiss = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const handleOpenChat = (alert: FloatingAlert) => {
        handleDismiss(alert.id);
        const targetJid = alert.remoteJid;
        const number = targetJid.split("@")[0];

        // 1. Dispatch custom event for immediate in-place selection if ChatLayoutClient is active
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nexus:open-chat", {
                detail: { jid: targetJid, name: alert.senderTitle }
            }));
        }

        // 2. Navigate directly to the conversation page
        const cleanPath = targetJid.includes("@g.us")
            ? `/dashboard/chat/${encodeURIComponent(targetJid)}`
            : `/dashboard/chat/${encodeURIComponent(number)}`;
        router.push(cleanPath);
    };

    if (alerts.length === 0) return null;

    return (
        <aside
            aria-label="Notificações Flutuantes"
            className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    onClick={() => handleOpenChat(alert)}
                    className="pointer-events-auto cursor-pointer group bg-background/95 backdrop-blur-xl border-2 border-blue-500/50 shadow-2xl rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:border-blue-500 relative overflow-hidden animate-in slide-in-from-top-4 fade-in"
                >
                    {/* Top highlight animated gradient bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400" />

                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 relative">
                                <MessageSquare className="h-5 w-5" />
                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full animate-ping" />
                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full" />
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm truncate text-foreground">
                                        {alert.senderTitle}
                                    </span>
                                </div>
                                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                                    <BellRing className="h-3 w-3 inline animate-bounce" /> Nova mensagem recebida
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={(e) => handleDismiss(alert.id, e)}
                            className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 rounded-full transition-colors shrink-0"
                            title="Fechar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-2.5 text-xs text-foreground/90 bg-muted/40 p-2.5 rounded-xl line-clamp-2 border border-border/40 font-medium">
                        {alert.displayBody}
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-1 border-t border-border/20">
                        <span className="text-[10px] text-muted-foreground font-mono">
                            {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>

                        <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-3 text-xs gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenChat(alert);
                            }}
                        >
                            <span>Abrir Conversa</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ))}
        </aside>
    );
}
