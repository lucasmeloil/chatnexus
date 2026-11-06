"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/components/chat/socket-context";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Hash,
    User as UserIcon,
    Send,
    MessageSquare,
    Search,
    Shield,
    Clock,
    PhoneCall,
    ExternalLink,
    Paperclip,
    Sparkles,
    CheckCheck,
    Users,
    Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playNotificationSound } from "@/lib/notification-sound";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMember {
    id: string;
    name: string | null;
    email: string;
    role: string;
}

interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    receiverId: string | null;
    channel: string;
    content: string;
    customerJid: string | null;
    customerName: string | null;
    isRead: boolean;
    createdAt: string;
}

export function InternalChatView() {
    const { data: authSession } = useSession();
    const { socket: socketFromCtx, getSocket } = useSocket();
    const router = useRouter();

    const currentUserId = authSession?.user?.id;
    const currentUserName = authSession?.user?.name || authSession?.user?.email || "Eu";
    const currentUserRole = (authSession?.user as any)?.role || "STAFF";

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [selectedTarget, setSelectedTarget] = useState<{ type: "channel" | "user"; id: string; name: string; role?: string }>({
        type: "channel",
        id: "general",
        name: "Geral (Toda a Equipe)"
    });
    const [messages, setMessages] = useState<InternalMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Customer mention state
    const [attachCustomerPrompt, setAttachCustomerPrompt] = useState(false);
    const [customerPhoneInput, setCustomerPhoneInput] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeSocket = socketFromCtx || getSocket();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load team members and unread counts
    const loadTeamMembers = useCallback(async () => {
        try {
            const res = await fetch("/api/internal-chat/users");
            if (!res.ok) return;
            const data = await res.json();
            if (data.status && data.data) {
                setMembers(data.data.members || []);
                setUnreadCounts(data.data.unreadCounts || {});
            }
        } catch (e) {
            console.error("Error loading team members", e);
        }
    }, []);

    // Load messages for current selection
    const loadMessages = useCallback(async () => {
        setLoading(true);
        try {
            const url = selectedTarget.type === "channel"
                ? `/api/internal-chat/messages?channel=${encodeURIComponent(selectedTarget.id)}`
                : `/api/internal-chat/messages?userId=${encodeURIComponent(selectedTarget.id)}`;

            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (data.status && Array.isArray(data.data)) {
                setMessages(data.data);
                setTimeout(scrollToBottom, 100);
            }

            // Mark as read
            if (selectedTarget.type === "user") {
                await fetch("/api/internal-chat/read", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ senderId: selectedTarget.id })
                });
                setUnreadCounts(prev => {
                    const next = { ...prev };
                    delete next[selectedTarget.id];
                    return next;
                });
            }
        } catch (e) {
            console.error("Error loading internal messages", e);
        } finally {
            setLoading(false);
        }
    }, [selectedTarget]);

    useEffect(() => {
        loadTeamMembers();
    }, [loadTeamMembers]);

    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // Real-time socket events for internal chat
    useEffect(() => {
        const s = activeSocket;
        if (!s) return;

        // Join personal user room for direct messages
        if (currentUserId) {
            s.emit("join-user-room", currentUserId);
        }

        const handleNewMessage = (msg: InternalMessage) => {
            const isForCurrentView =
                (selectedTarget.type === "channel" && msg.channel === selectedTarget.id) ||
                (selectedTarget.type === "user" &&
                    ((msg.senderId === selectedTarget.id && msg.receiverId === currentUserId) ||
                     (msg.senderId === currentUserId && msg.receiverId === selectedTarget.id)));

            if (isForCurrentView) {
                setMessages(prev => [...prev, msg]);
                setTimeout(scrollToBottom, 100);
            } else if (msg.senderId !== currentUserId) {
                // Incoming message in another conversation
                playNotificationSound();
                if (msg.receiverId === currentUserId) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [msg.senderId]: (prev[msg.senderId] || 0) + 1
                    }));
                    toast.info(`Nova mensagem interna de ${msg.senderName}`, {
                        description: msg.content.substring(0, 60),
                        action: {
                            label: "Ver",
                            onClick: () => {
                                setSelectedTarget({
                                    type: "user",
                                    id: msg.senderId,
                                    name: msg.senderName,
                                    role: msg.senderRole
                                });
                            }
                        }
                    });
                }
            }
        };

        s.on("internal_chat.message", handleNewMessage);
        return () => {
            s.off("internal_chat.message", handleNewMessage);
        };
    }, [activeSocket, currentUserId, selectedTarget]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const text = inputText.trim();
        if (!text || sending) return;

        setSending(true);
        try {
            const body: any = {
                content: text
            };

            if (selectedTarget.type === "channel") {
                body.channel = selectedTarget.id;
            } else {
                body.receiverId = selectedTarget.id;
            }

            if (customerPhoneInput.trim()) {
                const cleanPhone = customerPhoneInput.replace(/\D/g, "");
                body.customerJid = `${cleanPhone}@s.whatsapp.net`;
                body.customerName = `Cliente ${cleanPhone}`;
            }

            const res = await fetch("/api/internal-chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setInputText("");
                setCustomerPhoneInput("");
                setAttachCustomerPrompt(false);
            } else {
                toast.error("Erro ao enviar mensagem");
            }
        } catch (err: any) {
            toast.error(err.message || "Falha de rede");
        } finally {
            setSending(false);
        }
    };

    const filteredMembers = members.filter(m => {
        if (m.id === currentUserId) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (m.name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });

    const formatRole = (role?: string) => {
        if (role === "SUPERADMIN") return "Super Admin";
        if (role === "OWNER") return "Admin";
        return "Atendente";
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            {/* Left Panel: Channels & Team Members */}
            <div className="w-80 border-r border-border/50 flex flex-col bg-muted/20">
                <div className="p-3.5 border-b border-border/40">
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground mb-3">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Equipe NEXUS Chat</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar atendente..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background/80 rounded-xl"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4 styled-scrollbar">
                    {/* Canas / Grupos */}
                    <div>
                        <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Canais da Equipe
                        </span>
                        <div className="mt-1 space-y-0.5">
                            <button
                                type="button"
                                onClick={() => setSelectedTarget({
                                    type: "channel",
                                    id: "general",
                                    name: "Geral (Toda a Equipe)"
                                })}
                                className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                                    selectedTarget.type === "channel" && selectedTarget.id === "general"
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "hover:bg-muted text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Hash className="h-4 w-4 shrink-0" />
                                    <span className="truncate">Geral (Equipe)</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Atendentes / Mensagens Diretas */}
                    <div>
                        <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Mensagens Diretas
                        </span>
                        <div className="mt-1 space-y-0.5">
                            {filteredMembers.map((member) => {
                                const isSelected = selectedTarget.type === "user" && selectedTarget.id === member.id;
                                const unread = unreadCounts[member.id] || 0;
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => setSelectedTarget({
                                            type: "user",
                                            id: member.id,
                                            name: member.name || member.email,
                                            role: member.role
                                        })}
                                        className={cn(
                                            "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                                            isSelected
                                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                                : "hover:bg-muted text-foreground"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="relative">
                                                <div className={cn(
                                                    "h-7 w-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0",
                                                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                                                )}>
                                                    {(member.name || member.email)[0].toUpperCase()}
                                                </div>
                                                <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                                            </div>
                                            <div className="text-left min-w-0">
                                                <div className="truncate text-xs">
                                                    {member.name || member.email}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] truncate",
                                                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                                )}>
                                                    {formatRole(member.role)}
                                                </div>
                                            </div>
                                        </div>

                                        {unread > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shrink-0 animate-pulse">
                                                {unread}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Chat Messages & Input */}
            <div className="flex-1 flex flex-col bg-background/50">
                {/* Header */}
                <div className="h-14 px-4 border-b border-border/40 flex items-center justify-between bg-card/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {selectedTarget.type === "channel" ? (
                            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Hash className="h-5 w-5" />
                            </div>
                        ) : (
                            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                                {selectedTarget.name[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate text-foreground flex items-center gap-2">
                                {selectedTarget.name}
                                {selectedTarget.role && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground font-normal">
                                        {formatRole(selectedTarget.role)}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                                {selectedTarget.type === "channel" ? "Canal público para todos os operadores e administradores" : "Conversa direta e privada"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 styled-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                            Carregando histórico da conversa...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-2" />
                            <p className="text-sm font-medium text-foreground">Nenhuma mensagem ainda</p>
                            <p className="text-xs max-w-sm mt-1">
                                Envie uma mensagem para iniciar o diálogo interno com a equipe.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.senderId === currentUserId;
                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col max-w-[75%]",
                                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                                    )}
                                >
                                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground/80">{isMe ? "Você" : msg.senderName}</span>
                                        <span>•</span>
                                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>

                                    <div
                                        className={cn(
                                            "rounded-2xl p-3 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap break-words",
                                            isMe
                                                ? "bg-primary text-primary-foreground rounded-tr-xs"
                                                : "bg-muted/70 text-foreground border border-border/40 rounded-tl-xs"
                                        )}
                                    >
                                        {msg.content}

                                        {/* Reference to Customer WhatsApp Conversation */}
                                        {msg.customerJid && (
                                            <div className={cn(
                                                "mt-2.5 p-2 rounded-xl border flex items-center justify-between gap-2 text-[11px]",
                                                isMe ? "bg-black/10 border-white/20 text-white" : "bg-background border-border/50 text-foreground"
                                            )}>
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <PhoneCall className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                    <span className="font-semibold truncate">{msg.customerName || msg.customerJid}</span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-6 px-2 text-[10px] gap-1 shrink-0 cursor-pointer font-medium"
                                                    onClick={() => {
                                                        const clean = msg.customerJid!.split("@")[0];
                                                        router.push(`/dashboard/chat/${clean}`);
                                                    }}
                                                >
                                                    <span>Abrir Chat</span>
                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Footer */}
                <div className="p-3 border-t border-border/40 bg-card/60">
                    {attachCustomerPrompt && (
                        <div className="mb-2 p-2 rounded-xl bg-muted/60 border border-border/40 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 text-xs">
                            <PhoneCall className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-muted-foreground font-medium shrink-0">Vincular Cliente (WhatsApp):</span>
                            <Input
                                placeholder="DDD + Número (ex: 79998494744)"
                                value={customerPhoneInput}
                                onChange={(e) => setCustomerPhoneInput(e.target.value)}
                                className="h-7 text-xs bg-background"
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                    setAttachCustomerPrompt(false);
                                    setCustomerPhoneInput("");
                                }}
                            >
                                Cancelar
                            </Button>
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title="Mencionar cliente em atendimento"
                            onClick={() => setAttachCustomerPrompt(!attachCustomerPrompt)}
                            className={cn(
                                "h-9 w-9 p-0 rounded-xl shrink-0 cursor-pointer",
                                attachCustomerPrompt ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                            )}
                        >
                            <PhoneCall className="h-4 w-4" />
                        </Button>

                        <Input
                            placeholder={`Enviar mensagem interna em ${selectedTarget.name}...`}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="flex-1 h-9 text-xs rounded-xl bg-background"
                        />

                        <Button
                            type="submit"
                            size="sm"
                            disabled={!inputText.trim() || sending}
                            className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
                        >
                            <span>Enviar</span>
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
