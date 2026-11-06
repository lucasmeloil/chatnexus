"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, ArrowRight, BellRing, Volume2, ArrowRightLeft, UserCheck, MessagesSquare } from "lucide-react";
import { useSocket } from "@/components/chat/socket-context";
import { useSession } from "@/components/dashboard/session-provider";
import { useSession as useAuthSession } from "next-auth/react";
import {
    playNotificationSound,
    playTransferNotificationSound,
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

interface FloatingAlert {
    id: string;
    sessionId: string;
    remoteJid: string;
    senderTitle: string;
    cleanPhone: string;
    displayBody: string;
    timestamp: Date;
    isTransfer?: boolean;
    transferredBy?: string;
    departmentTag?: string;
    isInternalChat?: boolean;
    senderRole?: string;
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
    const { data: authSession } = useAuthSession();
    const router = useRouter();
    const [alerts, setAlerts] = useState<FloatingAlert[]>([]);
    const askedPermissionRef = useRef(false);
    const recentAlertsRef = useRef(new Set<string>());

    const currentUserId = authSession?.user?.id;
    const currentUserRole = (authSession?.user as any)?.role;
    const currentUserEmail = authSession?.user?.email?.toLowerCase();
    const isSuperAdmin = currentUserRole === "SUPERADMIN" || currentUserEmail === "admin@nexus.com" || currentUserEmail === "lucasmeloil@pm.me";

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

    // Process incoming transferred attendance event
    const processTransfer = useCallback((payload: any) => {
        if (!payload) return;
        const data = payload.data || payload;
        const targetUserId = data.targetUserId || data.assignedUserId;
        const transferredById = data.transferredById;
        const transferredByName = data.transferredByName || "Outro atendente";
        const departmentTag = data.departmentTag || "";
        const rawJid = payload.jid || data.chatJid || data.jid;
        if (!rawJid) return;

        // Skip sound and alert for self-initiated transfers
        if (transferredById && currentUserId && transferredById === currentUserId) return;

        // Verify if transfer is targeted to the logged-in user or Super Admin
        const isTargetedToMe = (targetUserId && targetUserId === currentUserId) ||
                              (isSuperAdmin && (!targetUserId || targetUserId === currentUserId));

        if (!isTargetedToMe) return;

        // Strict deduplication: prevent multiple events from stacking for the same transfer
        const transferKey = `transfer-${rawJid}-${targetUserId || ''}`;
        if (recentAlertsRef.current.has(transferKey)) return;
        recentAlertsRef.current.add(transferKey);
        setTimeout(() => {
            recentAlertsRef.current.delete(transferKey);
        }, 8000);

        // If notifications are disabled globally by user toggle, skip
        if (!isNotificationSoundEnabled()) return;

        const cleanPhone = rawJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const deptLabel = departmentTag ? ` [${departmentTag}]` : "";
        const transferAlertId = `transfer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        // 1. Play distinct transfer sound chime (ascending 3-tone chime)
        playTransferNotificationSound();

        // 2. Trigger native OS/Browser notification
        sendBrowserNotification(
            `🔄 Atendimento Transferido!`,
            {
                body: `${transferredByName} transferiu o cliente ${cleanPhone}${deptLabel} para você.`,
                tag: `transfer-${rawJid}`,
            },
            () => {
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("nexus:open-chat", {
                        detail: { jid: rawJid, name: cleanPhone, selectTab: "meus" }
                    }));
                }
                const number = rawJid.split("@")[0];
                const cleanPath = rawJid.includes("@g.us")
                    ? `/dashboard/chat/${encodeURIComponent(rawJid)}`
                    : `/dashboard/chat/${encodeURIComponent(number)}`;
                router.push(cleanPath);
            }
        );

        // 3. Add to visual floating alert card if floating notifications are enabled (Single Elegant Purple Card)
        if (isFloatingNotificationEnabled()) {
            const newAlert: FloatingAlert = {
                id: transferAlertId,
                sessionId: payload.sessionId || sessionId || "",
                remoteJid: rawJid,
                senderTitle: `${cleanPhone}${deptLabel}`,
                cleanPhone,
                displayBody: `${transferredByName} transferiu este atendimento para você.${departmentTag ? ` Setor: ${departmentTag}.` : ""}`,
                timestamp: new Date(),
                isTransfer: true,
                transferredBy: transferredByName,
                departmentTag: departmentTag || undefined
            };
            // Never stack duplicate alerts for the same conversation
            setAlerts(prev => [newAlert, ...prev.filter(a => !isSameChatJid(a.remoteJid, rawJid)).slice(0, 3)]);

            // Auto-dismiss floating banner card after 8 seconds so it doesn't linger indefinitely
            setTimeout(() => {
                setAlerts(prev => prev.filter(a => a.id !== transferAlertId));
            }, 8000);
        }
    }, [currentUserId, isSuperAdmin, router, sessionId]);

    // Process incoming internal chat message from team members or admin
    const processInternalMessage = useCallback((msg: any) => {
        if (!msg) return;
        const senderId = msg.senderId;
        // Skip messages sent by oneself
        if (senderId && currentUserId && senderId === currentUserId) return;

        // If user is currently in internal-chat tab with document in focus, avoid duplicate popups
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard/internal-chat") && document.hasFocus()) {
            return;
        }

        // Deduplicate internal chat message notifications
        const contentText = msg.content || "Nova mensagem no chat interno";
        const internalKey = `internal-${msg.id || `${senderId}_${contentText}`}`;
        if (recentAlertsRef.current.has(internalKey)) return;
        recentAlertsRef.current.add(internalKey);
        setTimeout(() => {
            recentAlertsRef.current.delete(internalKey);
        }, 8000);

        // If sound/notifications are disabled globally, exit
        if (!isNotificationSoundEnabled()) return;

        const senderName = msg.senderName || "Membro da Equipe";
        const roleLabel = msg.senderRole === "SUPERADMIN" ? "Administrador" : "Atendente";
        const internalAlertId = `internal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        // 1. Play sound chime
        playNotificationSound();

        // 2. Native OS/Browser notification
        sendBrowserNotification(
            `💬 ${senderName} no Chat Interno`,
            {
                body: contentText,
                tag: `internal-${msg.id || Date.now()}`,
            },
            () => {
                router.push("/dashboard/internal-chat");
            }
        );

        // 3. Floating alert banner if enabled (Single Elegant Green Card)
        if (isFloatingNotificationEnabled()) {
            const newAlert: FloatingAlert = {
                id: internalAlertId,
                sessionId: sessionId || "",
                remoteJid: "internal-chat",
                senderTitle: senderName,
                cleanPhone: roleLabel,
                displayBody: contentText,
                timestamp: new Date(),
                isInternalChat: true,
                senderRole: msg.senderRole
            };
            setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== internalAlertId && a.remoteJid !== "internal-chat").slice(0, 3)]);

            setTimeout(() => {
                setAlerts(prev => prev.filter(a => a.id !== internalAlertId));
            }, 8000);
        }
    }, [currentUserId, router, sessionId]);

    // Attach listeners across all message and attendance channels
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

        // Channel 4: Attendance transfer notifications
        const handleAttendanceTransfer = (payload: any) => {
            processTransfer(payload);
        };

        // Channel 5: Internal team chat messages
        const handleInternalChat = (payload: any) => {
            processInternalMessage(payload);
        };

        s.on("incoming.message", handleIncoming);
        s.on("message.update", handleUpdate);
        s.on("message.upsert", handleUpsert);
        s.on("attendance.transfer", handleAttendanceTransfer);
        s.on("internal_chat.message", handleInternalChat);

        return () => {
            s.off("incoming.message", handleIncoming);
            s.off("message.update", handleUpdate);
            s.off("message.upsert", handleUpsert);
            s.off("attendance.transfer", handleAttendanceTransfer);
            s.off("internal_chat.message", handleInternalChat);
        };
    }, [activeSocket, processIncoming, processTransfer, processInternalMessage, sessionId]);

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

            (window as any).__nexusTestTransfer = (targetName = "Super Admin") => {
                unlockAudioSystem();
                processTransfer({
                    action: "transfer",
                    sessionId: sessionId || "test",
                    jid: "5579998494744@s.whatsapp.net",
                    data: {
                        chatJid: "5579998494744@s.whatsapp.net",
                        assignedUserId: currentUserId || "test-user",
                        transferredByName: "Eduardo Santos",
                        transferredById: "other-user",
                        departmentTag: "Comercial"
                    }
                });
            };

            (window as any).__nexusTestInternalChat = (senderName = "Super Admin", content = "Olá equipe! Nova mensagem no Chat Interno 🚀") => {
                unlockAudioSystem();
                processInternalMessage({
                    id: `test-internal-${Date.now()}`,
                    senderId: "other-user-test",
                    senderName: senderName,
                    senderRole: "SUPERADMIN",
                    content: content,
                    createdAt: new Date().toISOString()
                });
            };
        }
    }, [processIncoming, processTransfer, processInternalMessage, sessionId, currentUserId]);

    // Automatically dismiss alerts when any chat conversation is opened
    useEffect(() => {
        const handleChatOpened = (e: any) => {
            const jid = e.detail?.jid;
            if (jid) {
                setAlerts(prev => prev.filter(a => !isSameChatJid(a.remoteJid, jid)));
            }
        };
        window.addEventListener("nexus:open-chat", handleChatOpened);
        return () => window.removeEventListener("nexus:open-chat", handleChatOpened);
    }, []);

    const handleDismiss = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    const handleOpenChat = (alert: FloatingAlert) => {
        handleDismiss(alert.id);

        if (alert.isInternalChat) {
            router.push("/dashboard/internal-chat");
            return;
        }

        const targetJid = alert.remoteJid;
        const number = targetJid.split("@")[0];

        // Clear all floating alerts belonging to this conversation
        setAlerts(prev => prev.filter(a => !isSameChatJid(a.remoteJid, targetJid)));

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
                    className={
                        alert.isInternalChat
                            ? "pointer-events-auto cursor-pointer group bg-background/95 backdrop-blur-xl border-2 border-emerald-500/80 shadow-2xl rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500 relative overflow-hidden animate-in slide-in-from-top-4 fade-in ring-2 ring-emerald-500/20"
                            : alert.isTransfer
                            ? "pointer-events-auto cursor-pointer group bg-background/95 backdrop-blur-xl border-2 border-purple-500/80 shadow-2xl rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500 relative overflow-hidden animate-in slide-in-from-top-4 fade-in ring-2 ring-purple-500/20"
                            : "pointer-events-auto cursor-pointer group bg-background/95 backdrop-blur-xl border-2 border-blue-500/50 shadow-2xl rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:border-blue-500 relative overflow-hidden animate-in slide-in-from-top-4 fade-in"
                    }
                >
                    {/* Top highlight animated gradient bar */}
                    {alert.isInternalChat ? (
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 animate-pulse" />
                    ) : alert.isTransfer ? (
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-500 animate-pulse" />
                    ) : (
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            {alert.isInternalChat ? (
                                <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 relative">
                                    <MessagesSquare className="h-5 w-5" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full animate-ping" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full" />
                                </div>
                            ) : alert.isTransfer ? (
                                <div className="h-10 w-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400 relative">
                                    <ArrowRightLeft className="h-5 w-5" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-purple-500 rounded-full animate-ping" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-purple-500 rounded-full" />
                                </div>
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 relative">
                                    <MessageSquare className="h-5 w-5" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full animate-ping" />
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full" />
                                </div>
                            )}

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm truncate text-foreground">
                                        {alert.senderTitle}
                                    </span>
                                </div>
                                {alert.isInternalChat ? (
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                        <MessagesSquare className="h-3 w-3 inline animate-pulse" /> Chat Interno da Equipe
                                    </span>
                                ) : alert.isTransfer ? (
                                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                                        <ArrowRightLeft className="h-3 w-3 inline animate-pulse" /> Atendimento Transferido
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                                        <BellRing className="h-3 w-3 inline animate-bounce" /> Nova mensagem recebida
                                    </span>
                                )}
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

                    <div className={
                        alert.isInternalChat
                            ? "mt-2.5 text-xs text-foreground/90 bg-emerald-500/10 dark:bg-emerald-950/20 p-2.5 rounded-xl line-clamp-2 border border-emerald-500/20 font-medium"
                            : alert.isTransfer
                            ? "mt-2.5 text-xs text-foreground/90 bg-purple-500/10 dark:bg-purple-950/20 p-2.5 rounded-xl line-clamp-2 border border-purple-500/20 font-medium"
                            : "mt-2.5 text-xs text-foreground/90 bg-muted/40 p-2.5 rounded-xl line-clamp-2 border border-border/40 font-medium"
                    }>
                        {alert.displayBody}
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-1 border-t border-border/20">
                        <span className="text-[10px] text-muted-foreground font-mono">
                            {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>

                        {alert.isInternalChat ? (
                            <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-3 text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChat(alert);
                                }}
                            >
                                <span>Abrir Chat Interno</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        ) : alert.isTransfer ? (
                            <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-3 text-xs gap-1.5 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-md"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChat(alert);
                                }}
                            >
                                <span>Atender Agora</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        ) : (
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
                        )}
                    </div>
                </div>
            ))}
        </aside>
    );
}
