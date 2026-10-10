"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Search, MessageCircle, X, Tag, MoreHorizontal, CornerUpLeft, Trash2, Info, Check, CheckCheck, Clock, RotateCcw, CheckCircle2, Volume2, VolumeX, RefreshCw, Users, UserCheck, Inbox, SearchX, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getChatsStatus } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { toast } from "sonner";
import { formatToBrazilPhoneJid, isSameChatJid } from "@/lib/jid-utils";
import { 
    playNotificationSound, 
    isNotificationSoundEnabled, 
    setNotificationSoundEnabled, 
    isFloatingNotificationEnabled,
    setFloatingNotificationEnabled,
    isMuteActiveChatEnabled, 
    setMuteActiveChatEnabled,
    getActiveOpenChatJid
} from "@/lib/notification-sound";

export { isSameChatJid };

import { useSession } from "next-auth/react";

interface AttendanceInfo {
    id?: string;
    status: "WAITING" | "IN_PROGRESS" | "CLOSED";
    assignedUserId: string | null;
    assignedUserName: string | null;
    departmentTag?: string | null;
    closedAt?: string | null;
}

interface ChatContact {
    jid: string;
    name: string | null;
    notify: string | null;
    profilePic: string | null;
    unreadCount?: number;
    attendance?: AttendanceInfo;
    lastMessage?: {
        content: string | null;
        timestamp: string;
        type: string;
        fromMe?: boolean;
        keyId?: string;
        status?: string;
    };
}

interface LabelData {
    id: string;
    name: string;
    colorHex: string;
}

interface ChatListProps {
    sessionId: string;
    onSelectChat: (jid: string, name?: string, attendance?: any) => void;
    selectedJid?: string;
}

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

function getDisplayName(chat: ChatContact): string {
    return chat.name || chat.notify || chat.jid.split('@')[0];
}

function getMessagePreview(chat: ChatContact): string {
    if (!chat.lastMessage?.content) return "Sem mensagens";
    const content = chat.lastMessage.content;
    if (chat.lastMessage.type !== "TEXT") {
        return `📎 ${chat.lastMessage.type.charAt(0) + chat.lastMessage.type.slice(1).toLowerCase()}`;
    }
    return content.length > 40 ? content.slice(0, 40) + "…" : content;
}

function getTimeLabel(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Label Assignment Popover ──────
function LabelAssignPopover({ sessionId, jid, children }: { sessionId: string; jid: string; children: React.ReactNode }) {
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [assigned, setAssigned] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const openRef = useRef(false);

    const fetchLabels = useCallback(async () => {
        setLoading(true);
        try {
            const [labelRes, assignedRes] = await Promise.all([
                fetch(`/api/labels/${sessionId}`),
                fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`)
            ]);
            const labelData = await labelRes.json().catch(() => null);
            const assignedData = await assignedRes.json().catch(() => null);

            if (labelRes.ok && labelData) setLabels(labelData.data?.labels || []);
            if (assignedRes.ok && assignedData) {
                setAssigned(new Set((assignedData.data || []).map((cl: any) => cl.labelId)));
            }
        } catch (e) {
            console.error("Failed to fetch labels", e);
        } finally {
            setLoading(false);
        }
    }, [sessionId, jid]);

    useEffect(() => {
        if (openRef.current) fetchLabels();
    }, [fetchLabels]);

    const toggleLabel = async (labelId: string) => {
        const isAssigned = assigned.has(labelId);
        try {
            const res = await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelIds: [labelId], action: isAssigned ? "remove" : "add" })
            });
            if (res.ok) {
                setAssigned(prev => {
                    const next = new Set(prev);
                    isAssigned ? next.delete(labelId) : next.add(labelId);
                    return next;
                });
                toast.success(isAssigned ? "Etiqueta removida" : "Etiqueta atribuída");
            }
        } catch (e) {
            toast.error("Falha ao atualizar etiqueta");
        }
    };

    return (
        <Popover onOpenChange={(open) => { openRef.current = open; if (open) fetchLabels(); }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" side="right" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Atribuir Etiquetas</div>
                {loading ? (
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-4 w-24" /></div>
                ) : labels.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma etiqueta encontrada.</p>
                ) : (
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {labels.map(label => (
                            <button key={label.id} onClick={() => toggleLabel(label.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer text-left">
                                <div className={cn(
                                    "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                    assigned.has(label.id) ? "border-foreground" : "border-muted-foreground/30"
                                )}>
                                    {assigned.has(label.id) && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.colorHex }} />
                                <span className="truncate text-xs font-medium">{label.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// ─── Context Menu ──────────────────
interface CtxMenuState { x: number; y: number; jid: string; name: string; isFinalized?: boolean; }
function ChatContextMenu({ 
    state, onClose, sessionId, onSelect, onReopen, onAccept, onReject, isWaiting
}: { 
    state: CtxMenuState; onClose: () => void; sessionId: string; onSelect: (jid: string, name?: string) => void;
    onReopen?: (jid: string) => void; onAccept?: (jid: string) => void; onReject?: (jid: string) => void; isWaiting?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    const items = [
        { label: "Abrir conversa", icon: MessageCircle, action: () => { onSelect(state.jid, state.name); onClose(); } },
        ...(isWaiting && onAccept ? [
            { label: "Aceitar atendimento", icon: CheckCircle2, action: () => { onAccept(state.jid); onClose(); }, highlight: "blue" }
        ] : []),
        ...(isWaiting && onReject ? [
            { label: "Rejeitar conversa", icon: Trash2, action: () => { onReject(state.jid); onClose(); }, highlight: "red" }
        ] : []),
        ...(state.isFinalized && onReopen ? [
            { label: "Reabrir atendimento", icon: RotateCcw, action: () => { onReopen(state.jid); onClose(); }, highlight: "amber" }
        ] : []),
        { label: "Copiar JID", icon: Info, action: () => { navigator.clipboard.writeText(state.jid).then(() => toast.success("JID copiado!")); onClose(); } },
    ];

    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 120) style.top = state.y - 120;

    return (
        <div ref={ref} style={style} className="w-48 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer text-left",
                    item.highlight === "red"
                        ? "text-red-600 dark:text-red-400 hover:bg-red-500/10 font-medium"
                        : item.highlight === "amber" 
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium" 
                        : item.highlight === "blue"
                        ? "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium"
                        : "text-foreground hover:bg-muted"
                )}>
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

const avatarCheckedJids = new Set<string>();

// ─── Chat Row ──────────────────────
function ChatRow({
    chat, isSelected, onSelect, sessionId, labelDots, isFinalized, onReopen, onAccept, onReject, currentUserId
}: {
    chat: ChatContact; isSelected: boolean; onSelect: (jid: string, name?: string, attendance?: any) => void; sessionId: string;
    labelDots: { colorHex: string }[]; isFinalized?: boolean; onReopen?: (jid: string) => void;
    onAccept?: (jid: string, e?: React.MouseEvent) => void; onReject?: (jid: string, e?: React.MouseEvent) => void; currentUserId?: string;
}) {
    const displayName = getDisplayName(chat);
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
    const isWaiting = chat.attendance?.status === "WAITING" && !isFinalized;
    const isMine = chat.attendance?.status === "IN_PROGRESS" && chat.attendance?.assignedUserId === currentUserId;
    const isOtherAssigned = chat.attendance?.status === "IN_PROGRESS" && chat.attendance?.assignedUserId && chat.attendance?.assignedUserId !== currentUserId;

    // Busca automaticamente a foto de perfil da pessoa caso ainda não esteja em cache
    useEffect(() => {
        if (chat.profilePic || !sessionId || !chat.jid || chat.jid.endsWith('@g.us')) return;
        if (avatarCheckedJids.has(chat.jid)) return;
        avatarCheckedJids.add(chat.jid);

        fetch(`/api/chat/${sessionId}/${encodeURIComponent(chat.jid)}/profile-picture`)
            .then(async res => {
                if (!res.ok) return null;
                return res.json().catch(() => null);
            })
            .then(data => {
                if (data?.profilePicUrl) {
                    window.dispatchEvent(new CustomEvent("nexus:contact-updated", {
                        detail: { jid: chat.jid, profilePic: data.profilePicUrl }
                    }));
                }
            })
            .catch(() => {});
    }, [sessionId, chat.jid, chat.profilePic]);

    return (
        <>
            {ctxMenu && (
                <ChatContextMenu 
                    state={ctxMenu} 
                    onClose={() => setCtxMenu(null)} 
                    sessionId={sessionId} 
                    onSelect={onSelect} 
                    onReopen={onReopen}
                    onAccept={onAccept}
                    onReject={onReject}
                    isWaiting={isWaiting}
                />
            )}
            <div
                className={cn(
                    "relative w-[calc(100%-12px)] mx-1.5 my-0.5 rounded-xl flex items-center gap-3 px-3 py-2.5 transition-all duration-150 group overflow-hidden cursor-pointer",
                    isSelected
                        ? "bg-primary/10 dark:bg-primary/15 shadow-2xs ring-1 ring-primary/20 text-foreground"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onSelect(chat.jid, displayName, chat.attendance)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, jid: chat.jid, name: displayName, isFinalized }); }}
            >
                <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={chat.profilePic || undefined} />
                        <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                            {displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    {isWaiting && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-background" />
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex justify-between items-baseline gap-2 overflow-hidden">
                        <div className="flex items-center gap-1.5 truncate">
                            <h4 className={cn("text-sm truncate", isSelected ? "font-semibold text-primary" : "font-medium text-foreground")}>
                                {displayName}
                            </h4>
                            
                            {/* Attendance Badges */}
                            {isWaiting && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                    Em Espera
                                </span>
                            )}
                            {isMine && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                    Meu Atendimento
                                </span>
                            )}
                            {isOtherAssigned && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0" title={`Em atendimento por ${chat.attendance?.assignedUserName || 'outro atendente'}`}>
                                    {chat.attendance?.assignedUserName || 'Outro Atendente'}
                                </span>
                            )}
                            {isFinalized && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                    Finalizado
                                </span>
                            )}

                            {/* Label dots — always visible */}
                            {labelDots.length > 0 && (
                                <span className="flex items-center gap-[2px] shrink-0">
                                    {labelDots.map((d, i) => (
                                        <span key={i} className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: d.colorHex }} title={d.colorHex} />
                                    ))}
                                </span>
                            )}
                        </div>
                        {chat.lastMessage && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{getTimeLabel(chat.lastMessage.timestamp)}</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={cn(
                            "text-xs truncate flex-1 flex items-center",
                            Number(chat.unreadCount || 0) > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}>
                            {chat.lastMessage?.fromMe && (
                                <span 
                                    className="inline-flex items-center shrink-0 mr-1 select-none"
                                    title={
                                        chat.lastMessage.status === "READ" ? "Lida" :
                                        chat.lastMessage.status === "DELIVERED" ? "Entregue" :
                                        chat.lastMessage.status === "SENT" ? "Enviada" : "Pendente"
                                    }
                                >
                                    {chat.lastMessage.status === "READ" ? (
                                        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] stroke-[2.3]" />
                                    ) : chat.lastMessage.status === "DELIVERED" ? (
                                        <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/70 stroke-[2.3]" />
                                    ) : chat.lastMessage.status === "SENT" ? (
                                        <Check className="h-3.5 w-3.5 text-muted-foreground/70 stroke-[2.3]" />
                                    ) : (
                                        <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                                    )}
                                </span>
                            )}
                            <span className="truncate">{getMessagePreview(chat)}</span>
                        </p>
                        {Number(chat.unreadCount || 0) > 0 ? (
                            <span 
                                className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shrink-0 shadow-xs animate-in zoom-in-75"
                                title={`${chat.unreadCount} nova(s) mensagem(ns)`}
                            >
                                {Number(chat.unreadCount) > 99 ? "99+" : chat.unreadCount}
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Quick Action Buttons for Waiting Chats */}
                {isWaiting && (
                    <div className="flex items-center gap-1 shrink-0">
                        {onAccept && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAccept(chat.jid, e);
                                }}
                                className="h-6 text-[10px] px-2 rounded-lg border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 font-semibold shrink-0 cursor-pointer shadow-2xs"
                                title="Atender esta conversa"
                            >
                                Atender
                            </Button>
                        )}
                        {onReject && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReject(chat.jid, e);
                                }}
                                className="h-6 text-[10px] px-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/15 font-semibold shrink-0 cursor-pointer"
                                title="Rejeitar e excluir conversa da espera"
                            >
                                Rejeitar
                            </Button>
                        )}
                    </div>
                )}

                {/* Label button on hover */}
                <LabelAssignPopover sessionId={sessionId} jid={chat.jid}>
                    <Button variant="ghost" size="icon"
                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                        onClick={(e) => e.stopPropagation()}>
                        <Tag className="h-3.5 w-3.5" />
                    </Button>
                </LabelAssignPopover>
            </div>
        </>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-40" />
            </div>
        </div>
    );
}

type TabType = "espera" | "meus" | "todos" | "finalizadas";

// ─── Main ──────────────────────────
export function ChatList({ sessionId, onSelectChat, selectedJid }: ChatListProps) {
    const { data: authSession } = useSession();
    const currentUserId = authSession?.user?.id;
    const currentUserRole = (authSession?.user as any)?.role;
    const isSuperAdmin = currentUserRole === "SUPERADMIN" || authSession?.user?.email?.toLowerCase() === "lucasmeloil@pm.me";

    const [chats, setChats] = useState<ChatContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatNumber, setNewChatNumber] = useState("");
    const [hasMore, setHasMore] = useState(true);
    // Label assignments per JID — {id, name, colorHex}[]
    const [chatLabelMap, setChatLabelMap] = useState<Map<string, { id: string; name: string; colorHex: string }[]>>(new Map());
    const [activeTab, setActiveTab] = useState<TabType>("espera");
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [floatingEnabled, setFloatingEnabled] = useState(true);
    const [muteActiveChat, setMuteActiveChat] = useState(true);

    const selectedJidRef = useRef(selectedJid);
    selectedJidRef.current = selectedJid;
    const processedMsgIdsRef = useRef<Set<string>>(new Set());

    // Clean up any stale/corrupted localStorage from earlier sessions
    useEffect(() => {
        if (typeof window !== "undefined" && sessionId) {
            try {
                localStorage.removeItem(`nexus_unread_${sessionId}`);
            } catch {}
        }
    }, [sessionId]);

    // Reset unread count when chat is opened or selected
    useEffect(() => {
        if (selectedJid) {
            setChats(prev => prev.map(c => isSameChatJid(c.jid, selectedJid) ? { ...c, unreadCount: 0 } : c));
        }
    }, [selectedJid]);

    useEffect(() => {
        setSoundEnabled(isNotificationSoundEnabled());
        setFloatingEnabled(isFloatingNotificationEnabled());
        setMuteActiveChat(isMuteActiveChatEnabled());

        const handleSoundChange = (e: any) => setSoundEnabled(e.detail?.enabled ?? isNotificationSoundEnabled());
        const handleFloatingChange = (e: any) => setFloatingEnabled(e.detail?.enabled ?? isFloatingNotificationEnabled());
        const handleMuteChange = (e: any) => setMuteActiveChat(e.detail?.enabled ?? isMuteActiveChatEnabled());

        window.addEventListener("nexus:sound-enabled-changed", handleSoundChange);
        window.addEventListener("nexus:floating-notification-changed", handleFloatingChange);
        window.addEventListener("nexus:mute-active-chat-changed", handleMuteChange);
        return () => {
            window.removeEventListener("nexus:sound-enabled-changed", handleSoundChange);
            window.removeEventListener("nexus:floating-notification-changed", handleFloatingChange);
            window.removeEventListener("nexus:mute-active-chat-changed", handleMuteChange);
        };
    }, []);

    const handleToggleSound = (val: boolean) => {
        setSoundEnabled(val);
        setNotificationSoundEnabled(val);
        if (val) {
            playNotificationSound();
            toast.success("Sons e notificações ativados");
        } else {
            toast.info("Sons e notificações desativados");
        }
    };

    const handleToggleFloating = (val: boolean) => {
        setFloatingEnabled(val);
        setFloatingNotificationEnabled(val);
        if (val) {
            toast.success("Notificações flutuantes ativadas");
        } else {
            toast.info("Notificações flutuantes desativadas");
        }
    };

    const handleToggleMuteActive = (val: boolean) => {
        setMuteActiveChat(val);
        setMuteActiveChatEnabled(val);
        if (val) {
            toast.success("Conversa aberta na tela será silenciada");
        } else {
            toast.info("Avisos sonoros ativos para todas as conversas");
        }
    };

    const { getSocket, joinSession } = useSocket();
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chatsRef = useRef<ChatContact[]>(chats);
    chatsRef.current = chats;
    const fetchingRef = useRef(false);

    const fetchChats = useCallback(async (cursor?: string, append = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            if (!cursor) setLoading(true);
            const rawChats: any = await getChatsStatus(sessionId, PAGE_SIZE, cursor || undefined, searchQuery || undefined);
            
            const processChats = (newChatsList: ChatContact[], existingChatsList: ChatContact[] = []) => {
                const result: ChatContact[] = [];

                const addOrMerge = (c: any) => {
                    if (!c?.jid) return;
                    const canonical = formatToBrazilPhoneJid(c.jid) || c.jid;
                    const existingIdx = result.findIndex(r => isSameChatJid(r.jid, c.jid));
                    const isCurrentlySelected = isSameChatJid(c.jid, selectedJidRef.current) || isSameChatJid(c.jid, getActiveOpenChatJid());

                    if (existingIdx === -1) {
                        result.push({
                            ...c,
                            jid: canonical,
                            unreadCount: isCurrentlySelected ? 0 : Number(c.unreadCount || 0)
                        });
                    } else {
                        const existing = result[existingIdx];
                        const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                        const newTs = c.lastMessage?.timestamp ? new Date(c.lastMessage.timestamp).getTime() : 0;
                        const chosenLastMsg = newTs >= existingTs ? c.lastMessage : existing.lastMessage;
                        const unread = isCurrentlySelected ? 0 : Number(c.unreadCount ?? (existing?.unreadCount ?? 0));

                        const attendance = c.attendance?.status === "IN_PROGRESS"
                            ? c.attendance
                            : (existing.attendance?.status === "IN_PROGRESS" ? existing.attendance : (c.attendance || existing.attendance));

                        result[existingIdx] = {
                            ...existing,
                            ...c,
                            jid: canonical,
                            name: c.name || existing.name,
                            notify: c.notify || existing.notify,
                            profilePic: c.profilePic || existing.profilePic,
                            lastMessage: chosenLastMsg,
                            unreadCount: unread,
                            attendance
                        };
                    }
                };

                (existingChatsList || []).forEach(addOrMerge);
                (newChatsList || []).forEach(addOrMerge);

                result.sort((a, b) => {
                    const tsA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
                    const tsB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
                    return tsB - tsA;
                });

                return result;
            };

            if (append) {
                setChats(prev => processChats(rawChats, prev));
            } else {
                setChats(processChats(rawChats));
            }
            setHasMore((rawChats || []).length >= PAGE_SIZE);
        } catch (error) {
            console.error("Failed to load chats", error);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [sessionId, searchQuery]);

    useEffect(() => { setChats([]); setHasMore(true); fetchChats(); }, [fetchChats]);

    // Socket message & attendance events
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);

        const handleIncomingMsg = (msg: any) => {
            if (!msg || msg.fromMe) return;
            const jid = msg.remoteJid;
            if (!jid || jid.includes("status@broadcast") || jid.includes("@newsletter")) return;

            // Strict deduplication by message ID: ensures each message is counted only once
            const msgKey = msg.keyId || msg.key?.id || msg.id || `${jid}_${msg.timestamp || ''}_${(msg.content || '').slice(0, 15)}`;
            const isDuplicate = processedMsgIdsRef.current.has(msgKey);
            if (!isDuplicate) {
                processedMsgIdsRef.current.add(msgKey);
                if (processedMsgIdsRef.current.size > 2000) {
                    const arr = Array.from(processedMsgIdsRef.current);
                    processedMsgIdsRef.current = new Set(arr.slice(arr.length - 1000));
                }
            }

            const isCurrentlyOpen = isSameChatJid(selectedJidRef.current, jid) || isSameChatJid(getActiveOpenChatJid(), jid);

            setChats(prev => {
                const canonicalJid = formatToBrazilPhoneJid(jid) || jid;
                const existingMatches = prev.filter(c => isSameChatJid(c.jid, jid));
                const remaining = prev.filter(c => !isSameChatJid(c.jid, jid));

                const firstExisting = existingMatches[0];
                let currentCount = firstExisting?.unreadCount || 0;
                if (isCurrentlyOpen) {
                    currentCount = 0;
                } else if (!isDuplicate) {
                    currentCount = currentCount + 1;
                }

                const attendance = firstExisting?.attendance || {
                    status: "WAITING",
                    assignedUserId: null,
                    assignedUserName: null,
                    departmentTag: null,
                    closedAt: null
                };

                const updatedChat: ChatContact = {
                    ...(firstExisting || {}),
                    jid: canonicalJid,
                    name: firstExisting?.name || msg.pushName || null,
                    notify: firstExisting?.notify || msg.pushName || null,
                    profilePic: firstExisting?.profilePic || null,
                    unreadCount: currentCount,
                    attendance,
                    lastMessage: { 
                        content: msg.content, 
                        timestamp: msg.timestamp || new Date().toISOString(), 
                        type: msg.type || "TEXT" 
                    }
                };

                return [updatedChat, ...remaining];
            });
        };

        const handler = async (newMessages: any[]) => {
            let hasIncoming = false;
            newMessages.forEach(msg => {
                if (!msg.fromMe) {
                    hasIncoming = true;
                    handleIncomingMsg(msg);
                }
            });

            if (!hasIncoming) {
                setChats(prev => {
                    const updated = [...prev];
                    newMessages.forEach(msg => {
                        const jid = msg.remoteJid;
                        const idx = updated.findIndex(c => isSameChatJid(c.jid, jid));
                        if (idx !== -1) {
                            updated[idx] = { 
                                ...updated[idx], 
                                lastMessage: { 
                                    content: msg.content, 
                                    timestamp: msg.timestamp, 
                                    type: msg.type,
                                    fromMe: msg.fromMe,
                                    keyId: msg.keyId,
                                    status: msg.status
                                } 
                            };
                        }
                    });
                    return updated;
                });
            }
        };

        const onIncomingEvent = (payload: any) => {
            if (payload?.message && !payload.message.fromMe) {
                handleIncomingMsg(payload.message);
            }
        };

        const onAttendanceUpdate = (payload: any) => {
            const targetJid = payload.jid;
            if (!targetJid) return;
            if (payload.action === "reject") {
                setChats(prev => prev.filter(c => !isSameChatJid(c.jid, targetJid)));
                return;
            }
            setChats(prev => {
                return prev.map(c => {
                    const isMatch = isSameChatJid(c.jid, targetJid);
                    if (isMatch) {
                        const newStatus = payload.status || payload.data?.status;

                        // CRITICAL PROTECTION: If chat is already IN_PROGRESS, NEVER downgrade to WAITING
                        // unless an attendant explicitly performed an action (action === "transfer" or "close" or "reject")
                        if (c.attendance?.status === "IN_PROGRESS" && newStatus === "WAITING" && payload.action !== "transfer" && payload.action !== "close") {
                            return c;
                        }

                        const finalStatus = newStatus || c.attendance?.status || "WAITING";
                        const newUserId = payload.data ? payload.data.assignedUserId : (finalStatus === "WAITING" ? null : c.attendance?.assignedUserId);
                        const newUserName = payload.data ? payload.data.assignedUserName : (finalStatus === "WAITING" ? null : c.attendance?.assignedUserName);
                        return {
                            ...c,
                            attendance: {
                                ...(c.attendance || {}),
                                status: finalStatus,
                                assignedUserId: newUserId,
                                assignedUserName: newUserName,
                                departmentTag: payload.data?.departmentTag ?? c.attendance?.departmentTag,
                                closedAt: finalStatus === "CLOSED" ? new Date().toISOString() : null
                            }
                        };
                    }
                    return c;
                });
            });
        };

        const onChatDeleted = (payload: any) => {
            const targetJid = payload?.jid;
            if (targetJid) {
                setChats(prev => prev.filter(c => !isSameChatJid(c.jid, targetJid)));
            }
        };

        const onStatusUpdate = (payload: { keyId: string; status: string }) => {
            if (!payload?.keyId) return;
            setChats(prev => prev.map(c => {
                if (c.lastMessage && (c.lastMessage as any).keyId === payload.keyId) {
                    return {
                        ...c,
                        lastMessage: {
                            ...c.lastMessage,
                            status: payload.status
                        }
                    };
                }
                return c;
            }));
        };

        socket.on("message.update", handler);
        socket.on("message.status", onStatusUpdate);
        socket.on("incoming.message", onIncomingEvent);
        socket.on("attendance.update", onAttendanceUpdate);
        socket.on("chat.deleted", onChatDeleted);

        return () => { 
            socket.off("connect", onConnect); 
            socket.off("message.update", handler); 
            socket.off("message.status", onStatusUpdate);
            socket.off("incoming.message", onIncomingEvent);
            socket.off("attendance.update", onAttendanceUpdate);
            socket.off("chat.deleted", onChatDeleted);
        };
    }, [sessionId, getSocket, joinSession, fetchChats]);

    // Fetch label assignments for all chats
    const fetchLabelAssignments = useCallback(async () => {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/labels/${sessionId}/chats`);
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (!data?.data || !Array.isArray(data.data)) return;
            const map = new Map<string, { id: string; name: string; colorHex: string }[]>();
            for (const cl of (data.data || [])) {
                const jid = cl.chatJid;
                if (!map.has(jid)) map.set(jid, []);
                map.get(jid)!.push({ id: cl.labelId, name: cl.labelName, colorHex: cl.colorHex });
            }
            setChatLabelMap(map);
        } catch (e) {
            console.error("Failed to load label assignments", e);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchLabelAssignments();
        const handler = () => fetchLabelAssignments();
        window.addEventListener("wa_labels_updated", handler);

        const handleContactUpdated = (e: any) => {
            const { jid: updatedJid, name: updatedName, profilePic: updatedPic } = e.detail || {};
            if (!updatedJid) return;
            setChats(prev => prev.map(c => {
                if (isSameChatJid(c.jid, updatedJid)) {
                    return {
                        ...c,
                        name: updatedName || c.name,
                        notify: updatedName || c.notify,
                        profilePic: updatedPic || c.profilePic
                    };
                }
                return c;
            }));
        };
        window.addEventListener("nexus:contact-updated", handleContactUpdated as EventListener);

        return () => {
            window.removeEventListener("wa_labels_updated", handler);
            window.removeEventListener("nexus:contact-updated", handleContactUpdated as EventListener);
        };
    }, [fetchLabelAssignments]);

    const getChatLabels = useCallback((targetJid: string) => {
        const direct = chatLabelMap.get(targetJid);
        if (direct && direct.length > 0) return direct;

        // Check Brazilian 9th digit variation
        const cleanDigits = targetJid.replace(/@.*$/, "").replace(/\D/g, "");
        if (cleanDigits.startsWith("55")) {
            let altJid = "";
            if (cleanDigits.length === 13 && cleanDigits[4] === "9") {
                altJid = `${cleanDigits.slice(0, 4)}${cleanDigits.slice(5)}@s.whatsapp.net`;
            } else if (cleanDigits.length === 12) {
                altJid = `${cleanDigits.slice(0, 4)}9${cleanDigits.slice(4)}@s.whatsapp.net`;
            }
            if (altJid && chatLabelMap.has(altJid)) {
                return chatLabelMap.get(altJid) || [];
            }
        }
        return direct || [];
    }, [chatLabelMap]);

    const isBroadcast = useCallback((jid: string) => {
        return jid.includes("status@broadcast") || jid.includes("@broadcast") || jid.includes("@newsletter");
    }, []);

    const isChatFinalized = useCallback((jid: string, att?: AttendanceInfo) => {
        if (att?.status === "IN_PROGRESS" || att?.status === "WAITING") return false;
        if (att?.status === "CLOSED") return true;
        const labels = getChatLabels(jid);
        return labels.some(l => l.name?.toLowerCase() === "finalizado");
    }, [getChatLabels]);

    // Counts for tabs
    const waitingCount = useMemo(() => {
        const seen = new Set<string>();
        return chats.filter(c => {
            if (isBroadcast(c.jid) || isChatFinalized(c.jid, c.attendance)) return false;
            if (c.attendance?.status !== "WAITING" && c.attendance?.status) return false;
            const canonical = formatToBrazilPhoneJid(c.jid) || c.jid;
            if (seen.has(canonical)) return false;
            seen.add(canonical);
            return true;
        }).length;
    }, [chats, isChatFinalized, isBroadcast]);

    const myCount = useMemo(() => {
        return chats.filter(c => 
            !isBroadcast(c.jid) &&
            !isChatFinalized(c.jid, c.attendance) && 
            c.attendance?.status === "IN_PROGRESS" && 
            c.attendance?.assignedUserId === currentUserId
        ).length;
    }, [chats, isChatFinalized, currentUserId, isBroadcast]);

    const allInProgressCount = useMemo(() => {
        return chats.filter(c => !isBroadcast(c.jid) && !isChatFinalized(c.jid, c.attendance) && c.attendance?.status === "IN_PROGRESS").length;
    }, [chats, isChatFinalized, isBroadcast]);

    const finalizedCount = useMemo(() => {
        return chats.filter(c => !isBroadcast(c.jid) && isChatFinalized(c.jid, c.attendance)).length;
    }, [chats, isChatFinalized, isBroadcast]);

    const handleAcceptChat = async (targetJid: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "accept", jid: targetJid })
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                toast.success("Atendimento aceito! Você agora é o atendente desta conversa.");
                setChats(prev => prev.map(c => {
                    if (isSameChatJid(c.jid, targetJid)) {
                        return {
                            ...c,
                            attendance: {
                                ...(c.attendance || {}),
                                status: "IN_PROGRESS",
                                assignedUserId: currentUserId || null,
                                assignedUserName: authSession?.user?.name || "Você"
                            }
                        };
                    }
                    return c;
                }));
                const acceptedAtt = {
                    status: "IN_PROGRESS" as const,
                    assignedUserId: currentUserId || null,
                    assignedUserName: authSession?.user?.name || "Você"
                };
                onSelectChat(targetJid, undefined, acceptedAtt);
                setActiveTab("meus");
            } else {
                toast.error(data.message || "Erro ao aceitar atendimento");
            }
        } catch {
            toast.error("Erro ao aceitar atendimento");
        }
    };

    const handleRejectChat = useCallback(async (targetJid: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Deseja realmente rejeitar e excluir esta conversa da fila de espera?")) return;
        try {
            const res = await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject", jid: targetJid, deleteChat: true })
            });
            if (res.ok) {
                toast.success("Conversa rejeitada e removida da fila de espera!");
                setChats(prev => prev.filter(c => !isSameChatJid(c.jid, targetJid)));
            } else {
                toast.error("Erro ao rejeitar conversa");
            }
        } catch {
            toast.error("Erro ao rejeitar conversa");
        }
    }, [sessionId]);

    const handleReopenChat = async (targetJid: string) => {
        try {
            await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reopen", jid: targetJid }),
            });

            const labels = chatLabelMap.get(targetJid) || [];
            const finLabel = labels.find(l => l.name.toLowerCase() === "finalizado");
            let targetLabelId = finLabel?.id;

            if (!targetLabelId) {
                const res = await fetch(`/api/labels/${sessionId}`);
                const data = await res.json().catch(() => null);
                const label = data?.data?.labels?.find((l: any) => l.name.toLowerCase() === "finalizado");
                targetLabelId = label?.id;
            }

            if (targetLabelId) {
                await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(targetJid)}/labels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ labelIds: [targetLabelId], action: "remove" }),
                });
            }

            toast.success("Atendimento reaberto com sucesso!");
            fetchLabelAssignments();
            fetchChats();
            window.dispatchEvent(new CustomEvent("wa_labels_updated", { detail: { jid: targetJid, action: "reopen" } }));
        } catch (e) {
            toast.error("Erro ao reabrir atendimento");
        }
    };

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setSearchQuery(val);
        }, 300);
    };

    // Filter chats based on tab and isolation security
    const filteredChats = useMemo(() => {
        let list = chats.filter(chat => {
            if (isBroadcast(chat.jid)) return false;
            const isFin = isChatFinalized(chat.jid, chat.attendance);
            
            if (activeTab === "finalizadas") {
                return isFin;
            }
            if (isFin) return false;

            if (activeTab === "espera") {
                // Chats waiting for an attendant
                return chat.attendance?.status === "WAITING" || !chat.attendance?.status;
            }

            if (activeTab === "meus") {
                // Active chats belonging to current attendant
                return chat.attendance?.status === "IN_PROGRESS" && chat.attendance?.assignedUserId === currentUserId;
            }

            if (activeTab === "todos") {
                // All in-progress chats (supervisor/admin view)
                return chat.attendance?.status === "IN_PROGRESS";
            }

            return false;
        });

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(chat => {
                const name = (chat.name || chat.notify || "").toLowerCase();
                const jid = chat.jid.toLowerCase();
                return name.includes(q) || jid.includes(q);
            });
        }

        // Deduplication guarantee: ensure no duplicate rows for the same phone/contact are rendered
        const deduped: ChatContact[] = [];
        for (const chat of list) {
            if (!deduped.some(d => isSameChatJid(d.jid, chat.jid))) {
                deduped.push(chat);
            }
        }
        return deduped;
    }, [chats, searchQuery, activeTab, isChatFinalized, currentUserId, isBroadcast]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading && !searchQuery.trim()) {
            const last = chatsRef.current[chatsRef.current.length - 1];
            const c = last?.lastMessage?.timestamp;
            if (c) fetchChats(c, true);
        }
    }, [hasMore, loading, searchQuery, fetchChats]);

    const handleSelectConversation = useCallback((targetJid: string, targetName?: string, targetAttendance?: any) => {
        setChats(prev => prev.map(c => isSameChatJid(c.jid, targetJid) ? { ...c, unreadCount: 0 } : c));
        onSelectChat(targetJid, targetName, targetAttendance);
        fetch(`/api/chat/${sessionId}/${encodeURIComponent(targetJid)}/read`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        }).catch(() => {});
    }, [sessionId, onSelectChat]);

    const itemContent = useCallback(
        (_: number, chat: ChatContact) => {
            const isFin = isChatFinalized(chat.jid, chat.attendance);
            return (
                <ChatRow 
                    key={chat.jid} 
                    chat={chat} 
                    isSelected={isSameChatJid(selectedJid, chat.jid)} 
                    onSelect={handleSelectConversation} 
                    sessionId={sessionId} 
                    labelDots={getChatLabels(chat.jid)}
                    isFinalized={isFin}
                    onReopen={handleReopenChat}
                    onAccept={handleAcceptChat}
                    onReject={handleRejectChat}
                    currentUserId={currentUserId}
                />
            );
        },
        [selectedJid, handleSelectConversation, sessionId, getChatLabels, isChatFinalized, currentUserId, handleRejectChat]
    );

    const handleStartNewChat = () => {
        if (!newChatNumber) return;
        const cleanJid = formatToBrazilPhoneJid(newChatNumber);
        if (!cleanJid || cleanJid === "@s.whatsapp.net") {
            toast.error("Por favor, insira um número válido com DDD");
            return;
        }
        onSelectChat(cleanJid);
        setIsNewChatOpen(false);
        setNewChatNumber("");
    };

    if (loading && chats.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 space-y-3">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* Header */}
            <div className="shrink-0 px-3.5 pt-3.5 pb-2.5 space-y-2.5 border-b border-border/40 bg-card/30 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground tracking-tight">
                            Conversas
                        </h3>
                        {chats.length > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {chats.length}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Botão Atualizar */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                fetchChats();
                                toast.success("Lista de conversas atualizada");
                            }}
                            disabled={loading}
                            className="h-8 w-8 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                            title="Atualizar conversas"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-primary")} />
                        </Button>

                        {/* Popover Som e Notificações */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                                    title="Configurações de som e notificações"
                                >
                                    {soundEnabled ? (
                                        <Volume2 className="h-4 w-4 text-primary" />
                                    ) : (
                                        <VolumeX className="h-4 w-4 text-muted-foreground/60" />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3.5 rounded-xl shadow-xl border bg-popover" align="end">
                                <div className="space-y-3.5">
                                    <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                        <Volume2 className="h-4 w-4 text-primary" />
                                        <span className="font-semibold text-xs text-foreground">Configurações de Notificação</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-medium cursor-pointer">Sons e Notificações</Label>
                                            <p className="text-[11px] text-muted-foreground leading-tight">Tocar aviso sonoro nas novas mensagens recebidas</p>
                                        </div>
                                        <Switch
                                            checked={soundEnabled}
                                            onCheckedChange={handleToggleSound}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-medium cursor-pointer">Notificações Flutuantes</Label>
                                            <p className="text-[11px] text-muted-foreground leading-tight">Exibir aviso flutuante na tela ao receber novas mensagens</p>
                                        </div>
                                        <Switch
                                            checked={floatingEnabled && soundEnabled}
                                            disabled={!soundEnabled}
                                            onCheckedChange={handleToggleFloating}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-xs font-medium cursor-pointer">Silenciar Janela Aberta</Label>
                                            <p className="text-[11px] text-muted-foreground leading-tight">Não notificar mensagens da conversa aberta no momento. Notifica apenas as demais conversas.</p>
                                        </div>
                                        <Switch
                                            checked={muteActiveChat}
                                            onCheckedChange={handleToggleMuteActive}
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                                "h-8 w-8 rounded-lg cursor-pointer transition-all",
                                isNewChatOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                            )}
                            title="Nova conversa"
                            onClick={() => setIsNewChatOpen(!isNewChatOpen)}
                        >
                            {isNewChatOpen ? <X className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* Multi-Attendant Segmented Tabs */}
                <div className={cn(
                    "grid p-1 bg-muted/60 rounded-xl gap-1 border border-border/40 text-xs shadow-2xs",
                    isSuperAdmin ? "grid-cols-4" : "grid-cols-3"
                )}>
                    {/* Tab: Em Espera */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("espera")}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs transition-all cursor-pointer relative min-w-0",
                            activeTab === "espera"
                                ? "bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium"
                        )}
                        title="Atendimentos aguardando operador"
                    >
                        <Clock className={cn("h-3.5 w-3.5 shrink-0", activeTab === "espera" ? "text-amber-500" : "text-muted-foreground/70")} />
                        <span className="truncate">Espera</span>
                        <span className={cn(
                            "px-1.5 py-0.2 rounded-full text-[10px] shrink-0 font-bold",
                            waitingCount > 0 
                                ? "bg-amber-500 text-white shadow-2xs animate-pulse" 
                                : activeTab === "espera" 
                                ? "bg-muted text-foreground" 
                                : "bg-muted/80 text-muted-foreground"
                        )}>
                            {waitingCount}
                        </span>
                    </button>

                    {/* Tab: Meus Atendimentos */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("meus")}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs transition-all cursor-pointer relative min-w-0",
                            activeTab === "meus"
                                ? "bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium"
                        )}
                        title="Conversas sob seu atendimento exclusivo"
                    >
                        <UserCheck className={cn("h-3.5 w-3.5 shrink-0", activeTab === "meus" ? "text-blue-500" : "text-muted-foreground/70")} />
                        <span className="truncate">Meus</span>
                        <span className={cn(
                            "px-1.5 py-0.2 rounded-full text-[10px] shrink-0 font-bold",
                            activeTab === "meus"
                                ? "bg-blue-600 text-white shadow-2xs"
                                : myCount > 0
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                : "bg-muted/80 text-muted-foreground"
                        )}>
                            {myCount}
                        </span>
                    </button>

                    {/* Tab: Todos em Atendimento (Superadmin only) */}
                    {isSuperAdmin && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("todos")}
                            className={cn(
                                "flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs transition-all cursor-pointer relative min-w-0",
                                activeTab === "todos"
                                    ? "bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium"
                            )}
                            title="Visão geral de todos os atendentes"
                        >
                            <Users className={cn("h-3.5 w-3.5 shrink-0", activeTab === "todos" ? "text-purple-500" : "text-muted-foreground/70")} />
                            <span className="truncate">Geral</span>
                            <span className={cn(
                                "px-1.5 py-0.2 rounded-full text-[10px] shrink-0 font-bold",
                                activeTab === "todos"
                                    ? "bg-purple-600 text-white shadow-2xs"
                                    : allInProgressCount > 0
                                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                    : "bg-muted/80 text-muted-foreground"
                            )}>
                                {allInProgressCount}
                            </span>
                        </button>
                    )}

                    {/* Tab: Finalizadas */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("finalizadas")}
                        className={cn(
                            "flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs transition-all cursor-pointer relative min-w-0",
                            activeTab === "finalizadas"
                                ? "bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/40 font-medium"
                        )}
                        title="Chamados concluídos"
                    >
                        <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", activeTab === "finalizadas" ? "text-emerald-500" : "text-muted-foreground/70")} />
                        <span className="truncate">Final</span>
                        <span className={cn(
                            "px-1.5 py-0.2 rounded-full text-[10px] shrink-0 font-bold",
                            activeTab === "finalizadas"
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : finalizedCount > 0
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted/80 text-muted-foreground"
                        )}>
                            {finalizedCount}
                        </span>
                    </button>
                </div>

                {/* Enhanced Search Input */}
                <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder={
                            activeTab === "espera" 
                                ? "Buscar conversas em espera..." 
                                : activeTab === "meus"
                                ? "Buscar nos meus atendimentos..."
                                : activeTab === "finalizadas"
                                ? "Buscar em finalizadas..."
                                : "Buscar em todos atendimentos..."
                        } 
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-8.5 pl-8 pr-8 text-xs bg-muted/40 border border-border/40 hover:border-border/80 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/10 rounded-xl transition-all" 
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput("");
                                handleSearchChange("");
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Limpar busca"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {isNewChatOpen && (
                    <div className="p-3 bg-muted/40 rounded-xl space-y-2.5 border border-border/60 animate-in fade-in zoom-in-95 duration-150">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Novo Número (com DDD)</Label>
                        <div className="flex gap-1.5">
                            <Input 
                                placeholder="Ex: (11) 98765-4321" 
                                value={newChatNumber}
                                onChange={(e) => setNewChatNumber(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStartNewChat()}
                                className="h-8 text-xs bg-background" 
                                autoFocus
                            />
                            <Button size="sm" className="h-8 px-3 cursor-pointer text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium" onClick={handleStartNewChat}>Iniciar</Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">O código do Brasil (+55) é adicionado automaticamente.</p>
                    </div>
                )}
            </div>

            {/* Chat list */}
            <div className="flex-1 min-h-0">
                {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
                        {searchQuery ? (
                            <div className="flex flex-col items-center">
                                <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border/50 flex items-center justify-center mb-3 shadow-xs">
                                    <SearchX className="h-7 w-7 text-muted-foreground/70" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    Nenhum resultado encontrado
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
                                    Não encontramos conversas para &quot;<span className="text-foreground font-medium">{searchQuery}</span>&quot;.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchInput("");
                                        handleSearchChange("");
                                    }}
                                    className="mt-4 h-8 px-3 text-xs rounded-xl gap-1.5"
                                >
                                    <X className="h-3 w-3" />
                                    Limpar busca
                                </Button>
                            </div>
                        ) : activeTab === "espera" ? (
                            <div className="flex flex-col items-center">
                                <div className="relative mb-3.5">
                                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-xs">
                                        <Inbox className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow-xs">
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    Fila de espera vazia!
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
                                    Excelente trabalho. No momento não há clientes aguardando atendimento.
                                </p>
                                {myCount > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActiveTab("meus")}
                                        className="mt-4 h-8 px-3.5 text-xs rounded-xl gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                                    >
                                        <UserCheck className="h-3.5 w-3.5" />
                                        Ver meus {myCount} atendimentos
                                    </Button>
                                )}
                            </div>
                        ) : activeTab === "meus" ? (
                            <div className="flex flex-col items-center">
                                <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3.5 shadow-xs">
                                    <UserCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    Nenhum atendimento atribuído
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
                                    Você não está atendendo nenhuma conversa no momento.
                                </p>
                                {waitingCount > 0 ? (
                                    <Button
                                        size="sm"
                                        onClick={() => setActiveTab("espera")}
                                        className="mt-4 h-8 px-3.5 text-xs rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-medium cursor-pointer"
                                    >
                                        <Clock className="h-3.5 w-3.5" />
                                        Atender fila ({waitingCount} em espera)
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsNewChatOpen(true)}
                                        className="mt-4 h-8 px-3.5 text-xs rounded-xl gap-1.5 cursor-pointer"
                                    >
                                        <MessageSquarePlus className="h-3.5 w-3.5" />
                                        Iniciar conversa
                                    </Button>
                                )}
                            </div>
                        ) : activeTab === "finalizadas" ? (
                            <div className="flex flex-col items-center">
                                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3.5 shadow-xs">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    Nenhuma conversa finalizada
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
                                    As conversas encerradas aparecerão aqui para histórico ou reabertura.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3.5 shadow-xs">
                                    <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">
                                    Nenhum atendimento ativo
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
                                    Não há conversas em andamento entre os atendentes neste momento.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <Virtuoso style={{ height: "100%" }} data={filteredChats}
                        computeItemKey={(_: number, chat: ChatContact) => chat.jid} itemContent={itemContent}
                        endReached={handleEndReached} increaseViewportBy={200}
                        components={{ Footer: () => hasMore && !loading ? (
                            <div className="py-4 text-center">
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Scroll para mais</span>
                            </div>
                        ) : null }} />
                )}
            </div>
        </div>
    );
}
