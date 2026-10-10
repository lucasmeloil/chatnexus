import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
    MessageSquare,
    Send,
    QrCode,
    Bot,
    UserCheck,
    Clock,
    Tag,
    ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    // Carregar dados de métricas analíticas e operacionais no servidor (Zero-latency SSR)
    const initialMetrics = await getDashboardMetrics({
        userId: session.user.id!,
        userRole: session.user.role || "OWNER",
        userEmail: session.user.email || undefined,
        period: "7d",
    });

    const dbSessionIds = initialMetrics.sessions.map((s) => s.id);

    // Carregar últimas conversas recentes para o feed rápido
    const recentMessages = await prisma.message.findMany({
        where: {
            sessionId: { in: dbSessionIds },
            remoteJid: { not: { contains: "@g.us" } },
        },
        orderBy: { timestamp: "desc" },
        take: 6,
        select: {
            id: true,
            sessionId: true,
            remoteJid: true,
            content: true,
            fromMe: true,
            timestamp: true,
            type: true,
            pushName: true,
        },
    }).catch(() => []);

    const recentJids = Array.from(new Set(recentMessages.map((m) => m.remoteJid)));
    const recentContacts = recentJids.length > 0
        ? await prisma.contact.findMany({
            where: {
                sessionId: { in: dbSessionIds },
                jid: { in: recentJids },
            },
            select: {
                jid: true,
                name: true,
                notify: true,
                profilePic: true,
            },
        }).catch(() => [])
        : [];

    const contactMap = new Map(recentContacts.map((c) => [c.jid, c]));

    const recentChatLabels = recentJids.length > 0
        ? await prisma.chatLabel.findMany({
            where: { chatJid: { in: recentJids } },
            include: { label: true },
        }).catch(() => [])
        : [];

    const labelMap = new Map<string, { name: string; colorHex: string }>();
    for (const cl of recentChatLabels) {
        if (!labelMap.has(cl.chatJid)) {
            labelMap.set(cl.chatJid, { name: cl.label.name, colorHex: cl.label.colorHex });
        }
    }

    const quickActions = [
        { href: "/dashboard/chat", label: "Chat ao Vivo", icon: MessageSquare, description: "Atender clientes em tempo real" },
        { href: "/dashboard/contacts", label: "Contatos & Tags", icon: UserCheck, description: "Gerenciar clientes e etiquetas" },
        { href: "/dashboard/broadcast", label: "Disparos em Massa", icon: Send, description: "Campanhas e broadcast" },
        { href: "/dashboard/sessions", label: "Sessões WhatsApp", icon: QrCode, description: "Conectar e gerenciar números" },
        { href: "/dashboard/bot-settings", label: "Robô de Atendimento", icon: Bot, description: "Respostas e fluxos automáticos" },
    ];

    return (
        <div className="space-y-8">
            {/* Dashboard Analítico Interativo & Tempo Real */}
            <AnalyticsDashboard initialData={initialMetrics} />

            {/* Linha Inferior: Feed Recente + Acesso Rápido */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Feed de Últimos Atendimentos */}
                <Card className="glass-panel border-border/50 shadow-xs lg:col-span-2">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                Últimas Conversas Interagidas
                            </CardTitle>
                            <Link href="/dashboard/chat" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                                Abrir Chat <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentMessages.length === 0 ? (
                            <div className="py-12 text-center text-xs text-muted-foreground">
                                Nenhuma conversa recente registrada nas sessões ativas.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {recentMessages.map((msg) => {
                                    const contact = contactMap.get(msg.remoteJid);
                                    const cleanPhone = msg.remoteJid.replace("@s.whatsapp.net", "");
                                    const displayName = contact?.name || contact?.notify || msg.pushName || `+${cleanPhone}`;
                                    const label = labelMap.get(msg.remoteJid);
                                    const timeStr = new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                                    return (
                                        <Link
                                            key={msg.id}
                                            href={`/dashboard/chat?jid=${encodeURIComponent(msg.remoteJid)}`}
                                            className="p-3.5 flex items-start gap-3 hover:bg-muted/40 transition-colors block cursor-pointer"
                                        >
                                            <Avatar className="h-9 w-9 shrink-0">
                                                <AvatarImage src={contact?.profilePic || ""} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {displayName.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                                    <span className="text-xs font-bold text-foreground truncate">
                                                        {displayName}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                                        {timeStr}
                                                    </span>
                                                </div>

                                                {label && (
                                                    <span
                                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-medium mb-1"
                                                        style={{
                                                            backgroundColor: `${label.colorHex}15`,
                                                            color: label.colorHex,
                                                            border: `1px solid ${label.colorHex}30`,
                                                        }}
                                                    >
                                                        <Tag className="h-2.5 w-2.5" />
                                                        {label.name}
                                                    </span>
                                                )}

                                                <p className="text-xs text-muted-foreground truncate">
                                                    {msg.fromMe ? <span className="text-primary font-medium">Você: </span> : null}
                                                    {msg.content || (msg.type !== "TEXT" ? `[${msg.type.toLowerCase()}]` : "")}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Acessos Rápidos */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Acessos Operacionais
                    </h3>
                    <div className="space-y-2.5">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link key={action.href} href={action.href} className="block">
                                    <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer">
                                        <CardContent className="p-3.5 flex items-center gap-3">
                                            <div className="bg-primary/10 text-primary p-2.5 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                                    {action.label}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {action.description}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
