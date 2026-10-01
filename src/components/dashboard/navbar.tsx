"use client";

import { useState, useEffect } from "react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SessionSelector } from "@/components/dashboard/session-selector";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const RealtimeClock = dynamic(
    () => import("@/components/dashboard/realtime-clock").then((m) => m.RealtimeClock),
    { ssr: false }
);
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Inbox, Trash2, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { 
    isNotificationSoundEnabled, 
    setNotificationSoundEnabled, 
    isFloatingNotificationEnabled,
    setFloatingNotificationEnabled,
    playNotificationSound,
    isMuteActiveChatEnabled,
    setMuteActiveChatEnabled
} from "@/lib/notification-sound";

interface NavbarProps {
    appName?: string;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    href?: string;
    createdAt: string;
}

export function Navbar({ appName }: NavbarProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [floatingEnabled, setFloatingEnabled] = useState(true);
    const [muteActiveChat, setMuteActiveChat] = useState(true);

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

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const responseData = await res.json();
                const items = responseData?.data || [];
                setNotifications(items);
                setUnreadCount(items.filter((n: Notification) => !n.read).length);
            }
        } catch (e) {
            console.error("Failed to fetch notifications");
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotifications();

        // Setup Socket.IO connection
        if (session?.user?.id) {
            const socketInstance = io({
                path: "/api/socket/io",
            });

            socketInstance.on("connect", () => {
                console.log("Socket connected for notifications");
                // Join user-specific room
                socketInstance.emit("join-user-room", session.user.id);
            });

            socketInstance.on("notification:new", (notification: Notification) => {
                console.log("New notification received:", notification);

                // Add to notifications list without duplicate IDs
                setNotifications(prev => {
                    if (prev.some(item => item.id === notification.id)) return prev;
                    return [notification, ...prev];
                });
                setUnreadCount(prev => prev + 1);

                // Show toast popup
                toast.info(notification.title, {
                    description: notification.message,
                    action: notification.href ? {
                        label: "Ver",
                        onClick: () => router.push(notification.href!)
                    } : undefined,
                });
            });

            // Listen for incoming WhatsApp messages from contacts
            socketInstance.on("incoming.message", (data: any) => {
                if (!data?.message) return;
                const m = data.message;
                const remoteJid = m.remoteJid || "";
                if (remoteJid.includes("status@broadcast")) return;

                const senderName = m.pushName || remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
                const newNotif: Notification = {
                    id: m.id || m.keyId || `msg-${Date.now()}`,
                    title: `Mensagem de ${senderName}`,
                    message: m.content || "Nova mensagem recebida",
                    read: false,
                    type: "MESSAGE",
                    href: `/dashboard/chat?session=${data.sessionId}&jid=${encodeURIComponent(remoteJid)}`,
                    createdAt: m.timestamp || new Date().toISOString()
                };

                setNotifications(prev => {
                    if (prev.some(item => item.id === newNotif.id)) return prev;
                    return [newNotif, ...prev];
                });
                setUnreadCount(prev => prev + 1);
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
        }
    }, [session?.user?.id]);

    const markAsRead = async (id?: string) => {
        try {
            const ids = id ? [id] : []; // Empty array means mark all
            const res = await fetch("/api/notifications/read", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids })
            });
            if (res.ok) {
                if (id) {
                    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));
                } else {
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    setUnreadCount(0);
                }
            }
        } catch (e) {
            console.error("Failed to mark read");
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const res = await fetch(`/api/notifications/delete?id=${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                setUnreadCount(prev => {
                    const notification = notifications.find(n => n.id === id);
                    return notification && !notification.read ? Math.max(0, prev - 1) : prev;
                });
                toast.success("Notification deleted");
            }
        } catch (e) {
            console.error("Failed to delete notification");
            toast.error("Failed to delete notification");
        }
    };

    const handleNotificationClick = (n: Notification) => {
        if (!n.read) markAsRead(n.id);
        if (n.href) router.push(n.href);
        setIsOpen(false);
    };

    return (
        <header className="bg-background/40 backdrop-blur-2xl border-b border-border/50 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 w-full shadow-sm">
            <div className="flex items-center gap-3">
                <MobileNav appName={appName} />
            </div>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <div className="hidden sm:flex items-center"><RealtimeClock /></div>
                <SessionSelector />
                <div className="h-6 w-px bg-border/50 hidden sm:block" />

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-muted/50 rounded-full h-10 w-10 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Configurações de som e notificações"
                        >
                            {soundEnabled ? (
                                <Volume2 className="h-5 w-5 text-primary" />
                            ) : (
                                <VolumeX className="h-5 w-5 text-muted-foreground/60" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4 rounded-2xl border border-border/50 shadow-2xl glass-panel" align="end">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                <Volume2 className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-sm text-foreground">Sons e Notificações</span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-medium cursor-pointer">Sons e Notificações</Label>
                                    <p className="text-[11px] text-muted-foreground leading-tight">Tocar aviso sonoro nas novas mensagens</p>
                                </div>
                                <Switch
                                    checked={soundEnabled}
                                    onCheckedChange={(val) => {
                                        setSoundEnabled(val);
                                        setNotificationSoundEnabled(val);
                                        if (val) {
                                            playNotificationSound();
                                            toast.success("Sons e notificações ativados");
                                        } else {
                                            toast.info("Sons e notificações desativados");
                                        }
                                    }}
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
                                    onCheckedChange={(val) => {
                                        setFloatingEnabled(val);
                                        setFloatingNotificationEnabled(val);
                                        if (val) {
                                            toast.success("Notificações flutuantes ativadas");
                                        } else {
                                            toast.info("Notificações flutuantes desativadas");
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-medium cursor-pointer">Silenciar Janela Aberta</Label>
                                    <p className="text-[11px] text-muted-foreground leading-tight">Não emitir som nem avisos da conversa aberta no momento. Notifica apenas as demais conversas.</p>
                                </div>
                                <Switch
                                    checked={muteActiveChat}
                                    onCheckedChange={(val) => {
                                        setMuteActiveChat(val);
                                        setMuteActiveChatEnabled(val);
                                        if (val) {
                                            toast.success("Conversa aberta será silenciada");
                                        } else {
                                            toast.info("Notificações ativas para todas as conversas");
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative hover:bg-muted/50 rounded-full h-10 w-10">
                            <Bell className={`h-5 w-5 transition-colors ${unreadCount > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-2.5 h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse border-2 border-background" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-2xl border border-border/50 shadow-2xl glass-panel" align="end">
                        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50">
                            <div>
                                <h4 className="font-semibold leading-none text-foreground">Notificações</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {unreadCount > 0 ? `Você tem ${unreadCount} atualização(ões) não lida(s).` : "Nenhuma nova notificação."}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={() => { router.push("/dashboard/inbox"); setIsOpen(false); }}>
                                    Ver todas
                                </Button>
                                {unreadCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => markAsRead()} className="h-auto py-1 px-2 text-xs">
                                        Marcar como lidas
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="min-h-[150px] flex flex-col items-center justify-center text-center p-4">
                                    <div className="bg-slate-100 p-3 rounded-full mb-3">
                                        <Inbox className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium">Nenhuma notificação nova</p>
                                    <p className="text-xs text-muted-foreground max-w-[180px]">Notificaremos você assim que houver atualizações importantes.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {notifications.map((n, idx) => (
                                        <div
                                            key={`${n.id || 'notif'}-${idx}`}
                                            className={`p-4 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                                        >
                                            <div className="flex justify-between items-start gap-3">
                                                <div
                                                    className="flex-1 space-y-1 cursor-pointer"
                                                    onClick={() => handleNotificationClick(n)}
                                                >
                                                    <p className={`text-sm font-medium leading-none ${!n.read ? 'text-blue-700' : 'text-slate-900'}`}>
                                                        {n.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground whitespace-normal break-words">
                                                        {n.message}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!n.read && <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(n.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-2.5 border-t border-border/50 bg-muted/20 flex justify-between items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-8 gap-1.5 font-medium hover:bg-blue-500/10 hover:border-blue-500/30 text-blue-700 dark:text-blue-400"
                                onClick={() => {
                                    playNotificationSound();
                                    if (typeof window !== "undefined" && (window as any).__nexusTestNotification) {
                                        (window as any).__nexusTestNotification();
                                    }
                                }}
                            >
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>Testar Som e Notificação Flutuante</span>
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </header>
    );
}
