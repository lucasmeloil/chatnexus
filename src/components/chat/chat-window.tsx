"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, ArrowLeft, FileText, Image as ImageIcon, Music, Video, Download, ArrowDown, CornerUpLeft, Copy, Trash2, Info, X, UserCheck, Edit2, Pencil, Mic, Square, Loader2, CheckCircle2, ArrowRightLeft, Zap, Tag, Sparkles, RotateCcw, Lock, Clock, ShieldAlert, Check, CheckCheck, Maximize2, ExternalLink, ZoomIn, ZoomOut, UserPlus, Ban, AlertTriangle } from "lucide-react";
import { ContactInfoDialog, formatPhoneNumberDisplay } from "./contact-info-dialog";
import { useSession } from "next-auth/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getChatMessages, sendChatMessage, sendMediaMessage } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { setActiveOpenChatJid, getActiveOpenChatJid } from "@/lib/notification-sound";
import { isSameChatJid } from "@/lib/jid-utils";
import { EmojiPicker } from "./emoji-picker";
import { VoiceStudioDialog } from "./voice-studio-dialog";
import { VoiceProfile, VOICE_PROFILES } from "@/lib/voice-profiles";

interface Message {
    id: string;
    keyId: string;
    content: string;
    fromMe: boolean;
    timestamp: string;
    type: string;
    status: string;
    pushName?: string;
    mediaUrl?: string;
    remoteJid?: string;
    quoteId?: string | null;
    isDeleted?: boolean;
    quoted?: {
        keyId: string;
        content: string | null;
        fromMe: boolean;
        senderJid: string | null;
        pushName: string | null;
    } | null;
}

export function MessageStatusIcon({ status, fromMe, className }: { status?: string; fromMe: boolean; className?: string }) {
    if (!fromMe) return null;

    const s = (status || "").toUpperCase();

    if (s === "READ") {
        return (
            <span title="Lida" className="inline-flex items-center">
                <CheckCheck className={cn("h-3.5 w-3.5 text-[#53bdeb] shrink-0 stroke-[2.3]", className)} />
            </span>
        );
    }

    if (s === "DELIVERED") {
        return (
            <span title="Entregue" className="inline-flex items-center">
                <CheckCheck className={cn("h-3.5 w-3.5 text-primary-foreground/70 dark:text-muted-foreground/80 shrink-0 stroke-[2.3]", className)} />
            </span>
        );
    }

    if (s === "SENT") {
        return (
            <span title="Enviada" className="inline-flex items-center">
                <Check className={cn("h-3.5 w-3.5 text-primary-foreground/70 dark:text-muted-foreground/80 shrink-0 stroke-[2.3]", className)} />
            </span>
        );
    }

    if (s === "FAILED") {
        return (
            <span title="Erro no envio" className="inline-flex items-center">
                <ShieldAlert className={cn("h-3 w-3 text-red-400 shrink-0", className)} />
            </span>
        );
    }

    // PENDING or default
    return (
        <span title="Pendente" className="inline-flex items-center">
            <Clock className={cn("h-2.5 w-2.5 text-primary-foreground/60 dark:text-muted-foreground/60 shrink-0", className)} />
        </span>
    );
}

interface ChatWindowProps {
    sessionId: string;
    jid: string;
    name?: string;
    initialAttendance?: {
        id?: string;
        status: "WAITING" | "IN_PROGRESS" | "CLOSED";
        assignedUserId: string | null;
        assignedUserName: string | null;
        departmentTag?: string | null;
    } | null;
    onBack?: () => void;
}

const PAGE_LIMIT = 50;

// ─── Lazy media with preview support ────────
function LazyMedia({ src, alt, onClick }: { src: string; alt: string; onClick?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className={cn("mb-1.5 overflow-hidden rounded-xl relative select-none", onClick && "cursor-pointer group/media-thumb")} onClick={onClick}>
            {visible ? (
                <>
                    <img 
                        src={src} 
                        alt={alt} 
                        className={`max-w-full max-h-60 object-cover rounded-xl transition-all duration-200 ${loaded ? 'opacity-100 hover:scale-[1.01]' : 'opacity-0'}`} 
                        onLoad={() => setLoaded(true)} 
                        loading="lazy" 
                    />
                    {onClick && (
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/media-thumb:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                            <span className="bg-black/70 text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                                <Maximize2 className="h-3 w-3" /> Clique para ampliar
                            </span>
                        </div>
                    )}
                </>
            ) : <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />}
        </div>
    );
}
function LazyVideo({ src, onClick }: { src: string; onClick?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="mb-1.5 overflow-hidden rounded-xl">
            {visible ? <video src={src} controls className="max-w-full max-h-60 rounded-xl" preload="none" />
                : <div className="h-32 bg-muted/30 rounded-xl animate-pulse flex items-center justify-center"><Video className="h-6 w-6 text-muted-foreground/50" /></div>}
        </div>
    );
}

function useDateLabel() {
    return useCallback((d: any) => {
        if (!d) return "";
        const dateObj = d instanceof Date ? d : new Date(typeof d === "number" && d < 1e12 ? d * 1000 : d);
        if (isNaN(dateObj.getTime())) return "";
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateObj.toDateString() === today.toDateString()) return "Hoje";
        if (dateObj.toDateString() === yesterday.toDateString()) return "Ontem";
        return dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }, []);
}

function renderFormattedContent(content: string) {
    if (!content) return null;
    const parts = content.split(/(\*[^*\n]+\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
                <strong key={index} className="font-bold underline-offset-1">
                    {part.slice(1, -1)}
                </strong>
            );
        }
        return part;
    });
}

function handleDownload(url: string, fileName: string) {
    toast.info("Baixando...");
    fetch(url).then(res => { if (!res.ok) throw new Error(); return res.blob(); }).then(blob => {
        const dlUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = dlUrl; link.download = fileName;
        document.body.appendChild(link);
        link.click(); link.remove();
        window.URL.revokeObjectURL(dlUrl);
    }).catch(() => toast.error("Falha no download!"));
}

// ─── Context Menu ──────────────────
interface ContextMenuState {
    x: number;
    y: number;
    msg: Message;
}
function ContextMenu({ state, onClose, onReply, onDelete, onEdit }: { state: ContextMenuState; onClose: () => void; onReply: (msg: Message) => void; onDelete: (msg: Message) => void; onEdit?: (msg: Message) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const items = [
        { label: "Responder", icon: CornerUpLeft, action: () => { onReply(state.msg); onClose(); } },
        ...(state.msg.fromMe && state.msg.type === 'TEXT' && !state.msg.isDeleted && onEdit ? [
            { label: "Editar", icon: Pencil, action: () => { onEdit(state.msg); onClose(); } }
        ] : []),
        { label: "Copiar", icon: Copy, action: () => { navigator.clipboard.writeText(state.msg.content || "").then(() => toast.success("Copiado!")).catch(() => { }); onClose(); } },
        { label: "Excluir", icon: Trash2, action: () => { onDelete(state.msg); onClose(); }, dangerous: true },
        { label: "Informações", icon: Info, action: () => { toast.info(`ID: ${state.msg.keyId}\nStatus: ${state.msg.status}\nHora: ${new Date(state.msg.timestamp).toLocaleString()}`); onClose(); } },
    ];

    // Adjust position to not overflow viewport
    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 200) style.top = state.y - 180;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer",
                    (item as any).dangerous ? "text-red-500 hover:bg-red-500/10" : "text-foreground hover:bg-muted"
                )}>
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main Component ─────────────────
export function ChatWindow({ sessionId, jid, name, initialAttendance, onBack }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [uploadType, setUploadType] = useState<string>("image");
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [newMsgBadge, setNewMsgBadge] = useState(false);

    // Delete confirmation
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);

    // Edit message state
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editText, setEditText] = useState<string>("");
    const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // Media lightbox / modal preview state
    const [previewMedia, setPreviewMedia] = useState<{
        url: string;
        type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
        name?: string;
    } | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(1);

    // Operator signature state
    const { data: authSession } = useSession();
    const [signOperator, setSignOperator] = useState<boolean>(true);
    const [operatorName, setOperatorName] = useState<string>("");
    const [isEditingOperator, setIsEditingOperator] = useState<boolean>(false);
    const [customOperatorInput, setCustomOperatorInput] = useState<string>("");

    // Voice recording state
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingDuration, setRecordingDuration] = useState<number>(0);
    const [isSendingAudio, setIsSendingAudio] = useState<boolean>(false);
    const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>("broadcast");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    // Load saved SteelSeries Sonar voice profile from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("nexus_voice_profile") as VoiceProfile;
            if (saved && ["broadcast", "clarity", "warm", "denoise", "natural"].includes(saved)) {
                setVoiceProfile(saved);
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Cancel recording if switching chats or unmounting
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.onstop = null;
                mediaRecorderRef.current.stop();
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
            }
        };
    }, [jid]);

    useEffect(() => {
        const savedSign = localStorage.getItem("wa_sign_operator");
        if (savedSign !== null) {
            setSignOperator(savedSign === "true");
        }
        const savedName = localStorage.getItem("wa_operator_name");
        if (savedName) {
            setOperatorName(savedName);
        } else if (authSession?.user?.name) {
            setOperatorName(authSession.user.name);
        }
    }, [authSession?.user?.name]);

    // Quick Replies state
    const [quickReplies, setQuickReplies] = useState<any[]>([]);
    const [quickReplyFilter, setQuickReplyFilter] = useState<string>("");
    const [showQuickRepliesPopup, setShowQuickRepliesPopup] = useState<boolean>(false);
    const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState<number>(0);

    // Attendance & Multi-attendant isolation state
    const [attendance, setAttendance] = useState<{
        id?: string;
        status: "WAITING" | "IN_PROGRESS" | "CLOSED";
        assignedUserId: string | null;
        assignedUserName: string | null;
        departmentTag?: string | null;
    } | null>(initialAttendance || null);

    // Sync initialAttendance when prop changes
    useEffect(() => {
        if (initialAttendance) {
            setAttendance(initialAttendance);
            if (initialAttendance.status === "CLOSED") {
                setIsChatFinalized(true);
            } else if (initialAttendance.status === "IN_PROGRESS" || initialAttendance.status === "WAITING") {
                setIsChatFinalized(false);
            }
        }
    }, [initialAttendance]);

    // Contact Profile Picture & Details Card State
    const [headerProfilePic, setHeaderProfilePic] = useState<string | null>(null);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
    const [contactLabels, setContactLabels] = useState<Array<{ id: string; name: string; colorHex: string }>>([]);

    useEffect(() => {
        if (!sessionId || !jid) return;
        setHeaderProfilePic(null);
        let active = true;

        fetch(`/api/chat/${sessionId}/${encodeURIComponent(jid)}/profile-picture`)
            .then(async res => {
                if (!res.ok) return null;
                return res.json().catch(() => null);
            })
            .then(data => {
                if (active && data?.profilePicUrl) {
                    setHeaderProfilePic(data.profilePicUrl);
                    window.dispatchEvent(new CustomEvent("nexus:contact-updated", {
                        detail: { jid, profilePic: data.profilePicUrl }
                    }));
                }
            })
            .catch(() => {});

        fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`)
            .then(async res => {
                if (!res.ok) return null;
                return res.json().catch(() => null);
            })
            .then(data => {
                if (active && data?.status && Array.isArray(data.data)) {
                    setContactLabels(data.data.map((l: any) => ({
                        id: l.labelId,
                        name: l.labelName,
                        colorHex: l.colorHex
                    })));
                }
            })
            .catch(() => {});

        return () => {
            active = false;
        };
    }, [sessionId, jid]);

    const currentUserId = authSession?.user?.id;
    const currentUserRole = (authSession?.user as any)?.role;
    const isSuperAdmin = currentUserRole === "SUPERADMIN" || authSession?.user?.email?.toLowerCase() === "lucasmeloil@pm.me";

    // Privacy security rule: if another attendant accepted this chat, regular attendants cannot view or type!
    const isLockedForMe = Boolean(
        attendance &&
        attendance.status === "IN_PROGRESS" &&
        attendance.assignedUserId &&
        attendance.assignedUserId !== currentUserId &&
        !isSuperAdmin
    );

    // Finalizar Atendimento state
    const [isFinishDialogOpen, setIsFinishDialogOpen] = useState<boolean>(false);
    const [sendClosingMessage, setSendClosingMessage] = useState<boolean>(true);
    const [closingMessageText, setClosingMessageText] = useState<string>("Atendimento finalizado com sucesso! A NEXUS SOFT TECH RESOLUÇÕA DO CHAMDO: '  ' . Se precisar de suporte, estaremos sempre à disposição.");
    const [isFinishing, setIsFinishing] = useState<boolean>(false);
    const [isChatFinalized, setIsChatFinalized] = useState<boolean>(initialAttendance?.status === "CLOSED");
    const [finalizedLabelId, setFinalizedLabelId] = useState<string | null>(null);

    // Transferir Atendimento state
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState<boolean>(false);
    const [availableAttendants, setAvailableAttendants] = useState<any[]>([]);
    const [selectedAttendant, setSelectedAttendant] = useState<string>("QUEUE");
    const [selectedDepartmentTag, setSelectedDepartmentTag] = useState<"Comercial" | "Financeiro" | "Pessoal" | "Suporte">("Comercial");
    const [notifyCustomer, setNotifyCustomer] = useState<boolean>(true);
    const [transferCustomerNote, setTransferCustomerNote] = useState<string>("Seu atendimento foi direcionado ao setor Comercial. Um momento, por favor!");
    const [isTransferring, setIsTransferring] = useState<boolean>(false);

    // Check attendance and labels for this chat
    const checkChatStatus = useCallback(async () => {
        if (!sessionId || !jid) return;
        try {
            const [labelsRes, attRes] = await Promise.all([
                fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`),
                fetch(`/api/attendance/${sessionId}`)
            ]);

            let hasFinLabel = false;
            if (labelsRes.ok) {
                const data = await labelsRes.json().catch(() => null);
                const list = data?.data || [];
                const fin = list.find((l: any) => l.labelName?.toLowerCase() === "finalizado");
                hasFinLabel = !!fin;
                setFinalizedLabelId(fin?.labelId || null);
            }

            if (attRes.ok) {
                const data = await attRes.json().catch(() => null);
                const attendances = data?.data?.attendances || [];
                const found = attendances.find((a: any) => isSameChatJid(a.chatJid, jid));
                if (found) {
                    setAttendance(found);
                    if (found.status === "CLOSED") {
                        setIsChatFinalized(true);
                    } else {
                        // IN_PROGRESS or WAITING is NEVER finalized
                        setIsChatFinalized(false);
                    }
                } else if (!initialAttendance) {
                    setAttendance({
                        status: "WAITING",
                        assignedUserId: null,
                        assignedUserName: null
                    });
                    setIsChatFinalized(hasFinLabel);
                }
            }
        } catch (e) {
            console.error("Failed to check chat status", e);
        }
    }, [sessionId, jid, initialAttendance]);

    useEffect(() => {
        checkChatStatus();
        const handler = (e: any) => {
            if (e.detail?.jid && isSameChatJid(e.detail.jid, jid)) {
                checkChatStatus();
            }
        };
        window.addEventListener("wa_labels_updated", handler);
        return () => window.removeEventListener("wa_labels_updated", handler);
    }, [checkChatStatus, jid]);

    // Register this chat as the active open conversation
    useEffect(() => {
        setActiveOpenChatJid(jid);
        return () => {
            if (isSameChatJid(getActiveOpenChatJid(), jid)) {
                setActiveOpenChatJid(null);
            }
        };
    }, [jid]);

    // Socket real-time attendance update
    const { getSocket, joinSession } = useSocket();
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const handler = (payload: any) => {
            const targetJid = payload.jid;
            if (!targetJid) return;
            if (isSameChatJid(jid, targetJid)) {
                const newStatus = payload.status || payload.data?.status;

                // CRITICAL PROTECTION: An in-progress chat must NEVER be downgraded to WAITING
                // unless an attendant explicitly performed an action (action === "transfer" or "close")
                setAttendance(prev => {
                    if (prev?.status === "IN_PROGRESS" && newStatus === "WAITING" && payload.action !== "transfer" && payload.action !== "close") {
                        return prev;
                    }
                    const finalStatus = newStatus || prev?.status || "WAITING";
                    return {
                        status: finalStatus,
                        assignedUserId: payload.data ? payload.data.assignedUserId : (finalStatus === "WAITING" ? null : prev?.assignedUserId || null),
                        assignedUserName: payload.data ? payload.data.assignedUserName : (finalStatus === "WAITING" ? null : prev?.assignedUserName || null),
                        departmentTag: payload.data?.departmentTag ?? prev?.departmentTag
                    };
                });

                if (newStatus === "CLOSED") {
                    setIsChatFinalized(true);
                } else if (newStatus === "WAITING" || newStatus === "IN_PROGRESS") {
                    setIsChatFinalized(false);
                }
            }
        };
        socket.on("attendance.update", handler);
        return () => { socket.off("attendance.update", handler); };
    }, [sessionId, jid, getSocket]);

    // Accept attendance handler
    const handleAcceptAttendance = async () => {
        try {
            const res = await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "accept", jid })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Atendimento aceito! Você agora é o atendente exclusivo desta conversa.");
                setAttendance({
                    status: "IN_PROGRESS",
                    assignedUserId: currentUserId || null,
                    assignedUserName: authSession?.user?.name || "Você"
                });
                setIsChatFinalized(false);
                window.dispatchEvent(new CustomEvent("wa_labels_updated", { detail: { jid, action: "accept" } }));
            } else {
                toast.error(data.message || "Falha ao aceitar atendimento");
            }
        } catch {
            toast.error("Falha ao aceitar atendimento");
        }
    };

    // Reopen attendance
    const handleReopenAttendance = async () => {
        try {
            setIsFinishing(true);
            await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reopen", jid })
            });

            let targetLabelId = finalizedLabelId;
            if (!targetLabelId) {
                const res = await fetch(`/api/labels/${sessionId}`);
                const data = await res.json();
                const label = data.data?.labels?.find((l: any) => l.name.toLowerCase() === "finalizado");
                targetLabelId = label?.id;
            }

            if (targetLabelId) {
                await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ labelIds: [targetLabelId], action: "remove" }),
                });
            }

            setIsChatFinalized(false);
            setFinalizedLabelId(null);
            setAttendance({
                status: "IN_PROGRESS",
                assignedUserId: currentUserId || null,
                assignedUserName: authSession?.user?.name || "Você"
            });
            toast.success("Atendimento reaberto com sucesso!");
            window.dispatchEvent(new CustomEvent("wa_labels_updated", { detail: { jid, action: "reopen" } }));
        } catch (err: any) {
            toast.error("Falha ao reabrir atendimento");
        } finally {
            setIsFinishing(false);
        }
    };

    // Load available attendants for transfer
    useEffect(() => {
        if (isTransferDialogOpen && sessionId) {
            fetch(`/api/sessions/${sessionId}/attendants`)
                .then(async res => {
                    if (!res.ok) return null;
                    return res.json().catch(() => null);
                })
                .then(data => {
                    const list = data?.data || [];
                    setAvailableAttendants(list);
                    if (list.length > 0 && selectedAttendant === "QUEUE") {
                        const other = list.find((a: any) => a.userId !== currentUserId) || list[0];
                        if (other) setSelectedAttendant(other.userId);
                    }
                })
                .catch(() => { });
        }
    }, [isTransferDialogOpen, sessionId, currentUserId, selectedAttendant]);

    // Update default transfer note when department tag changes
    useEffect(() => {
        setTransferCustomerNote(`Seu atendimento foi direcionado ao setor ${selectedDepartmentTag}. Um momento, por favor!`);
    }, [selectedDepartmentTag]);

    // Load quick replies
    useEffect(() => {
        fetch("/api/quick-replies")
            .then(async res => {
                if (!res.ok) return null;
                return res.json().catch(() => null);
            })
            .then(data => {
                if (data?.success) setQuickReplies(data.data || []);
            })
            .catch(() => { });
    }, []);

    // Helper: Assign label to current chat
    const assignLabelToChat = async (labelName: string, colorHex: string = "#3b82f6") => {
        try {
            const res = await fetch(`/api/labels/${sessionId}`);
            const data = await res.json().catch(() => null);
            let label = data?.data?.labels?.find((l: any) => l.name.toLowerCase() === labelName.toLowerCase());

            if (!label) {
                const createRes = await fetch(`/api/labels/${sessionId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: labelName, color: 0, colorHex }),
                });
                const createData = await createRes.json().catch(() => null);
                label = createData?.data?.label || createData?.data;
            }

            if (label?.id) {
                await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ labelIds: [label.id], action: "add" }),
                });
            }
        } catch (err) {
            console.error("Error assigning label:", err);
        }
    };

    // Filter quick replies based on shortcut or query
    const filteredQuickReplies = quickReplies.filter(r => {
        if (!quickReplyFilter) return true;
        const q = quickReplyFilter.toLowerCase();
        return (
            r.shortcut.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.content.toLowerCase().includes(q)
        );
    });

    const applyQuickReply = (reply: any) => {
        if (!reply) return;
        const cursorPos = inputRef.current?.selectionStart || input.length;
        const textBeforeCursor = input.slice(0, cursorPos);
        const textAfterCursor = input.slice(cursorPos);
        const newBefore = textBeforeCursor.replace(/(^|\s)\/([a-zA-Z0-9_\/]*)$/, `$1${reply.content} `);
        const finalVal = newBefore === textBeforeCursor ? (input ? `${input}\n${reply.content}` : reply.content) : (newBefore + textAfterCursor);
        setInput(finalVal);
        setShowQuickRepliesPopup(false);
        setQuickReplyFilter("");
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
            }
        }, 50);
    };

    const handleFinishAttendance = async () => {
        try {
            setIsFinishing(true);
            if (sendClosingMessage && closingMessageText.trim()) {
                const activeName = (operatorName || authSession?.user?.name || "").trim();
                let msgContent = closingMessageText.trim();
                if (signOperator && activeName) {
                    msgContent = `*${activeName}*\n${msgContent}`;
                }
                await sendChatMessage(sessionId, jid, msgContent);
                setTimeout(() => fetchMessages(), 600);
            }

            // Call attendance close endpoint
            await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "close", jid })
            });

            await assignLabelToChat("Finalizado", "#10b981");
            setIsChatFinalized(true);
            setAttendance(prev => ({
                status: "CLOSED",
                assignedUserId: null,
                assignedUserName: null,
                departmentTag: prev?.departmentTag
            }));
            toast.success("Atendimento finalizado com sucesso!");
            window.dispatchEvent(new CustomEvent("wa_labels_updated", { detail: { jid, action: "finalize" } }));
            setIsFinishDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Falha ao finalizar atendimento");
        } finally {
            setIsFinishing(false);
        }
    };

    const handleTransferAttendance = async () => {
        try {
            setIsTransferring(true);
            const isQueue = selectedAttendant === "QUEUE" || !selectedAttendant;
            const targetUser = availableAttendants.find(a => a.userId === selectedAttendant);
            const targetName = isQueue ? null : (targetUser?.name || "outro atendente");

            // Call attendance transfer action
            await fetch(`/api/attendance/${sessionId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "transfer",
                    jid,
                    targetUserId: isQueue ? null : selectedAttendant,
                    targetUserName: targetName,
                    departmentTag: selectedDepartmentTag
                })
            });

            const tagColors: Record<string, string> = {
                "Comercial": "#3b82f6",
                "Financeiro": "#f59e0b",
                "Pessoal": "#8b5cf6",
                "Suporte": "#10b981"
            };
            await assignLabelToChat(selectedDepartmentTag, tagColors[selectedDepartmentTag] || "#3b82f6");

            if (notifyCustomer && transferCustomerNote.trim()) {
                const activeName = (operatorName || authSession?.user?.name || "").trim();
                let msgContent = transferCustomerNote.trim();
                if (signOperator && activeName) {
                    msgContent = `*${activeName}*\n${msgContent}`;
                }
                await sendChatMessage(sessionId, jid, msgContent);
                setTimeout(() => fetchMessages(), 600);
            }

            if (isQueue) {
                toast.success("Atendimento devolvido para a Fila de Espera!");
                setAttendance({
                    status: "WAITING",
                    assignedUserId: null,
                    assignedUserName: null,
                    departmentTag: selectedDepartmentTag
                });
            } else {
                toast.success(`Atendimento transferido para ${targetName} [${selectedDepartmentTag}]!`);
                setAttendance({
                    status: "IN_PROGRESS",
                    assignedUserId: selectedAttendant,
                    assignedUserName: targetName,
                    departmentTag: selectedDepartmentTag
                });
            }

            window.dispatchEvent(new CustomEvent("wa_labels_updated", { detail: { jid, action: "transfer" } }));
            setIsTransferDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Falha ao transferir atendimento");
        } finally {
            setIsTransferring(false);
        }
    };

    const getDateLabel = useDateLabel();

    const scrollToBottom = useCallback((smooth = true) => {
        bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    }, []);

    const fetchMessages = useCallback(async (before?: string) => {
        try {
            if (!before) setLoading(true);
            else setLoadingMore(true);
            const data: any = await getChatMessages(sessionId, jid, PAGE_LIMIT, before);
            if (!before) { setMessages(data.messages || []); setAutoScroll(true); }
            else if (data.messages?.length > 0) setMessages(prev => [...(data.messages || []), ...prev]);
            setHasMore(data.hasMore);
            if (data.messages?.length > 0) setOldestTimestamp(data.messages[0].timestamp);
        } catch (e) { console.error("Failed to load messages", e); }
        finally { setLoading(false); setLoadingMore(false); }
    }, [sessionId, jid]);

    useEffect(() => { setMessages([]); setOldestTimestamp(null); setHasMore(false); fetchMessages(); }, [fetchMessages]);

    // Auto focus input when chat changes and finished loading
    useEffect(() => {
        if (!loading && inputRef.current) {
            // A tiny delay ensures React has fully flushed the DOM for the new chat
            setTimeout(() => {
                inputRef.current?.focus();
            }, 10);
        }
    }, [jid, loading]);

    // Socket real-time
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const normalizedJid = jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid;
        const handler = (newMessages?: Message[]) => {
            if (!newMessages || !Array.isArray(newMessages)) {
                getChatMessages(sessionId, jid, PAGE_LIMIT).then((data: any) => {
                    if (data?.messages?.length > 0) {
                        setMessages(prev => {
                            const combined = [...prev, ...data.messages];
                            const unique = Array.from(new Map(combined.map((m: any) => [m.keyId, m])).values());
                            return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        });
                        setHasMore(data.hasMore);
                    }
                }).catch(() => {});
                return;
            }
            setMessages(prev => {
                const relevant = newMessages.filter(m => 
                    isSameChatJid(m.remoteJid, jid) || 
                    isSameChatJid(m.remoteJid, normalizedJid) || 
                    prev.some(p => isSameChatJid(p.remoteJid, m.remoteJid))
                );
                if (relevant.length === 0) return prev;
                const combined = [...prev, ...relevant];
                const unique = Array.from(new Map(combined.map(m => [m.keyId, m])).values());
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });
        };
        socket.on("message.update", handler);

        // Real-time WhatsApp message status updates (e.g. read receipts turning blue)
        const statusHandler = (payload: { keyId: string; remoteJid?: string; status: string }) => {
            if (!payload?.keyId) return;
            setMessages(prev => {
                let changed = false;
                const next = prev.map(m => {
                    if (m.keyId === payload.keyId && m.status !== payload.status) {
                        changed = true;
                        return { ...m, status: payload.status };
                    }
                    return m;
                });
                return changed ? next : prev;
            });
        };
        socket.on("message.status", statusHandler);

        // Real-time "deleted for everyone" flag (content/media preserved)
        const deletedHandler = (payload: { keyId: string; remoteJid?: string }) => {
            if (!payload?.keyId) return;
            setMessages(prev => {
                if (!prev.some(m => m.keyId === payload.keyId && !m.isDeleted)) return prev;
                return prev.map(m => m.keyId === payload.keyId ? { ...m, isDeleted: true } : m);
            });
        };
        socket.on("message.deleted", deletedHandler);

        // Real-time "edited message" update (corrigir texto)
        const editedHandler = (payload: { keyId: string; remoteJid?: string; newContent: string }) => {
            if (!payload?.keyId || typeof payload.newContent !== "string") return;
            setMessages(prev => prev.map(m => m.keyId === payload.keyId ? { ...m, content: payload.newContent } : m));
        };
        socket.on("message.edited", editedHandler);

        return () => { 
            socket.off("connect", onConnect); 
            socket.off("message.update", handler); 
            socket.off("message.status", statusHandler);
            socket.off("message.deleted", deletedHandler);
            socket.off("message.edited", editedHandler);
        };
    }, [sessionId, jid, getSocket, joinSession]);

    useEffect(() => { if (autoScroll) scrollToBottom(false); }, [messages, autoScroll, scrollToBottom]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(atBottom);
        if (atBottom) setNewMsgBadge(false);

        // Ao rolar para cima, carrega mensagens anteriores salvas no banco
        if (el.scrollTop < 100 && hasMore && !loadingMore && oldestTimestamp) {
            const prevHeight = el.scrollHeight;
            fetchMessages(oldestTimestamp).then(() => {
                requestAnimationFrame(() => { 
                    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight; 
                });
            });
        }
    }, [hasMore, loadingMore, oldestTimestamp, fetchMessages]);

    const handleSend = async () => {
        if (isChatFinalized) {
            toast.warning("Este atendimento está finalizado. Reabra o atendimento para enviar mensagens.");
            return;
        }
        if (!input.trim()) return;
        const activeName = (operatorName || authSession?.user?.name || "").trim();
        let messageToSend = input.trim();
        if (signOperator && activeName) {
            messageToSend = `*${activeName}*\n${messageToSend}`;
        }
        try {
            await sendChatMessage(sessionId, jid, messageToSend, replyingTo?.keyId);
            setInput("");
            setReplyingTo(null);
            setTimeout(() => fetchMessages(), 800);
        } catch (e: any) { toast.error(e.message || "Falha ao enviar mensagem"); }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";

        const cursorPos = e.target.selectionStart || val.length;
        const textBeforeCursor = val.slice(0, cursorPos);
        const match = textBeforeCursor.match(/(^|\s)\/([a-zA-Z0-9_\/]*)$/);

        if (match) {
            setQuickReplyFilter(match[2]);
            setShowQuickRepliesPopup(true);
            setSelectedQuickReplyIndex(0);
        } else {
            setShowQuickRepliesPopup(false);
        }
    };

    const handleInsertEmoji = (emoji: string) => {
        if (!inputRef.current) {
            setInput(prev => prev + emoji);
            return;
        }
        const textarea = inputRef.current;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const newText = input.substring(0, start) + emoji + input.substring(end);
        setInput(newText);
        requestAnimationFrame(() => {
            textarea.focus();
            const newPos = start + emoji.length;
            textarea.setSelectionRange(newPos, newPos);
            textarea.style.height = "auto";
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showQuickRepliesPopup && filteredQuickReplies.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedQuickReplyIndex(prev => (prev + 1) % filteredQuickReplies.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedQuickReplyIndex(prev => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyQuickReply(filteredQuickReplies[selectedQuickReplyIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setShowQuickRepliesPopup(false);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Salvar edição de mensagem
    const handleSaveEdit = async (mode?: 'resend_correction') => {
        if (!editingMessage || !editText.trim()) return;
        const newText = editText.trim();
        if (!mode && newText === editingMessage.content) {
            setEditingMessage(null);
            return;
        }

        try {
            setIsSubmittingEdit(true);
            const targetKeyId = editingMessage.keyId;

            const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(jid)}/${targetKeyId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    text: newText,
                    mode 
                })
            });

            const data = await res.json();
            if (res.ok && data.status) {
                if (data.mode === 'resend_correction') {
                    toast.success("Mensagem de correção enviada citando a anterior!");
                } else {
                    setMessages(prev => prev.map(m => m.keyId === targetKeyId ? { ...m, content: newText } : m));
                    toast.success("Mensagem editada com sucesso no WhatsApp!");
                }
                setEditingMessage(null);
            } else if (data.expired) {
                toast.error(data.message || "Limite de 15 minutos do WhatsApp excedido.");
            } else {
                toast.error(data.message || "Não foi possível editar a mensagem");
            }
        } catch (err: any) {
            toast.error(err?.message || "Erro de rede ao tentar editar a mensagem");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Focus input when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Escape: cancel reply
            if (e.key === "Escape" && replyingTo) {
                e.preventDefault();
                setReplyingTo(null);
                return;
            }
            // ? : show shortcuts
            if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                toast.success("Atalhos do Teclado", {
                    description: "Enter: Enviar mensagem\nShift+Enter: Nova linha\nEsc: Cancelar resposta\n?: Exibir esta ajuda"
                });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [replyingTo]);

    const processFileUpload = async (file: File, explicitType?: string) => {
        if (isChatFinalized) {
            toast.warning("Este atendimento está finalizado. Reabra o atendimento para enviar arquivos.");
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            toast.error("O arquivo selecionado excede o limite máximo suportado de 100MB.");
            return;
        }
        const formData = new FormData();
        formData.append("file", file);
        let type = explicitType;
        if (!type || type === '*') {
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else type = 'document';
        }
        formData.append("type", type);
        formData.append("sessionId", sessionId);
        formData.append("jid", jid);
        try {
            toast.info(`Enviando ${file.name}...`);
            const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(jid)}/media`, {
                method: "POST",
                body: formData
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.status) {
                const errMsg = data?.message || data?.error || (res.status === 413 ? "O arquivo enviado é muito grande (limite 100MB)" : "Falha ao enviar arquivo");
                throw new Error(errMsg);
            }
            toast.success("Arquivo enviado com sucesso!");
            setTimeout(() => fetchMessages(), 600);
        } catch (error: any) { 
            console.error("Upload error:", error);
            toast.error(error.message || "Falha ao enviar arquivo"); 
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFileUpload(file, uploadType);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const triggerUpload = (type: string) => {
        if (isChatFinalized) {
            toast.warning("Este atendimento está finalizado. Reabra o atendimento para enviar arquivos.");
            return;
        }
        setUploadType(type);
        if (fileInputRef.current) {
            fileInputRef.current.accept = type === 'image' ? "image/*" : type === 'video' ? "video/*" : type === 'audio' ? "audio/*" : "*/*";
            fileInputRef.current.click();
        }
    };

    // Voice Recording Handlers
    const startRecording = async () => {
        if (isChatFinalized) {
            toast.warning("Este atendimento está finalizado. Reabra o atendimento para enviar mensagens de voz.");
            return;
        }
        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                toast.error("Seu navegador não suporta gravação de áudio ou o microfone não está disponível.");
                return;
            }

            // Request studio-quality microphone capture with active hardware/browser noise suppression
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1,
                        sampleRate: 48000
                    }
                });
            } catch {
                // Fallback to basic audio stream if specific constraints are not accepted by the device
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            mediaStreamRef.current = stream;

            // Pick supported mime type for highest compatibility with WhatsApp
            let mimeType = "audio/webm;codecs=opus";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "audio/ogg;codecs=opus";
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "audio/mp4";
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "";
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.start(250); // Collect data chunks every 250ms
            setIsRecording(true);
            setRecordingDuration(0);

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            toast.info("Gravando áudio... Fale no microfone.", { duration: 2000 });
        } catch (err: any) {
            console.error("Microphone access error:", err);
            toast.error("Não foi possível acessar o microfone. Verifique as permissões de áudio do seu navegador.");
        }
    };

    const cancelRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);
        toast.info("Gravação de áudio cancelada");
    };

    const stopAndSendRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        setIsSendingAudio(true);
        const recorder = mediaRecorderRef.current;
        const mimeType = recorder.mimeType || "audio/ogg;codecs=opus";

        recorder.onstop = async () => {
            try {
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(track => track.stop());
                    mediaStreamRef.current = null;
                }

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 500) {
                    toast.error("Áudio muito curto ou vazio.");
                    setIsSendingAudio(false);
                    setIsRecording(false);
                    setRecordingDuration(0);
                    return;
                }

                const ext = mimeType.includes("ogg") ? "ogg" : (mimeType.includes("mp4") ? "m4a" : "ogg");
                const audioFile = new File([audioBlob], `voz_${Date.now()}.${ext}`, { type: mimeType });

                const formData = new FormData();
                formData.append("file", audioFile);
                formData.append("type", "voice");
                formData.append("sessionId", sessionId);
                formData.append("jid", jid);
                formData.append("voiceProfile", voiceProfile);

                toast.info("Enviando áudio...");
                const res = await fetch(`/api/messages/${sessionId}/${encodeURIComponent(jid)}/media`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.status) {
                    throw new Error(data?.message || "Falha ao enviar áudio");
                }
                toast.success("Mensagem de voz enviada com sucesso!");
                setTimeout(() => fetchMessages(), 600);
            } catch (err: any) {
                console.error("Error sending voice message:", err);
                toast.error(err.message || "Falha ao enviar áudio");
            } finally {
                setIsSendingAudio(false);
                setIsRecording(false);
                setRecordingDuration(0);
                audioChunksRef.current = [];
            }
        };

        recorder.stop();
    };

    // Keyboard shortcut: Press Enter to send recorded audio, Escape to discard
    useEffect(() => {
        if (!isRecording) return;

        const handleRecordingKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (!isSendingAudio) {
                    stopAndSendRecording();
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (!isSendingAudio) {
                    cancelRecording();
                }
            }
        };

        window.addEventListener("keydown", handleRecordingKeyDown, true);
        return () => window.removeEventListener("keydown", handleRecordingKeyDown, true);
    }, [isRecording, isSendingAudio]);

    const formatDuration = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Right-click handler
    const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    }, []);

    const [customDisplayName, setCustomDisplayName] = useState<string | null>(null);
    const [startContactEdit, setStartContactEdit] = useState<boolean>(false);

    useEffect(() => {
        setCustomDisplayName(null);
        setStartContactEdit(false);
    }, [jid]);

    const displayName = customDisplayName || name || jid.split('@')[0];

    const isGroupOrBroadcast = Boolean(
        jid.includes("@g.us") || jid.includes("@broadcast") || jid.includes("@newsletter")
    );
    const cleanNumber = jid.replace(/@.*$/, "").replace(/\D/g, "");
    const formattedPhoneNumber = formatPhoneNumberDisplay(jid);
    const isContactSaved = Boolean(
        displayName &&
        displayName !== cleanNumber &&
        displayName !== jid &&
        displayName !== formattedPhoneNumber &&
        !displayName.replace(/\D/g, "").startsWith(cleanNumber)
    );

    // Loading is now handled gracefully inside the message list to prevent unmounting the layout

    return (
        <div
            className="flex-1 flex flex-col bg-muted/20 min-w-0 min-h-0 relative"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault(); setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) processFileUpload(f);
            }}
        >
            {/* Context menu */}
            {contextMenu && (
                <ContextMenu
                    state={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onReply={(msg) => { setReplyingTo(msg); scrollToBottom(true); }}
                    onDelete={(msg) => {
                        setDeleteConfirmMsg(msg);
                    }}
                    onEdit={(msg) => {
                        setEditingMessage(msg);
                        setEditText(msg.content || "");
                    }}
                />
            )}

            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center flex-col gap-3 rounded-lg m-2">
                    <Paperclip className="h-8 w-8 text-primary" />
                    <p className="text-lg font-semibold text-primary">Drop files here</p>
                </div>
            )}

            {/* Edit message dialog */}
            <Dialog open={!!editingMessage} onOpenChange={(open) => { if (!open) setEditingMessage(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Pencil className="h-4 w-4 text-blue-500" />
                            Editar Mensagem Enviada
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Corrija erros de digitação ou ortografia. O WhatsApp atualizará o texto da mensagem para todos os participantes da conversa.
                        </DialogDescription>
                    </DialogHeader>
                    {(() => {
                        const messageAgeMs = editingMessage?.timestamp ? Date.now() - new Date(editingMessage.timestamp).getTime() : 0;
                        const isOver15Min = messageAgeMs > 15 * 60 * 1000;
                        const minutesElapsed = Math.floor(messageAgeMs / 60000);
                        const minutesLeft = Math.max(0, 15 - minutesElapsed);

                        return (
                            <>
                                {isOver15Min ? (
                                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 text-xs flex gap-2.5 items-start">
                                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-amber-300">
                                                Limite de 15 minutos do WhatsApp excedido ({minutesElapsed} min atrás)
                                            </p>
                                            <p className="text-amber-200/80 leading-relaxed text-[11px]">
                                                O protocolo oficial do WhatsApp bloqueia a alteração retroativa no celular do destinatário para mensagens com mais de 15 minutos. Você pode enviar como <strong>mensagem de correção</strong> citando a anterior.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20">
                                        <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                        <span>Tempo hábil para alterar no WhatsApp do cliente: <strong>{minutesLeft} min restantes</strong></span>
                                    </div>
                                )}
                                <div className="py-2 space-y-2">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        rows={4}
                                        autoFocus
                                        placeholder="Digite a mensagem corrigida..."
                                        className="w-full resize-y rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 leading-relaxed font-sans"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSaveEdit(isOver15Min ? 'resend_correction' : undefined);
                                            }
                                        }}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Pressione <kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[9px]">Enter</kbd> para salvar ou <kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[9px]">Shift+Enter</kbd> para quebra de linha.
                                    </p>
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setEditingMessage(null)}
                                        disabled={isSubmittingEdit}
                                        className="cursor-pointer text-xs"
                                    >
                                        Cancelar
                                    </Button>
                                    {isOver15Min ? (
                                        <Button
                                            type="button"
                                            onClick={() => handleSaveEdit('resend_correction')}
                                            disabled={isSubmittingEdit || !editText.trim()}
                                            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer text-xs gap-1.5 font-medium shadow-sm"
                                        >
                                            {isSubmittingEdit ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Enviando correção...
                                                </>
                                            ) : (
                                                <>
                                                    <CornerUpLeft className="h-3.5 w-3.5" />
                                                    Enviar como Correção
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={() => handleSaveEdit()}
                                            disabled={isSubmittingEdit || !editText.trim() || editText.trim() === editingMessage?.content}
                                            className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer text-xs gap-1.5 font-medium shadow-sm"
                                        >
                                            {isSubmittingEdit ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Salvando alteração...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    Salvar Correção no WhatsApp
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <AlertDialog open={!!deleteConfirmMsg} onOpenChange={(open) => { if (!open) setDeleteConfirmMsg(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete message?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the message for everyone. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                const msg = deleteConfirmMsg;
                                if (!msg) return;
                                fetch(`/api/messages/${sessionId}/${jid}/${msg.keyId}`, { method: "DELETE" })
                                    .then(() => { setMessages(p => p.filter(m => m.keyId !== msg.keyId)); toast.success("Deleted"); })
                                    .catch(() => toast.error("Delete failed"));
                                setDeleteConfirmMsg(null);
                            }}
                        >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Loading older indicator */}
            {loadingMore && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border text-xs flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Loading older...
                </div>
            )}

            {/* Header */}
            <div className="shrink-0 px-3 py-2.5 border-b bg-background/80 backdrop-blur-sm flex items-center gap-3 z-10">
                {onBack && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0 text-muted-foreground hover:text-foreground" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group hover:opacity-90 transition-all p-1 -m-1 rounded-xl"
                    onClick={() => setIsContactInfoOpen(true)}
                    title="Clique para ver perfil e informações completas do contato"
                >
                    <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary/10 group-hover:ring-primary/40 transition-all">
                        {headerProfilePic && <AvatarImage src={headerProfilePic} alt={displayName} className="object-cover" />}
                        <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                            {displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{displayName}</h3>
                            {attendance?.status === "WAITING" && !isChatFinalized && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3 animate-pulse" /> Em Espera
                                </span>
                            )}
                            {attendance?.status === "IN_PROGRESS" && !isChatFinalized && (
                                attendance.assignedUserId === currentUserId ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1 shrink-0">
                                        <UserCheck className="h-3 w-3" /> Em Atendimento (Você)
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 shrink-0">
                                        <Lock className="h-3 w-3" /> Atendido por {attendance.assignedUserName || "Outro Atendente"}
                                    </span>
                                )
                            )}
                            {isChatFinalized && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="h-3 w-3" /> Finalizado
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground transition-colors font-mono">
                            {formatPhoneNumberDisplay(jid)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {!isContactSaved && !isGroupOrBroadcast && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setStartContactEdit(true);
                                setIsContactInfoOpen(true);
                            }}
                            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer shadow-xs transition-all font-semibold"
                            title="Salvar este contato na agenda"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Salvar Contato</span>
                        </Button>
                    )}

                    {attendance?.status === "WAITING" && !isChatFinalized && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleAcceptAttendance}
                            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs transition-all font-semibold"
                            title="Aceitar atendimento deste cliente"
                        >
                            <Check className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Aceitar Atendimento</span>
                        </Button>
                    )}



                    {!isLockedForMe && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsTransferDialogOpen(true)}
                            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer shadow-xs transition-all"
                            title="Transferir atendimento para outro atendente ou setor"
                        >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline font-medium">Transferir</span>
                        </Button>
                    )}

                    {isChatFinalized ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isFinishing}
                            onClick={handleReopenAttendance}
                            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer shadow-xs transition-all font-semibold"
                            title="Reabrir este atendimento"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Reabrir Atendimento</span>
                        </Button>
                    ) : (
                        !isLockedForMe && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsFinishDialogOpen(true)}
                                className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer shadow-xs transition-all font-semibold"
                                title="Finalizar atendimento atual"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Finalizar Atendimento</span>
                            </Button>
                        )
                    )}

                    {onBack && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-colors shrink-0"
                            title="Fechar conversa"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Waiting banner */}
            {attendance?.status === "WAITING" && !isChatFinalized && (
                <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                        <span className="truncate sm:whitespace-normal">
                            <strong>Atendimento em Espera:</strong> Este cliente aguarda um atendente. Clique em &quot;Aceitar Atendimento&quot; para iniciar com exclusividade.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleAcceptAttendance}
                        className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 cursor-pointer shadow-xs"
                    >
                        Aceitar Atendimento
                    </Button>
                </div>
            )}

            {/* Not Saved Contact Banner */}
            {!isContactSaved && !isGroupOrBroadcast && attendance?.status !== "WAITING" && !isChatFinalized && (
                <div className="shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-3.5 py-1.5 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                            <strong>Contato não cadastrado:</strong> Salve o nome ou empresa deste cliente para organizar seu atendimento.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => {
                            setStartContactEdit(true);
                            setIsContactInfoOpen(true);
                        }}
                        className="h-6 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 cursor-pointer shadow-xs"
                    >
                        Salvar Contato
                    </Button>
                </div>
            )}

            {/* Dialog Finalizar Atendimento */}
            <Dialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-400">
                            <CheckCircle2 className="h-5 w-5" /> Finalizar Atendimento
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Deseja encerrar o atendimento com <strong>{displayName}</strong>? O contato será marcado com a etiqueta <strong>#Finalizado</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                            <input
                                type="checkbox"
                                checked={sendClosingMessage}
                                onChange={(e) => setSendClosingMessage(e.target.checked)}
                                className="rounded border-border text-blue-600 focus:ring-blue-500"
                            />
                            Enviar mensagem de encerramento para o cliente
                        </label>

                        {sendClosingMessage && (
                            <div className="space-y-1">
                                <label className="text-[11px] text-muted-foreground font-medium">Mensagem de Encerramento:</label>
                                <textarea
                                    value={closingMessageText}
                                    onChange={(e) => setClosingMessageText(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-border/50 bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsFinishDialogOpen(false)}
                            className="text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={isFinishing}
                            onClick={handleFinishAttendance}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
                        >
                            {isFinishing ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finalizando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar e Finalizar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Transferir Atendimento */}
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-400">
                            <ArrowRightLeft className="h-5 w-5" /> Transferir Atendimento
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Transfira o atendimento de <strong>{displayName}</strong> para outro atendente ou setor cadastrado.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        {/* Sector / Department Tag Picker (required: comercial, pessoal, financeiro) */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                Setor de Destino (Etiqueta) <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "Comercial", label: "Comercial", color: "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                                    { id: "Pessoal", label: "Pessoal", color: "border-purple-500/50 text-purple-600 dark:text-purple-400 bg-purple-500/10" },
                                    { id: "Financeiro", label: "Financeiro", color: "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10" },
                                ].map((dept) => {
                                    const isSelected = selectedDepartmentTag === dept.id;
                                    return (
                                        <button
                                            key={dept.id}
                                            type="button"
                                            onClick={() => setSelectedDepartmentTag(dept.id as any)}
                                            className={cn(
                                                "p-2 rounded-lg border text-xs font-semibold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer",
                                                isSelected
                                                    ? `${dept.color} ring-2 ring-primary/40 font-bold shadow-xs`
                                                    : "border-border/60 hover:bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <Tag className="h-3.5 w-3.5" />
                                            <span>{dept.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Target Attendant Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                Atendente / Linha de Destino
                            </label>
                            <select
                                value={selectedAttendant}
                                onChange={(e) => setSelectedAttendant(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value="QUEUE">🔄 Devolver para a Fila de Espera (Qualquer Atendente)</option>
                                {availableAttendants.length > 0 && (
                                    <optgroup label="Atendentes da Equipe">
                                        {availableAttendants.map((a: any) => (
                                            <option key={a.userId} value={a.userId}>
                                                👤 {a.name} ({a.email || a.role}) {a.userId === currentUserId ? "(Você)" : ""}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        {/* Notify customer checkbox and note */}
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground pt-1">
                            <input
                                type="checkbox"
                                checked={notifyCustomer}
                                onChange={(e) => setNotifyCustomer(e.target.checked)}
                                className="rounded border-border text-blue-600 focus:ring-blue-500"
                            />
                            Avisar o cliente sobre a transferência
                        </label>

                        {notifyCustomer && (
                            <div className="space-y-1">
                                <label className="text-[11px] text-muted-foreground font-medium">Mensagem para o cliente:</label>
                                <textarea
                                    value={transferCustomerNote}
                                    onChange={(e) => setTransferCustomerNote(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-border/50 bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsTransferDialogOpen(false)}
                            className="text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={isTransferring}
                            onClick={handleTransferAttendance}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
                        >
                            {isTransferring ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transferindo...
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="h-3.5 w-3.5" /> Confirmar Transferência
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal / Lightbox de Mídia em Modo Grande */}
            <Dialog open={!!previewMedia} onOpenChange={(open) => { if (!open) setPreviewMedia(null); }}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border border-border shadow-2xl">
                    <DialogHeader className="p-3 border-b flex flex-row items-center justify-between space-y-0">
                        <DialogTitle className="text-sm font-semibold truncate flex items-center gap-2">
                            {previewMedia?.type === 'IMAGE' && <ImageIcon className="h-4 w-4 text-blue-500" />}
                            {previewMedia?.type === 'VIDEO' && <Video className="h-4 w-4 text-purple-500" />}
                            {previewMedia?.type === 'DOCUMENT' && <FileText className="h-4 w-4 text-amber-500" />}
                            <span className="truncate">{previewMedia?.name || "Visualizar Arquivo"}</span>
                        </DialogTitle>
                        <div className="flex items-center gap-1.5 mr-6">
                            {previewMedia?.type === 'IMAGE' && (
                                <div className="flex items-center gap-1 bg-muted/60 rounded-md p-0.5 mr-2">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded cursor-pointer"
                                        title="Diminuir zoom"
                                        onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="text-[11px] font-mono px-1 select-none">{Math.round(zoomLevel * 100)}%</span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded cursor-pointer"
                                        title="Aumentar zoom"
                                        onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded text-[10px] cursor-pointer"
                                        title="Redefinir zoom"
                                        onClick={() => setZoomLevel(1)}
                                    >
                                        100%
                                    </Button>
                                </div>
                            )}
                            {previewMedia?.url && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1.5 text-xs cursor-pointer"
                                        onClick={() => window.open(previewMedia.url, '_blank')}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Abrir original
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                        onClick={() => handleDownload(previewMedia.url, previewMedia.name || `arquivo`)}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Baixar
                                    </Button>
                                </>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="relative min-h-[300px] max-h-[80vh] flex items-center justify-center bg-black/5 p-4 overflow-auto">
                        {previewMedia?.type === 'IMAGE' && (
                            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center">
                                <img
                                    src={previewMedia.url}
                                    alt={previewMedia.name || "Imagem"}
                                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.15s ease-out" }}
                                    className="max-h-[75vh] max-w-full object-contain rounded-md shadow-lg"
                                />
                            </div>
                        )}
                        {previewMedia?.type === 'VIDEO' && (
                            <video
                                src={previewMedia.url}
                                controls
                                autoPlay
                                className="max-h-[75vh] max-w-full rounded-md shadow-lg"
                            />
                        )}
                        {previewMedia?.type === 'DOCUMENT' && (
                            <div className="w-full h-[75vh] flex flex-col items-center justify-center">
                                {previewMedia.url.toLowerCase().endsWith('.pdf') ? (
                                    <iframe
                                        src={previewMedia.url}
                                        className="w-full h-full rounded-md border border-border shadow"
                                        title={previewMedia.name || "PDF Preview"}
                                    />
                                ) : (
                                    <div className="text-center p-8 bg-card rounded-xl border border-border/50 shadow max-w-md">
                                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-3" />
                                        <h4 className="font-semibold text-base mb-1 truncate">{previewMedia.name || "Documento"}</h4>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Este tipo de arquivo pode ser aberto em uma nova aba ou baixado para visualização no seu computador.
                                        </p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Button
                                                onClick={() => window.open(previewMedia.url, '_blank')}
                                                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Abrir em nova aba
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleDownload(previewMedia.url, previewMedia.name || `arquivo`)}
                                                className="gap-1.5 cursor-pointer"
                                            >
                                                <Download className="h-4 w-4" />
                                                Baixar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* If attendance is exclusive to another attendant, show Privacy Barrier */}
            {isLockedForMe ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background/50 backdrop-blur-xs select-none">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
                        <Lock className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">
                        Atendimento Privado em Andamento
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mb-4 leading-relaxed">
                        Esta conversa está sob atendimento exclusivo de{" "}
                        <span className="font-semibold text-foreground underline decoration-primary">
                            {attendance?.assignedUserName || "outro atendente"}
                        </span>.
                        Por motivos de segurança e organização, as mensagens e o envio estão visíveis apenas ao atendente responsável.
                    </p>
                    <div className="p-3 rounded-xl bg-muted/50 border border-border/40 text-[11px] text-muted-foreground max-w-sm text-left flex items-start gap-2.5">
                        <ShieldAlert className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>
                            O atendente atual pode transferir esta conversa diretamente para você ou devolvê-la para a fila de espera quando necessário.
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 min-h-0 styled-scrollbar" onScroll={handleScroll}
                style={{ backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.04) 1px, transparent 0)`, backgroundSize: '24px 24px' }}
            >
                <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                    {loading && messages.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-32">
                            <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    )}
                    {hasMore && loadingMore && (
                        <div className="flex justify-center py-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                <span>Carregando histórico...</span>
                            </div>
                        </div>
                    )}
                    {!hasMore && messages.length > 0 && (
                        <div className="text-center py-3">
                            <span className="text-[10px] font-medium text-muted-foreground bg-background/80 px-3 py-1 rounded-full border border-border/30">
                                Início da conversa
                            </span>
                        </div>
                    )}
                    {messages.length === 0 && !loading && (
                        <div className="flex-1 flex items-center justify-center py-16">
                            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => {
                        const showDate = idx === 0 || getDateLabel(msg.timestamp) !== getDateLabel(messages[idx - 1].timestamp);
                        return (
                            <div key={msg.keyId} id={`msg-${msg.keyId}`}>
                                {showDate && (
                                    <div className="flex justify-center my-3">
                                        <span className="text-[10px] font-medium text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-border/30">
                                            {getDateLabel(msg.timestamp)}
                                        </span>
                                    </div>
                                )}
                                <div className={cn("flex gap-1 group", msg.fromMe ? "justify-end" : "justify-start")}>
                                    {/* Actions for my message: on left */}
                                    {msg.fromMe && (
                                        <div className="flex items-center gap-0.5 self-center order-first opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                            {msg.type === 'TEXT' && !msg.isDeleted && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingMessage(msg);
                                                        setEditText(msg.content || "");
                                                    }}
                                                    className="p-1.5 text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                                                    title="Editar mensagem (corrigir texto)"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setReplyingTo(msg); scrollToBottom(true); }}
                                                className="p-1.5 text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                                                title="Responder"
                                            >
                                                <CornerUpLeft className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className={cn(
                                        "flex flex-col max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm overflow-hidden cursor-context-menu",
                                        msg.fromMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border border-border/40 rounded-bl-sm"
                                    )} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                        {!msg.fromMe && jid.endsWith("@g.us") && msg.pushName && (
                                            <span className="text-[10px] font-semibold text-primary block mb-0.5">{msg.pushName}</span>
                                        )}
                                        {msg.quoted && (
                                            <div
                                                className={cn(
                                                    "mb-1.5 px-2 py-1 rounded-lg border-l-4 text-xs select-none cursor-pointer text-left bg-muted/40",
                                                    msg.fromMe
                                                        ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/90 hover:bg-primary-foreground/15"
                                                        : "border-primary bg-muted text-muted-foreground hover:bg-muted/60"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const target = document.getElementById(`msg-${msg.quoted?.keyId}`);
                                                    if (target) {
                                                        target.scrollIntoView({ behavior: "smooth", block: "center" });
                                                        target.classList.add("bg-primary/10", "transition-colors", "duration-500");
                                                        setTimeout(() => {
                                                            target.classList.remove("bg-primary/10");
                                                        }, 1500);
                                                    } else {
                                                        toast.info("Original message not loaded in view");
                                                    }
                                                }}
                                            >
                                                <span className="font-semibold block text-[10px]">
                                                    {msg.quoted.fromMe ? "You" : (msg.quoted.pushName || msg.quoted.senderJid?.split('@')[0] || "Contact")}
                                                </span>
                                                <span className="line-clamp-2 block break-all text-xs">
                                                    {msg.quoted.content || "Media"}
                                                </span>
                                            </div>
                                        )}
                                        {/* IMAGE */}
                                        {msg.type === 'IMAGE' && msg.mediaUrl && (
                                            <div className="relative group/media">
                                                <LazyMedia 
                                                    src={msg.mediaUrl} 
                                                    alt={msg.content || "Imagem"} 
                                                    onClick={() => {
                                                        setZoomLevel(1);
                                                        setPreviewMedia({
                                                            url: msg.mediaUrl!,
                                                            type: 'IMAGE',
                                                            name: msg.content || `Imagem-${msg.keyId}.jpg`
                                                        });
                                                    }}
                                                />
                                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
                                                    <Button 
                                                        size="icon" 
                                                        variant="secondary" 
                                                        className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow hover:bg-background cursor-pointer"
                                                        title="Visualizar em tamanho grande"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setZoomLevel(1);
                                                            setPreviewMedia({
                                                                url: msg.mediaUrl!,
                                                                type: 'IMAGE',
                                                                name: msg.content || `Imagem-${msg.keyId}.jpg`
                                                            });
                                                        }}
                                                    >
                                                        <Maximize2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="secondary" 
                                                        className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow hover:bg-background cursor-pointer"
                                                        title="Baixar imagem"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(msg.mediaUrl!, `IMAGE-${msg.keyId}.jpg`);
                                                        }}
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {/* VIDEO */}
                                        {msg.type === 'VIDEO' && msg.mediaUrl && (
                                            <div className="relative group/media">
                                                <LazyVideo 
                                                    src={msg.mediaUrl} 
                                                    onClick={() => {
                                                        setPreviewMedia({
                                                            url: msg.mediaUrl!,
                                                            type: 'VIDEO',
                                                            name: msg.content || `Video-${msg.keyId}.mp4`
                                                        });
                                                    }}
                                                />
                                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
                                                    <Button 
                                                        size="icon" 
                                                        variant="secondary" 
                                                        className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow hover:bg-background cursor-pointer"
                                                        title="Visualizar em tamanho grande"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPreviewMedia({
                                                                url: msg.mediaUrl!,
                                                                type: 'VIDEO',
                                                                name: msg.content || `Video-${msg.keyId}.mp4`
                                                            });
                                                        }}
                                                    >
                                                        <Maximize2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="secondary" 
                                                        className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm shadow hover:bg-background cursor-pointer"
                                                        title="Baixar vídeo"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(msg.mediaUrl!, `VIDEO-${msg.keyId}.mp4`);
                                                        }}
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {/* AUDIO */}
                                        {msg.type === 'AUDIO' && msg.mediaUrl && (
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <audio src={msg.mediaUrl} controls className="h-8 max-w-[200px]" preload="none" />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full cursor-pointer" onClick={() => handleDownload(msg.mediaUrl!, `AUDIO-${msg.keyId}.mp3`)}><Download className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        )}
                                        {/* STICKER */}
                                        {msg.type === 'STICKER' && msg.mediaUrl && (
                                            <div className="relative group/media mb-1">
                                                <img 
                                                    src={msg.mediaUrl} 
                                                    alt="Sticker" 
                                                    className="max-h-32 object-contain rounded-lg cursor-pointer hover:scale-105 transition-transform" 
                                                    loading="lazy" 
                                                    onClick={() => {
                                                        setZoomLevel(1);
                                                        setPreviewMedia({
                                                            url: msg.mediaUrl!,
                                                            type: 'IMAGE',
                                                            name: `Figurinha-${msg.keyId}.webp`
                                                        });
                                                    }}
                                                />
                                                <Button size="icon" variant="secondary" className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm cursor-pointer"
                                                    onClick={() => handleDownload(msg.mediaUrl!, `STICKER-${msg.keyId}.webp`)}><Download className="h-3 w-3" /></Button>
                                            </div>
                                        )}
                                        {/* DOCUMENT (PDF, BOLETO, DOCX, ETC) */}
                                        {msg.type !== 'TEXT' && msg.type !== 'IMAGE' && msg.type !== 'STICKER' && msg.type !== 'VIDEO' && msg.type !== 'AUDIO' && (
                                            <div 
                                                className={cn(
                                                    "group/doc flex items-center justify-between gap-3 p-2.5 rounded-xl mb-1.5 transition-all border shadow-sm",
                                                    msg.fromMe 
                                                        ? "bg-white/15 hover:bg-white/20 border-white/25 text-white cursor-pointer" 
                                                        : "bg-muted/70 hover:bg-muted border-border/50 text-foreground cursor-pointer"
                                                )}
                                                onClick={() => {
                                                    if (!msg.mediaUrl) return;
                                                    const isPdf = msg.mediaUrl.toLowerCase().endsWith('.pdf') || (msg.content && msg.content.toLowerCase().endsWith('.pdf'));
                                                    if (isPdf) {
                                                        setPreviewMedia({
                                                            url: msg.mediaUrl,
                                                            type: 'DOCUMENT',
                                                            name: msg.content || "Documento PDF"
                                                        });
                                                    } else {
                                                        window.open(msg.mediaUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] tracking-wider uppercase shadow-sm",
                                                        (msg.mediaUrl?.toLowerCase().endsWith('.pdf') || msg.content?.toLowerCase().endsWith('.pdf'))
                                                            ? "bg-red-500 text-white"
                                                            : (msg.mediaUrl?.toLowerCase().endsWith('.xls') || msg.mediaUrl?.toLowerCase().endsWith('.xlsx') || msg.content?.toLowerCase().endsWith('.xls') || msg.content?.toLowerCase().endsWith('.xlsx'))
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-blue-600 text-white"
                                                    )}>
                                                        {(msg.mediaUrl?.toLowerCase().endsWith('.pdf') || msg.content?.toLowerCase().endsWith('.pdf'))
                                                            ? "PDF"
                                                            : (msg.mediaUrl?.toLowerCase().endsWith('.xls') || msg.mediaUrl?.toLowerCase().endsWith('.xlsx') || msg.content?.toLowerCase().endsWith('.xls') || msg.content?.toLowerCase().endsWith('.xlsx'))
                                                            ? "XLS"
                                                            : "DOC"}
                                                    </div>
                                                    <div className="truncate min-w-0">
                                                        <p className="text-xs font-semibold truncate group-hover/doc:underline">
                                                            {msg.content || (msg.mediaUrl ? msg.mediaUrl.split('/').pop()?.split('-').slice(1).join('-') : `${msg.type} Documento`)}
                                                        </p>
                                                        <span className={cn("text-[10px]", msg.fromMe ? "text-white/70" : "text-muted-foreground")}>
                                                            Clique para visualizar ou abrir
                                                        </span>
                                                    </div>
                                                </div>
                                                {msg.mediaUrl && (
                                                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className={cn("h-7 w-7 rounded-full cursor-pointer", msg.fromMe ? "hover:bg-white/20 text-white" : "hover:bg-muted text-foreground")} 
                                                            title="Abrir em nova aba"
                                                            onClick={() => window.open(msg.mediaUrl!, '_blank')}
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className={cn("h-7 w-7 rounded-full cursor-pointer", msg.fromMe ? "hover:bg-white/20 text-white" : "hover:bg-muted text-foreground")} 
                                                            title="Baixar arquivo"
                                                            onClick={() => handleDownload(msg.mediaUrl!, msg.content || `${msg.type}-${msg.keyId}`)}
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Deleted for everyone notice (content preserved) */}
                                        {msg.isDeleted && (
                                            <div className={cn(
                                                "flex items-center gap-1.5 mt-1 mb-0.5 px-2 py-1 rounded-md text-[11px] italic font-medium select-none",
                                                msg.fromMe ? "bg-primary-foreground/15 text-primary-foreground/90" : "bg-red-500/10 text-red-600 dark:text-red-400"
                                            )}>
                                                <Ban className="h-3.5 w-3.5 shrink-0" />
                                                <span>
                                                    {msg.type === 'AUDIO' ? "Áudio apagado para todos"
                                                        : msg.type === 'VIDEO' ? "Vídeo apagado para todos"
                                                        : msg.type === 'IMAGE' ? "Foto apagada para todos"
                                                        : "Mensagem apagada para todos"}
                                                </span>
                                            </div>
                                        )}
                                        {/* Text & Footer (Timestamp + WhatsApp Status Icons) */}
                                        <div className="flex items-end justify-between gap-2 mt-0.5">
                                            {msg.content ? (
                                                <span className="flex-1 text-sm break-all whitespace-pre-wrap">{renderFormattedContent(msg.content)}</span>
                                            ) : (
                                                <div className="flex-1" />
                                            )}
                                            <div className="flex items-center gap-1 shrink-0 select-none self-end ml-auto pb-0.5">
                                                <span className={cn("text-[10px] leading-none", msg.fromMe ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {msg.fromMe && (
                                                    <MessageStatusIcon status={msg.status} fromMe={msg.fromMe} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Reply button: other msg on right */}
                                    {!msg.fromMe && (
                                        <button onClick={() => { setReplyingTo(msg); scrollToBottom(true); }}
                                            className="self-center p-1.5 text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                                            title="Reply">
                                            <CornerUpLeft className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* New message badge */}
            {newMsgBadge && (
                <button onClick={() => { scrollToBottom(true); setNewMsgBadge(false); }}
                    className="absolute bottom-[90px] right-6 z-20 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all animate-bounce">
                    <ArrowDown className="h-4 w-4" /> New messages
                </button>
            )}

            {/* Input */}
            <div className="shrink-0 px-3 py-2 bg-background/80 backdrop-blur-sm border-t space-y-1.5">
                {/* Operator signature control bar */}
                <div className="flex items-center justify-between px-1 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                const next = !signOperator;
                                setSignOperator(next);
                                localStorage.setItem("wa_sign_operator", String(next));
                            }}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border cursor-pointer",
                                signOperator
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-muted text-muted-foreground border-border/50 hover:bg-muted/80"
                            )}
                            title="Clique para ativar/desativar assinatura do operador na mensagem"
                        >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>
                                {signOperator ? (
                                    <>
                                        Assinar como: <strong className="font-bold">*{operatorName || authSession?.user?.name || "Operador"}*</strong>
                                    </>
                                ) : (
                                    "Sem assinatura de operador"
                                )}
                            </span>
                        </button>

                        {signOperator && !isEditingOperator && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCustomOperatorInput(operatorName || authSession?.user?.name || "");
                                    setIsEditingOperator(true);
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                                title="Editar nome do operador"
                            >
                                <Edit2 className="h-2.5 w-2.5" />
                                Alterar nome
                            </button>
                        )}

                        {isEditingOperator && (
                            <div className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border shadow-sm">
                                <input
                                    type="text"
                                    value={customOperatorInput}
                                    onChange={(e) => setCustomOperatorInput(e.target.value)}
                                    placeholder="Ex: Lucas Melo"
                                    className="h-6 w-32 px-1.5 text-xs bg-muted/30 border rounded focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const val = customOperatorInput.trim() || authSession?.user?.name || "Operador";
                                            setOperatorName(val);
                                            localStorage.setItem("wa_operator_name", val);
                                            setIsEditingOperator(false);
                                        } else if (e.key === "Escape") {
                                            setIsEditingOperator(false);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const val = customOperatorInput.trim() || authSession?.user?.name || "Operador";
                                        setOperatorName(val);
                                        localStorage.setItem("wa_operator_name", val);
                                        setIsEditingOperator(false);
                                    }}
                                    className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                                >
                                    Salvar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingOperator(false)}
                                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input area or Finalized Locked Bar */}
                {isChatFinalized ? (
                    <div className="max-w-3xl mx-auto py-3.5 px-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left animate-in fade-in slide-in-from-bottom-2 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Lock className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                                    Atendimento Finalizado
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    A digitação e o envio de mensagens estão bloqueados. Para responder a este contato, é necessário reabrir o atendimento.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            disabled={isFinishing}
                            onClick={handleReopenAttendance}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-2 px-4 py-2 h-9 rounded-xl shadow-md cursor-pointer shrink-0 transition-transform active:scale-95"
                        >
                            {isFinishing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Reabrindo...
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="h-4 w-4" /> Reabrir Atendimento
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 max-w-3xl mx-auto">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

                        {!isRecording && (
                            <>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground cursor-pointer" title="Anexar arquivo ou gravar áudio">
                                            <Paperclip className="h-4.5 w-4.5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-44 p-1.5" side="top" align="start">
                                        <div className="flex flex-col gap-0.5">
                                            <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer" onClick={startRecording}>
                                                <Mic className="h-3.5 w-3.5" /> Gravar Áudio
                                            </Button>
                                            <div className="h-px bg-border/40 my-0.5" />
                                            <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs cursor-pointer" onClick={() => triggerUpload('image')}>
                                                <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> Imagem
                                            </Button>
                                            <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs cursor-pointer" onClick={() => triggerUpload('video')}>
                                                <Video className="h-3.5 w-3.5 text-purple-500" /> Vídeo
                                            </Button>
                                            <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs cursor-pointer" onClick={() => triggerUpload('audio')}>
                                                <Music className="h-3.5 w-3.5 text-orange-500" /> Áudio (Arquivo)
                                            </Button>
                                            <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs cursor-pointer" onClick={() => triggerUpload('document')}>
                                                <FileText className="h-3.5 w-3.5 text-emerald-500" /> Documento
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setShowQuickRepliesPopup(prev => !prev);
                                        setQuickReplyFilter("");
                                        setSelectedQuickReplyIndex(0);
                                    }}
                                    className={cn(
                                        "h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-amber-500 cursor-pointer transition-colors",
                                        showQuickRepliesPopup && "text-amber-500 bg-amber-500/10"
                                    )}
                                    title="Respostas Rápidas (atalho /)"
                                >
                                    <Zap className="h-4.5 w-4.5" />
                                </Button>
                            </>
                        )}

                        {isRecording ? (
                            <div className="flex-1 flex items-center justify-between gap-3 bg-red-500/10 dark:bg-red-500/15 border-2 border-red-500/40 rounded-2xl px-4 py-2 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="relative flex h-3 w-3 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                                    </span>
                                    <span className="font-mono text-sm font-bold text-red-600 dark:text-red-400 shrink-0">
                                        {formatDuration(recordingDuration)}
                                    </span>
                                    {/* Visual Sound wave pulse */}
                                    <div className="hidden sm:flex items-center gap-1 ml-1.5 py-1">
                                        <span className="w-1 h-2.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1 h-5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1 h-3.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.4s]"></span>
                                        <span className="w-1 h-6 bg-red-500 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                                        <span className="w-1 h-4 bg-red-500 rounded-full animate-bounce [animation-delay:-0.35s]"></span>
                                    </div>
                                    <span className="text-xs text-muted-foreground hidden md:inline truncate">
                                        Gravando mensagem de voz...
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 hidden lg:inline-flex items-center gap-1">
                                        Filtro: {VOICE_PROFILES[voiceProfile]?.name || "Estúdio"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={cancelRecording}
                                        disabled={isSendingAudio}
                                        className="h-8 px-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/20 gap-1 rounded-xl cursor-pointer"
                                        title="Descartar gravação (Esc)"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="hidden sm:inline">Descartar</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={stopAndSendRecording}
                                        disabled={isSendingAudio}
                                        className="h-8 px-3.5 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 rounded-xl shadow-md font-semibold cursor-pointer"
                                        title="Enviar mensagem de voz (ou pressione Enter)"
                                    >
                                        {isSendingAudio ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                <span>Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-3.5 w-3.5" />
                                                <span>Enviar Áudio</span>
                                                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-mono leading-none">Enter ↵</kbd>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 relative">
                                    {/* Quick Replies Floating Popup */}
                                    {showQuickRepliesPopup && filteredQuickReplies.length > 0 && (
                                        <div className="absolute bottom-full mb-2 left-0 right-0 max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground flex items-center justify-between border-b border-border/30 mb-1">
                                                <span className="flex items-center gap-1.5 text-foreground">
                                                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Respostas Rápidas ({filteredQuickReplies.length})
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/80">
                                                    Pressione <kbd className="px-1 py-0.5 bg-muted border rounded font-mono text-[9px]">Enter</kbd> para inserir
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                {filteredQuickReplies.map((reply, i) => (
                                                    <button
                                                        key={reply.id || i}
                                                        type="button"
                                                        onClick={() => applyQuickReply(reply)}
                                                        className={cn(
                                                            "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer",
                                                            i === selectedQuickReplyIndex
                                                                ? "bg-primary text-primary-foreground font-medium shadow-xs"
                                                                : "hover:bg-muted text-foreground"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className={cn(
                                                                "font-mono font-bold text-[11px] px-1.5 py-0.5 rounded",
                                                                i === selectedQuickReplyIndex
                                                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                                                    : "bg-primary/10 text-primary border border-primary/20"
                                                            )}>
                                                                {reply.shortcut}
                                                            </span>
                                                            <span className="font-semibold truncate">{reply.title}</span>
                                                        </div>
                                                        <span className={cn(
                                                            "text-[10px] truncate max-w-[220px] opacity-75",
                                                            i === selectedQuickReplyIndex ? "text-primary-foreground" : "text-muted-foreground"
                                                        )}>
                                                            {reply.content}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Reply preview bar */}
                                    {replyingTo && (
                                        <div className="mb-2 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-muted/50 border-l-2 border-amber-500 text-xs animate-in slide-in-from-bottom-1 overflow-hidden">
                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                <span className="font-semibold text-amber-500 block text-[10px]">Respondendo a {replyingTo.fromMe ? "você" : (replyingTo.pushName || jid.split('@')[0])}</span>
                                                <span className="text-muted-foreground truncate block w-full">{replyingTo.content || `[${replyingTo.type}]`}</span>
                                            </div>
                                            <button onClick={() => setReplyingTo(null)} className="p-0.5 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"><X className="h-3 w-3" /></button>
                                        </div>
                                    )}
                                    <div className="flex items-end gap-1 p-1 rounded-2xl border border-border/30 bg-background shadow-sm">
                                        <EmojiPicker onSelectEmoji={handleInsertEmoji} />
                                        <textarea ref={inputRef} value={input} onChange={handleInputChange}
                                            onKeyDown={handleKeyDown} placeholder="Digite uma mensagem ou / para respostas rápidas..." rows={1} style={{ minHeight: "36px", maxHeight: "120px" }}
                                            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none leading-normal" />
                                    </div>
                                </div>

                                {input.trim() ? (
                                    <Button
                                        onClick={handleSend}
                                        size="icon"
                                        className="h-9 w-9 rounded-full shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition-all"
                                        title="Enviar mensagem"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <VoiceStudioDialog
                                            currentProfile={voiceProfile}
                                            onSelectProfile={(p) => setVoiceProfile(p)}
                                        />
                                        <Button
                                            type="button"
                                            onClick={startRecording}
                                            size="icon"
                                            className="h-9 w-9 rounded-full shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition-all hover:scale-105"
                                            title={`Gravar áudio (${VOICE_PROFILES[voiceProfile]?.name || "Estúdio"})`}
                                        >
                                            <Mic className="h-4.5 w-4.5" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
            </>
            )}

            {/* WhatsApp Professional Contact Info Dialog */}
            <ContactInfoDialog
                isOpen={isContactInfoOpen}
                onClose={() => {
                    setIsContactInfoOpen(false);
                    setStartContactEdit(false);
                }}
                sessionId={sessionId}
                jid={jid}
                displayName={displayName}
                startInEditMode={startContactEdit}
                attendance={attendance}
                labels={contactLabels}
                currentUserId={currentUserId}
                isChatFinalized={isChatFinalized}
                onAcceptAttendance={handleAcceptAttendance}
                onTransferAttendance={() => setIsTransferDialogOpen(true)}
                onFinishAttendance={() => setIsFinishDialogOpen(true)}
                onReopenAttendance={handleReopenAttendance}
                onContactUpdated={(newName, newPhotoUrl) => {
                    setCustomDisplayName(newName);
                    if (newPhotoUrl) setHeaderProfilePic(newPhotoUrl);
                    setStartContactEdit(false);
                }}
            />
        </div>
    );
}
