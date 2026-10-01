import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
    Plus,
    Wifi,
    WifiOff,
    MessageSquare,
    Bot,
    Send,
    Settings,
    QrCode,
    ArrowRight,
    Activity,
    Zap,
    Users,
    TrendingUp,
    Clock,
    Tag,
    CheckCircle2,
    Calendar,
    UserCheck,
    MessageCircle,
    ArrowUpRight,
    ArrowDownLeft
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getAccessibleSessions } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const sessions = await getAccessibleSessions(session.user.id!, session.user.role || "OWNER");
    const dbSessionIds = sessions.map(s => s.id);
    const sessionStringIds = sessions.map(s => s.sessionId);

    const totalSessions = sessions.length;
    const connectedSessions = sessions.filter(s => s.status === 'CONNECTED').length;
    const disconnectedSessions = totalSessions - connectedSessions;

    // 1. Fetch detailed attendance stats per session
    const sessionStats = await Promise.all(
        sessions.map(async (sess) => {
            // Unique clients / conversations attended by this session
            const uniqueChats = await prisma.message.groupBy({
                by: ['remoteJid'],
                where: { 
                    sessionId: sess.id,
                    remoteJid: { not: { contains: '@g.us' } } // Exclude groups for pure customer attendances
                }
            }).catch(() => []);

            const uniqueGroupChats = await prisma.message.groupBy({
                by: ['remoteJid'],
                where: { 
                    sessionId: sess.id,
                    remoteJid: { contains: '@g.us' }
                }
            }).catch(() => []);

            // Total messages sent by attendant (fromMe = true)
            const sentCount = await prisma.message.count({
                where: { sessionId: sess.id, fromMe: true }
            }).catch(() => 0);

            // Total messages received from customers (fromMe = false)
            const receivedCount = await prisma.message.count({
                where: { sessionId: sess.id, fromMe: false }
            }).catch(() => 0);

            // Total contacts registered in this session
            const contactsCount = await prisma.contact.count({
                where: { sessionId: sess.id }
            }).catch(() => 0);

            // Most recent message in this session
            const lastMsg = await prisma.message.findFirst({
                where: { sessionId: sess.id },
                orderBy: { timestamp: 'desc' },
                select: { timestamp: true, content: true, fromMe: true, remoteJid: true, pushName: true }
            }).catch(() => null);

            const totalMsgs = sentCount + receivedCount;
            const responseRate = totalMsgs > 0 ? Math.round((sentCount / totalMsgs) * 100) : 0;

            return {
                ...sess,
                attendancesCount: uniqueChats.length,
                groupsCount: uniqueGroupChats.length,
                sentCount,
                receivedCount,
                totalMessages: totalMsgs,
                contactsCount,
                responseRate,
                lastMsg
            };
        })
    );

    // 2. Global Aggregations
    const totalAttendances = sessionStats.reduce((acc, s) => acc + s.attendancesCount, 0);
    const totalSent = sessionStats.reduce((acc, s) => acc + s.sentCount, 0);
    const totalReceived = sessionStats.reduce((acc, s) => acc + s.receivedCount, 0);
    const totalMessages = totalSent + totalReceived;
    const totalContacts = sessionStats.reduce((acc, s) => acc + s.contactsCount, 0);

    // Auto replies count
    let autoReplyCount = 0;
    try {
        if (dbSessionIds.length > 0) {
            autoReplyCount = await prisma.autoReply.count({
                where: { sessionId: { in: dbSessionIds } }
            });
        }
    } catch {
        // Fallback
    }

    // 3. Message Volume in the last 7 days
    const past7DaysData = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const dayLabel = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

            return Promise.all([
                prisma.message.count({
                    where: {
                        sessionId: { in: dbSessionIds },
                        fromMe: true,
                        timestamp: { gte: date, lt: nextDate }
                    }
                }).catch(() => 0),
                prisma.message.count({
                    where: {
                        sessionId: { in: dbSessionIds },
                        fromMe: false,
                        timestamp: { gte: date, lt: nextDate }
                    }
                }).catch(() => 0)
            ]).then(([sent, received]) => ({
                day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
                dateStr: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                sent,
                received,
                total: sent + received
            }));
        })
    );

    const maxDayTotal = Math.max(...past7DaysData.map(d => d.total), 1);

    // 4. Recent Customer Conversations across sessions
    const recentMessages = await prisma.message.findMany({
        where: {
            sessionId: { in: dbSessionIds },
            remoteJid: { not: { contains: '@g.us' } }
        },
        orderBy: { timestamp: 'desc' },
        take: 6,
        select: {
            id: true,
            sessionId: true,
            remoteJid: true,
            content: true,
            fromMe: true,
            timestamp: true,
            type: true,
            pushName: true
        }
    }).catch(() => []);

    // Fetch contact details and tags for these recent messages
    const recentJids = Array.from(new Set(recentMessages.map(m => m.remoteJid)));
    const recentContacts = recentJids.length > 0
        ? await prisma.contact.findMany({
            where: {
                sessionId: { in: dbSessionIds },
                jid: { in: recentJids }
            },
            select: {
                jid: true,
                name: true,
                notify: true,
                profilePic: true,
                data: true
            }
        }).catch(() => [])
        : [];

    const contactMap = new Map(recentContacts.map(c => [c.jid, c]));

    // Fetch chat labels for recent conversations
    const recentChatLabels = recentJids.length > 0
        ? await prisma.chatLabel.findMany({
            where: { chatJid: { in: recentJids } },
            include: { label: true }
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
        <div className="space-y-8 pb-10">
            {/* Header com Boas-Vindas e Ação Principal */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 rounded-2xl border border-primary/15 shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/25">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Painel Operacional
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                        Dashboard de Atendimentos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Acompanhe métricas em tempo real, volume de mensagens e produtividade de cada sessão conectada.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <Link href="/dashboard/chat">
                        <Button className="gap-2 shadow-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
                            <MessageSquare className="h-4 w-4" />
                            Abrir Chat ao Vivo
                        </Button>
                    </Link>
                    <Link href="/dashboard/sessions">
                        <Button variant="outline" size="icon" title="Nova Sessão WhatsApp" className="border-border/60 hover:bg-muted">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Grid Principal de KPIs / Estatísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total de Atendimentos */}
                <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Atendimentos Totais</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{totalAttendances}</p>
                                <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5 text-blue-500" />
                                    Clientes únicos atendidos
                                </p>
                            </div>
                            <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2.5 rounded-xl border border-blue-500/20">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Total de Mensagens */}
                <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total de Mensagens</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{totalMessages}</p>
                                <div className="flex items-center gap-2 text-[11px] font-medium pt-0.5">
                                    <span className="text-primary flex items-center" title="Enviadas por atendentes">
                                        <ArrowUpRight className="h-3 w-3" /> {totalSent} env
                                    </span>
                                    <span className="text-blue-600 flex items-center" title="Recebidas de clientes">
                                        <ArrowDownLeft className="h-3 w-3" /> {totalReceived} rec
                                    </span>
                                </div>
                            </div>
                            <div className="bg-primary/10 text-primary p-2.5 rounded-xl border border-primary/20">
                                <Send className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Contatos Cadastrados */}
                <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-amber-500/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agenda de Contatos</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{totalContacts}</p>
                                <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                    <Tag className="h-3.5 w-3.5 text-amber-500" />
                                    Clientes registrados
                                </p>
                            </div>
                            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-xl border border-amber-500/20">
                                <UserCheck className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Sessões e Atendentes Online */}
                <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-300">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sessões / WhatsApp</p>
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{connectedSessions}</p>
                                    <span className="text-xs text-muted-foreground font-medium">/ {totalSessions} ativas</span>
                                </div>
                                <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                    {disconnectedSessions > 0 ? (
                                        <span className="text-amber-600 dark:text-amber-400">{disconnectedSessions} desconectada(s)</span>
                                    ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Todas online</span>
                                    )}
                                </p>
                            </div>
                            <div className={`${connectedSessions > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} p-2.5 rounded-xl border`}>
                                {connectedSessions > 0 ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Desempenho e Produtividade por Atendente / Sessão */}
            <Card className="glass-panel border-border/50 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Desempenho por Atendente / Sessão
                            </CardTitle>
                            <CardDescription>
                                Quantidade de clientes atendidos, mensagens enviadas e taxa de resposta de cada número
                            </CardDescription>
                        </div>
                        <Link href="/dashboard/sessions">
                            <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                                Gerenciar Conexões <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {sessionStats.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <QrCode className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-medium">Nenhuma sessão cadastrada</p>
                            <Link href="/dashboard/sessions" className="text-xs text-primary hover:underline mt-1 inline-block">
                                Conectar WhatsApp agora
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {sessionStats.map((s) => {
                                const isConnected = s.status === 'CONNECTED';
                                return (
                                    <div key={s.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                                        {/* Informações da Sessão */}
                                        <div className="flex items-center gap-3.5 min-w-[220px]">
                                            <div className="relative">
                                                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-blue-500/20 flex items-center justify-center text-primary font-bold text-base border border-primary/20 shadow-xs">
                                                    {s.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span 
                                                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                                                        isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
                                                    }`} 
                                                    title={isConnected ? 'Conectado e Online' : 'Desconectado'}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-sm text-foreground truncate">{s.name}</h4>
                                                    <Badge 
                                                        variant={isConnected ? "default" : "secondary"}
                                                        className={`text-[10px] px-2 py-0 h-5 font-semibold ${
                                                            isConnected 
                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                                                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                                                        }`}
                                                    >
                                                        {isConnected ? "ONLINE" : "OFFLINE"}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                                                    ID: {s.sessionId}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Métricas do Atendente */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-xl">
                                            {/* Atendimentos Únicos */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                                    <Users className="h-3 w-3 text-primary" /> Clientes
                                                </span>
                                                <p className="text-lg font-bold text-foreground">
                                                    {s.attendancesCount}
                                                    <span className="text-[11px] font-normal text-muted-foreground ml-1">atend.</span>
                                                </p>
                                            </div>

                                            {/* Enviadas */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                                    <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Enviadas
                                                </span>
                                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                    {s.sentCount}
                                                </p>
                                            </div>

                                            {/* Recebidas */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                                    <ArrowDownLeft className="h-3 w-3 text-blue-500" /> Recebidas
                                                </span>
                                                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                    {s.receivedCount}
                                                </p>
                                            </div>

                                            {/* Taxa de Resposta / Atividade */}
                                            <div className="space-y-1">
                                                <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                                    <span>Taxa Ativ.</span>
                                                    <span className="font-semibold text-foreground">{s.responseRate}%</span>
                                                </span>
                                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                        className="bg-primary h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(s.responseRate, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ações Rápidas da Sessão */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Link href={`/dashboard/chat?session=${s.sessionId}`}>
                                                <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold h-8 cursor-pointer">
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    Abrir Chat
                                                </Button>
                                            </Link>
                                            <Link href={`/dashboard/sessions/${s.sessionId}`}>
                                                <Button size="sm" variant="outline" className="text-xs h-8 cursor-pointer" title="Configurações desta sessão">
                                                    <Settings className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Linha com Gráfico Semanal + Feed de Últimos Atendimentos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico Visual: Volume de Mensagens Últimos 7 Dias */}
                <Card className="glass-panel border-border/50 shadow-xs lg:col-span-2">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    Volume de Atendimentos nos Últimos 7 Dias
                                </CardTitle>
                                <CardDescription>Fluxo diário de mensagens enviadas e recebidas</CardDescription>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-primary" /> Enviadas
                                </span>
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                    <span className="h-2.5 w-2.5 rounded-xs bg-blue-400" /> Recebidas
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-end justify-between gap-2 h-44 px-2">
                            {past7DaysData.map((d, idx) => {
                                const heightPercent = Math.max(Math.round((d.total / maxDayTotal) * 100), 8);
                                const sentHeightPercent = d.total > 0 ? Math.round((d.sent / d.total) * 100) : 50;

                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                            {d.total} msgs
                                        </div>
                                        <div 
                                            className="w-full max-w-[38px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:scale-105 shadow-xs"
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            {/* Recebidas (topo) */}
                                            <div 
                                                className="bg-blue-400/80 hover:bg-blue-400 transition-colors"
                                                style={{ height: `${100 - sentHeightPercent}%` }}
                                                title={`Recebidas: ${d.received}`}
                                            />
                                            {/* Enviadas (base) */}
                                            <div 
                                                className="bg-primary hover:bg-primary/90 transition-colors"
                                                style={{ height: `${sentHeightPercent}%` }}
                                                title={`Enviadas: ${d.sent}`}
                                            />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-foreground">{d.day}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{d.dateStr}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Feed de Últimos Atendimentos */}
                <Card className="glass-panel border-border/50 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                Atendimentos Recentes
                            </CardTitle>
                            <Link href="/dashboard/chat" className="text-xs text-primary hover:underline font-medium">
                                Ver todos
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentMessages.length === 0 ? (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                Nenhuma conversa recente.
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
                                            className="p-3.5 flex items-start gap-3 hover:bg-muted/40 transition-colors block"
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
                                                            border: `1px solid ${label.colorHex}30`
                                                        }}
                                                    >
                                                        <Tag className="h-2.5 w-2.5" />
                                                        {label.name}
                                                    </span>
                                                )}

                                                <p className="text-xs text-muted-foreground truncate">
                                                    {msg.fromMe ? <span className="text-primary font-medium">Você: </span> : null}
                                                    {msg.content || (msg.type !== 'TEXT' ? `[${msg.type.toLowerCase()}]` : "")}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Ações Rápidas e Acessos Diretos */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Acesso Rápido às Funcionalidades
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link key={action.href} href={action.href}>
                                <Card className="glass-panel border-border/50 shadow-xs hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer h-full">
                                    <CardContent className="p-3.5 flex flex-col justify-between h-full gap-2">
                                        <div className="bg-primary/10 text-primary p-2.5 rounded-xl w-fit group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-xs">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{action.description}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
