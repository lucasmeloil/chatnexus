"use client";

import { useState, useEffect } from "react";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { MessageCircle } from "lucide-react";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import { setActiveOpenChatJid } from "@/lib/notification-sound";

interface ChatLayoutClientProps {
    sessionId: string;
    initialJid?: string;
}

interface SelectedChat {
    jid: string;
    name?: string;
    attendance?: any;
}

export function ChatLayoutClient({ sessionId, initialJid }: ChatLayoutClientProps) {
    const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(
        initialJid ? { jid: initialJid } : null
    );

    // Sync initialJid when prop changes
    useEffect(() => {
        if (initialJid) {
            const resolved = initialJid.includes("@") ? initialJid : formatToBrazilPhoneJid(initialJid);
            setSelectedChat({ jid: resolved });
        }
    }, [initialJid]);

    // Broadcast active chat JID so notifications for the open chat can be muted
    useEffect(() => {
        setActiveOpenChatJid(selectedChat?.jid || null);
        return () => {
            setActiveOpenChatJid(null);
        };
    }, [selectedChat]);

    // Handle instant in-place conversation opening from floating notification banner
    useEffect(() => {
        const handleOpenChat = (e: any) => {
            const jid = e.detail?.jid;
            if (jid) {
                const resolved = jid.includes("@") ? jid : formatToBrazilPhoneJid(jid);
                setSelectedChat({ jid: resolved, name: e.detail?.name });
            }
        };
        window.addEventListener("nexus:open-chat", handleOpenChat as EventListener);
        return () => window.removeEventListener("nexus:open-chat", handleOpenChat as EventListener);
    }, []);

    // Sync selected chat to URL pathname
    useEffect(() => {
        if (typeof window === "undefined") return;
        const base = "/dashboard/chat";
        if (selectedChat) {
            const number = selectedChat.jid.split("@")[0];
            const newPath = `${base}/${number}`;
            if (window.location.pathname !== newPath) {
                window.history.replaceState(null, "", newPath);
            }
        } else {
            if (window.location.pathname !== base) {
                window.history.replaceState(null, "", base);
            }
        }
    }, [selectedChat]);

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname;
            if (path.startsWith("/dashboard/chat/")) {
                const rawJid = path.replace("/dashboard/chat/", "");
                const decoded = decodeURIComponent(rawJid);
                const resolved = decoded.includes("@") ? decoded : formatToBrazilPhoneJid(decoded);
                setSelectedChat({ jid: resolved });
            } else {
                setSelectedChat(null);
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleSelectChat = (jid: string, name?: string, attendance?: any) => {
        setSelectedChat({ jid, name, attendance });
    };

    const handleBack = () => {
        setSelectedChat(null);
        if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/dashboard/chat");
        }
    };

    return (
        // Outer: flex row, full height, overflow hidden — containment chain root
        <div className="flex h-full bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden min-h-0">
            {/* Chat List Panel */}
            <div className={`w-full md:w-[350px] lg:w-[380px] xl:w-[400px] border-r border-border/40 overflow-hidden shrink-0 flex flex-col
                ${selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {/* Inner flex-col: header fixed + virtuoso fills rest */}
                <ChatList
                    sessionId={sessionId}
                    onSelectChat={handleSelectChat}
                    selectedJid={selectedChat?.jid}
                />
            </div>

            {/* Chat Window Panel */}
            <div className={`flex-1 overflow-hidden flex flex-col min-w-0
                ${!selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {selectedChat ? (
                    <ChatWindow
                        sessionId={sessionId}
                        jid={selectedChat.jid}
                        name={selectedChat.name}
                        initialAttendance={selectedChat.attendance}
                        onBack={handleBack}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center min-w-0 min-h-0 bg-background/50 select-none p-6">
                        <div className="flex flex-col items-center justify-center max-w-sm text-center">
                            <img
                                src="/nexus-chat-logo.png"
                                alt="Nexus Chat"
                                className="h-16 sm:h-20 w-auto object-contain opacity-85 drop-shadow-sm transition-transform duration-300 hover:scale-105 pointer-events-none"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
