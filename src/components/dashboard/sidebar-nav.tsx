"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSocket } from "@/components/chat/socket-context";
import { ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import {
    LayoutDashboard,
    MessageSquare,
    MessagesSquare,
    Users,
    Settings,
    QrCode,
    ImageIcon,
    Webhook,
    CalendarClock,
    Bot,
    Bell,
    FileText,
    Code,
    Send,
    UserCheck,
    Megaphone,
    HardDrive,
    Activity,
    UserCircle,
    Tag,
    MessageCircleReply,
    Contact,
    Zap,
    UserPlus,
    Star,
    Target,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavGroup {
    label: string;
    items: NavItem[];
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    external?: boolean;
    superadminOnly?: boolean;
    allowedRoles?: string[];
}

const navGroups: NavGroup[] = [
    {
        label: "Principal",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/dashboard/leads", label: "Gestão de Leads", icon: Target },
            { href: "/dashboard/feedbacks", label: "Avaliações e Feedbacks", icon: Star },
            { href: "/dashboard/sessions", label: "Sessões / QR Code", icon: QrCode, superadminOnly: true },
        ],
    },
    {
        label: "Mensagens",
        items: [
            { href: "/dashboard/chat", label: "Chat ao Vivo", icon: MessageSquare },
            { href: "/dashboard/internal-chat", label: "Chat Interno", icon: MessagesSquare },
            { href: "/dashboard/quick-replies", label: "Respostas Rápidas", icon: Zap },
            { href: "/dashboard/broadcast", label: "Disparos / Broadcast", icon: Megaphone },
            { href: "/dashboard/sticker", label: "Criador de Figurinhas", icon: ImageIcon },
        ],
    },
    {
        label: "Contatos",
        items: [
            { href: "/dashboard/contacts", label: "Contatos", icon: UserCheck },
            { href: "/dashboard/groups", label: "Grupos", icon: Users },
            { href: "/dashboard/labels", label: "Etiquetas", icon: Tag },
        ],
    },
    {
        label: "Automação",
        items: [
            { href: "/dashboard/bot-settings", label: "Configuração do Bot", icon: Bot },
            { href: "/dashboard/autoreply", label: "Respostas Automáticas", icon: MessageCircleReply },
            { href: "/dashboard/profile", label: "Perfil do Bot", icon: UserCircle },
            { href: "/dashboard/scheduler", label: "Agendador", icon: CalendarClock },
            { href: "/dashboard/webhooks", label: "Webhooks e API", icon: Webhook },
        ],
    },
    {
        label: "Desenvolvedor",
        items: [
            { href: "/docs", label: "Documentação da API", icon: FileText },
            { href: "/swagger", label: "Swagger UI", icon: Code, external: true },
        ],
    },
    {
        label: "Administração",
        items: [
            { href: "/dashboard/media", label: "Gerenciador de Mídia", icon: HardDrive },
            { href: "/dashboard/sessions/access", label: "Acesso a Sessões", icon: UserPlus, superadminOnly: true },
            { href: "/dashboard/users", label: "Usuários", icon: Users, superadminOnly: true },
            { href: "/dashboard/settings", label: "Configurações", icon: Settings },
            { href: "/dashboard/system-monitor", label: "Monitor do Sistema", icon: Activity, superadminOnly: true },
            { href: "/dashboard/notifications", label: "Notificações", icon: Bell, superadminOnly: true },
        ],
    },
];

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isCollapsed, toggleCollapse } = useSidebar();
    const { socket: socketFromCtx, getSocket } = useSocket();
    const activeSocket = socketFromCtx || getSocket();

    // @ts-ignore
    const userRole = session?.user?.role;
    const userEmail = session?.user?.email?.toLowerCase();
    const isSuperAdmin = userRole === "SUPERADMIN";
    const currentUserId = (session?.user as any)?.id;

    // Track collapsed groups — all expanded by default
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [internalUnread, setInternalUnread] = useState<number>(0);
    const [liveChatBadge, setLiveChatBadge] = useState<number>(0);

    const toggleGroup = (label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    // Consult unread internal chat messages count
    const fetchUnread = useCallback(async () => {
        try {
            const lastRead = typeof window !== "undefined" ? localStorage.getItem("nexus_general_chat_last_read") : null;
            const url = lastRead ? `/api/internal-chat/unread?since=${encodeURIComponent(lastRead)}` : `/api/internal-chat/unread`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.status && typeof data.unreadCount === "number") {
                setInternalUnread(data.unreadCount);
            }
        } catch (e) {
            // silent
        }
    }, []);

    // Consult live chat badge (waiting queue count)
    const fetchLiveChatBadge = useCallback(async () => {
        try {
            const res = await fetch("/api/chat/live-badge");
            const data = await res.json();
            if (data?.status && typeof data.count === "number") {
                setLiveChatBadge(data.count);
            }
        } catch (e) {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchUnread();
        fetchLiveChatBadge();
    }, [fetchUnread, fetchLiveChatBadge]);

    // When on internal-chat page, reset count & save last read timestamp
    useEffect(() => {
        if (pathname?.startsWith("/dashboard/internal-chat")) {
            setInternalUnread(0);
            if (typeof window !== "undefined") {
                localStorage.setItem("nexus_general_chat_last_read", new Date().toISOString());
                window.dispatchEvent(new CustomEvent("nexus:internal-chat-read"));
            }
        }
    }, [pathname]);

    // Socket listener for new incoming internal chat messages & live chat updates
    useEffect(() => {
        // Synchronize in-page updates from chat-list (waiting count)
        const handleLiveChatCounts = (e: any) => {
            if (typeof e.detail?.count === "number") {
                setLiveChatBadge(e.detail.count);
            }
        };

        window.addEventListener("nexus:live-chat-counts", handleLiveChatCounts);

        if (!activeSocket) {
            return () => {
                window.removeEventListener("nexus:live-chat-counts", handleLiveChatCounts);
            };
        }

        const handleInternalMessage = (msg: any) => {
            // Ignore if sent by current user
            if (msg?.senderId && currentUserId && msg.senderId === currentUserId) return;

            // If user is already on internal-chat, don't increment badge
            if (pathname?.startsWith("/dashboard/internal-chat")) {
                if (typeof window !== "undefined") {
                    localStorage.setItem("nexus_general_chat_last_read", new Date().toISOString());
                }
                return;
            }

            // Increment badge count
            setInternalUnread(prev => prev + 1);
        };

        const handleLocalRead = () => {
            setInternalUnread(0);
        };

        // Live chat real-time events
        const handleAttendanceEvent = () => {
            fetchLiveChatBadge();
        };

        const handleIncomingMsg = () => {
            fetchLiveChatBadge();
        };

        activeSocket.on("internal_chat.message", handleInternalMessage);
        activeSocket.on("attendance.update", handleAttendanceEvent);
        activeSocket.on("attendance.transfer", handleAttendanceEvent);
        activeSocket.on("incoming.message", handleIncomingMsg);
        window.addEventListener("nexus:internal-chat-read", handleLocalRead);

        return () => {
            window.removeEventListener("nexus:live-chat-counts", handleLiveChatCounts);
            activeSocket.off("internal_chat.message", handleInternalMessage);
            activeSocket.off("attendance.update", handleAttendanceEvent);
            activeSocket.off("attendance.transfer", handleAttendanceEvent);
            activeSocket.off("incoming.message", handleIncomingMsg);
            window.removeEventListener("nexus:internal-chat-read", handleLocalRead);
        };
    }, [activeSocket, pathname, currentUserId, fetchLiveChatBadge]);

    return (
        <TooltipProvider delayDuration={0}>
            <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5 styled-scrollbar">
                {navGroups.map((group) => {
                    const visibleItems = group.items.filter((item) => {
                        if (item.superadminOnly && !isSuperAdmin) return false;
                        if (item.allowedRoles && (!isSuperAdmin && (!userRole || !item.allowedRoles.includes(userRole)))) return false;
                        return true;
                    });
                    if (visibleItems.length === 0) return null;

                    const isGroupCollapsed = collapsedGroups[group.label] ?? false;

                    // "Principal" group doesn't show a collapsible header
                    if (group.label === "Principal" || group.label === "Main") {
                        return (
                            <div key={group.label} className="mb-1">
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.href}
                                        item={item}
                                        active={isActive(item.href)}
                                        isCollapsed={isCollapsed}
                                        badge={
                                            item.href === "/dashboard/internal-chat"
                                                ? internalUnread
                                                : item.href === "/dashboard/chat"
                                                ? liveChatBadge
                                                : undefined
                                        }
                                    />
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div key={group.label} className="mb-1">
                            {/* Group header — hidden when sidebar collapsed */}
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground/80 transition-colors group"
                                >
                                    {group.label}
                                    <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`}
                                    />
                                </button>
                            )}

                            {/* Collapsed sidebar: show a thin divider between groups */}
                            {isCollapsed && (
                                <div className="mx-3 my-2 border-t border-border/30" />
                            )}

                            {(!isGroupCollapsed || isCollapsed) && (
                                <div className="space-y-0.5">
                                    {visibleItems.map((item) => (
                                        <NavLink
                                            key={item.href}
                                            item={item}
                                            active={isActive(item.href)}
                                            isCollapsed={isCollapsed}
                                            badge={
                                                item.href === "/dashboard/internal-chat"
                                                    ? internalUnread
                                                    : item.href === "/dashboard/chat"
                                                    ? liveChatBadge
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
        </TooltipProvider>
    );
}

function NavLink({ item, active, isCollapsed, badge }: { item: NavItem; active: boolean; isCollapsed: boolean; badge?: number }) {
    const Icon = item.icon;
    const isLiveChat = item.href === "/dashboard/chat";
    const badgeColorClass = isLiveChat ? "bg-blue-600 shadow-blue-500/30" : "bg-emerald-500 shadow-emerald-500/30";
    const pingColorClass = isLiveChat ? "bg-blue-400" : "bg-emerald-400";
    const dotColorClass = isLiveChat ? "bg-blue-500" : "bg-emerald-500";

    const linkContent = (
        <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={`
                flex items-center rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${isCollapsed ? "justify-center px-2 py-2.5 mx-1" : "gap-3 px-3 py-2"}
                ${active
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }
            `}
        >
            {active && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
            )}
            
            {isCollapsed ? (
                <div className="relative flex items-center justify-center">
                    <Icon
                        size={20}
                        className={`flex-shrink-0 transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`}
                    />
                    {typeof badge === "number" && badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingColorClass} opacity-75`} />
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColorClass} border-2 border-background`} />
                        </span>
                    )}
                </div>
            ) : (
                <>
                    <Icon
                        size={17}
                        className={`flex-shrink-0 transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                    {typeof badge === "number" && badge > 0 && (
                        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full ${badgeColorClass} text-white shadow-sm animate-pulse shrink-0`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                            {badge > 99 ? "99+" : badge}
                        </span>
                    )}
                </>
            )}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                        <span>{item.label}</span>
                        {typeof badge === "number" && badge > 0 && (
                            <span className={`px-1.5 py-0.2 ${dotColorClass} text-white font-bold rounded-full text-[10px]`}>
                                {badge}
                            </span>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    }

    return linkContent;
}
