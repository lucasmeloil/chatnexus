"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Activity,
    Clock,
    Users,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Zap,
    RefreshCw,
    Download,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    Flame,
    Award,
    Smile,
    ShieldCheck,
    MessageSquare,
    Radio,
    SlidersHorizontal,
    PhoneCall,
    Sparkles,
    BarChart3,
    Calendar,
    CheckCheck,
    Mic,
    Image as ImageIcon,
    FileText,
    SmilePlus,
    Smartphone,
    UserCheck
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useSocket } from "@/components/chat/socket-context";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    Cell,
    PieChart,
    Pie
} from "recharts";
import { toast } from "sonner";
import Link from "next/link";
import { DashboardMetricsResult } from "@/lib/dashboard-metrics";

interface AnalyticsDashboardProps {
    initialData?: DashboardMetricsResult;
}

const HEATMAP_SLOTS = ["00h - 04h", "04h - 08h", "08h - 12h", "12h - 16h", "16h - 20h", "20h - 24h"];
const HEATMAP_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DEPT_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];
const MEDIA_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e"];

export function AnalyticsDashboard({ initialData }: AnalyticsDashboardProps) {
    const { socket } = useSocket();

    // Filtros e controles
    const [selectedSession, setSelectedSession] = useState<string>("all");
    const [period, setPeriod] = useState<string>("7d");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [attendantSearch, setAttendantSearch] = useState<string>("");
    const [sortBy, setSortBy] = useState<"total" | "closed" | "inProgress" | "waitTime" | "resolution">("total");

    // Live Sync
    const [liveSyncEnabled, setLiveSyncEnabled] = useState<boolean>(true);
    const [syncIntervalSeconds, setSyncIntervalSeconds] = useState<number>(30);
    const [isLoading, setIsLoading] = useState<boolean>(!initialData);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date>(
        initialData ? new Date(initialData.lastUpdated) : new Date()
    );

    // Dados do Dashboard
    const [metrics, setMetrics] = useState<DashboardMetricsResult | null>(initialData || null);

    // Active chart view
    const [chartMode, setChartMode] = useState<"flow" | "messages" | "wait">("flow");

    // Buscar dados da API
    const fetchMetrics = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsRefreshing(true);
        try {
            const params = new URLSearchParams({
                sessionId: selectedSession,
                period,
                department: selectedDepartment,
            });

            const res = await fetch(`/api/dashboard/metrics?${params.toString()}`, {
                cache: "no-store",
            });
            const json = await res.json().catch(() => null);

            if (json?.status && json?.data) {
                setMetrics(json.data);
                setLastSyncTime(new Date());
            } else if (json) {
                if (!isSilent) toast.error(json.message || "Erro ao carregar métricas");
            }
        } catch (error) {
            console.error("Fetch metrics error:", error);
            if (!isSilent) toast.error("Falha ao comunicar com o servidor de métricas");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedSession, period, selectedDepartment]);

    // Atualizar quando os filtros mudarem
    useEffect(() => {
        fetchMetrics(false);
    }, [fetchMetrics]);

    // Polling automático (Live Sync)
    useEffect(() => {
        if (!liveSyncEnabled || syncIntervalSeconds <= 0) return;

        const interval = setInterval(() => {
            fetchMetrics(true);
        }, syncIntervalSeconds * 1000);

        return () => clearInterval(interval);
    }, [liveSyncEnabled, syncIntervalSeconds, fetchMetrics]);

    // Integração com Socket.io em tempo real
    useEffect(() => {
        if (!socket) return;

        const handleRealtimeUpdate = () => {
            if (liveSyncEnabled) {
                fetchMetrics(true);
            }
        };

        socket.on("attendance.update", handleRealtimeUpdate);
        socket.on("message.received", handleRealtimeUpdate);
        socket.on("message.sent", handleRealtimeUpdate);

        return () => {
            socket.off("attendance.update", handleRealtimeUpdate);
            socket.off("message.received", handleRealtimeUpdate);
            socket.off("message.sent", handleRealtimeUpdate);
        };
    }, [socket, liveSyncEnabled, fetchMetrics]);

    // Ordenação e filtro de atendentes
    const sortedAttendants = useMemo(() => {
        if (!metrics?.attendants) return [];

        let list = [...metrics.attendants];

        if (attendantSearch.trim()) {
            const term = attendantSearch.toLowerCase();
            list = list.filter(
                (a) => a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term)
            );
        }

        list.sort((a, b) => {
            if (sortBy === "closed") return b.closed - a.closed;
            if (sortBy === "inProgress") return b.inProgress - a.inProgress;
            if (sortBy === "waitTime") return a.avgWaitMinutes - b.avgWaitMinutes;
            if (sortBy === "resolution") return b.resolutionRate - a.resolutionRate;
            return b.totalAssigned - a.totalAssigned;
        });

        return list;
    }, [metrics?.attendants, attendantSearch, sortBy]);

    // Exportar dados do dashboard em formato Excel (.xls) moderno e colorido
    const handleExportExcel = () => {
        if (!metrics) return;

        const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
        const timeStr = new Date().toLocaleTimeString("pt-BR");
        const periodLabel = period === "today" ? "Hoje (24h)" : period === "30d" ? "Últimos 30 dias" : period === "all" ? "Geral (Todo Histórico)" : "Últimos 7 dias";
        const s = metrics.summary;

        // Montar linhas dos atendentes
        const attendantsRows = (metrics.attendants || []).map((att, i) => `
            <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
                <td class="${i === 0 ? 'badge-gold' : 'td-center'}">${i === 0 ? '★ #1 Líder' : `#${i + 1}`}</td>
                <td class="td-text" style="font-weight: bold;">${att.name}</td>
                <td class="td-text">${att.email}</td>
                <td class="td-num" style="font-weight: bold;">${att.totalAssigned}</td>
                <td class="td-center">${att.demandShare}%</td>
                <td class="badge-blue">${att.inProgress}</td>
                <td class="badge-green">${att.closed}</td>
                <td class="badge-green">${att.resolutionRate}%</td>
                <td class="td-center">${att.avgWaitMinutes} min</td>
                <td class="td-num">${att.sentCount}</td>
            </tr>
        `).join("");

        // Montar linhas dos tipos de mídia
        const mediaRows = (metrics.messageTypes || []).map((mt, i) => `
            <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
                <td class="td-text" style="font-weight: bold;">${mt.label}</td>
                <td class="td-num">${mt.count.toLocaleString("pt-BR")}</td>
                <td class="td-center" style="font-weight: bold;">${mt.percentage}%</td>
            </tr>
        `).join("");

        // Montar linhas dos departamentos
        const deptRows = (metrics.departments || []).map((d, i) => `
            <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
                <td class="td-text" style="font-weight: bold;">${d.name}</td>
                <td class="td-num">${d.count.toLocaleString("pt-BR")}</td>
                <td class="td-center" style="font-weight: bold;">${d.percentage}%</td>
            </tr>
        `).join("");

        // Montar linhas dos top clientes
        const clientRows = (metrics.topCustomers || []).map((c, i) => `
            <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
                <td class="td-center">#${i + 1}</td>
                <td class="td-text" style="font-weight: bold;">${c.name}</td>
                <td class="td-center" style="font-family: monospace;">${c.phone}</td>
                <td class="td-num" style="font-weight: bold; color: #2563EB;">${c.messageCount.toLocaleString("pt-BR")} msgs</td>
            </tr>
        `).join("");

        // Montar linhas de sessões
        const sessionRows = (metrics.sessionBreakdown || []).map((sess, i) => `
            <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
                <td class="td-text" style="font-weight: bold;">${sess.name}</td>
                <td class="td-center" style="font-family: monospace;">${sess.sessionId}</td>
                <td class="${sess.status === 'CONNECTED' ? 'badge-green' : 'badge-amber'}">${sess.status === 'CONNECTED' ? 'ONLINE' : 'OFFLINE'}</td>
                <td class="td-num" style="font-weight: bold;">${sess.uniqueCustomers}</td>
                <td class="td-num">${sess.sent.toLocaleString("pt-BR")}</td>
                <td class="td-num">${sess.received.toLocaleString("pt-BR")}</td>
            </tr>
        `).join("");

        const excelContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>Painel Analítico</x:Name>
        <x:WorksheetOptions>
          <x:DisplayGridlines/>
        </x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; background: #FFFFFF; }
  .banner-title { background: #1E3A8A; color: #FFFFFF; font-size: 15pt; font-weight: bold; text-align: center; height: 38px; vertical-align: middle; }
  .banner-sub { background: #2563EB; color: #FFFFFF; font-size: 9.5pt; text-align: center; height: 24px; vertical-align: middle; }
  .section-hdr { background: #0F172A; color: #FFFFFF; font-size: 10.5pt; font-weight: bold; height: 28px; vertical-align: middle; padding-left: 8px; }
  .kpi-lbl { background: #F1F5F9; color: #475569; font-weight: bold; font-size: 9pt; border: 1px solid #CBD5E1; padding: 5px; height: 22px; }
  .kpi-val { background: #FFFFFF; color: #0F172A; font-weight: bold; font-size: 11pt; text-align: center; border: 1px solid #CBD5E1; height: 26px; }
  .th-blue { background: #2563EB; color: #FFFFFF; font-weight: bold; font-size: 9pt; text-align: center; border: 1px solid #1D4ED8; height: 26px; vertical-align: middle; }
  .th-emerald { background: #059669; color: #FFFFFF; font-weight: bold; font-size: 9pt; text-align: center; border: 1px solid #047857; height: 26px; vertical-align: middle; }
  .th-purple { background: #7C3AED; color: #FFFFFF; font-weight: bold; font-size: 9pt; text-align: center; border: 1px solid #6D28D9; height: 26px; vertical-align: middle; }
  .td-text { font-size: 9pt; color: #1E293B; border: 1px solid #CBD5E1; padding: 4px 6px; vertical-align: middle; }
  .td-num { font-size: 9pt; color: #1E293B; text-align: right; border: 1px solid #CBD5E1; padding: 4px 6px; vertical-align: middle; }
  .td-center { font-size: 9pt; color: #1E293B; text-align: center; border: 1px solid #CBD5E1; padding: 4px 6px; vertical-align: middle; }
  .td-zebra { background: #F8FAFC; }
  .badge-green { background: #DCFCE7; color: #166534; font-weight: bold; text-align: center; border: 1px solid #BBF7D0; font-size: 9pt; vertical-align: middle; }
  .badge-blue { background: #DBEAFE; color: #1E40AF; font-weight: bold; text-align: center; border: 1px solid #BFDBFE; font-size: 9pt; vertical-align: middle; }
  .badge-amber { background: #FEF3C7; color: #92400E; font-weight: bold; text-align: center; border: 1px solid #FDE68A; font-size: 9pt; vertical-align: middle; }
  .badge-gold { background: #FEF08A; color: #854D0E; font-weight: bold; text-align: center; border: 1px solid #FDE047; font-size: 9pt; vertical-align: middle; }
</style>
</head>
<body>
<table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
  <tr>
    <td colspan="10" class="banner-title">RELATÓRIO OPERACIONAL E ANALÍTICO • NEXUS CHAT ENTERPRISE</td>
  </tr>
  <tr>
    <td colspan="10" class="banner-sub">Período: ${periodLabel} | Gerado em: ${dateStr} às ${timeStr} | Instância Oficial</td>
  </tr>
  <tr><td colspan="10" style="height: 12px;"></td></tr>

  <!-- SEÇÃO 1: RESUMO EXECUTIVO (KPIS) -->
  <tr>
    <td colspan="10" class="section-hdr">1. RESUMO EXECUTIVO DE INDICADORES OPERACIONAIS (KPIS)</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Atendimentos Totais:</td>
    <td class="kpi-val" colspan="3">${s.totalAttendances}</td>
    <td class="kpi-lbl" colspan="2">Tempo Médio Espera:</td>
    <td class="kpi-val" colspan="3">${s.avgWaitTimeMinutes} min</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Em Aberto (Fila Espera):</td>
    <td class="kpi-val" style="color: #D97706;" colspan="3">${s.waiting}</td>
    <td class="kpi-lbl" colspan="2">Cumprimento de SLA:</td>
    <td class="kpi-val" style="color: #2563EB;" colspan="3">${s.slaComplianceRate}% (&lt; 5m)</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Em Andamento (Ativos):</td>
    <td class="kpi-val" style="color: #2563EB;" colspan="3">${s.inProgress}</td>
    <td class="kpi-lbl" colspan="2">Satisfação do Cliente (CSAT):</td>
    <td class="kpi-val" style="color: #059669;" colspan="3">${s.csatScore} / 5.0 (${s.csatRating})</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Atendimentos Finalizados:</td>
    <td class="kpi-val" style="color: #059669;" colspan="3">${s.closed}</td>
    <td class="kpi-lbl" colspan="2">Índice NPS Estimado:</td>
    <td class="kpi-val" style="color: #7C3AED;" colspan="3">+${s.npsScore} pts</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Total Mensagens Trocadas:</td>
    <td class="kpi-val" colspan="3">${s.totalMessages.toLocaleString("pt-BR")}</td>
    <td class="kpi-lbl" colspan="2">Taxa Real de Entrega:</td>
    <td class="kpi-val" style="color: #059669;" colspan="3">${s.deliveryRate}%</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Mensagens Enviadas / Recebidas:</td>
    <td class="kpi-val" colspan="3">${s.sentMessages.toLocaleString("pt-BR")} env / ${s.receivedMessages.toLocaleString("pt-BR")} rec</td>
    <td class="kpi-lbl" colspan="2">Taxa Real de Leitura (Read):</td>
    <td class="kpi-val" style="color: #2563EB;" colspan="3">${s.readRate}%</td>
  </tr>
  <tr>
    <td class="kpi-lbl" colspan="2">Clientes Únicos Atendidos:</td>
    <td class="kpi-val" colspan="3">${s.uniqueCustomersCount}</td>
    <td class="kpi-lbl" colspan="2">Grupos Ativos / Agenda:</td>
    <td class="kpi-val" colspan="3">${s.uniqueGroupsCount} grupos / ${s.totalContactsCount} contatos</td>
  </tr>
  <tr><td colspan="10" style="height: 16px;"></td></tr>

  <!-- SEÇÃO 2: PRODUTIVIDADE DOS ATENDENTES -->
  <tr>
    <td colspan="10" class="section-hdr">2. RANKING DE PRODUTIVIDADE & DEMANDA DOS ATENDENTES</td>
  </tr>
  <tr>
    <th class="th-blue" style="width: 80px;">Posição</th>
    <th class="th-blue" style="width: 180px;">Nome do Operador</th>
    <th class="th-blue" style="width: 220px;">E-mail Corporativo</th>
    <th class="th-blue" style="width: 100px;">Demandas</th>
    <th class="th-blue" style="width: 90px;">Fatia (%)</th>
    <th class="th-blue" style="width: 90px;">Ativos</th>
    <th class="th-blue" style="width: 100px;">Finalizados</th>
    <th class="th-blue" style="width: 100px;">Taxa Resol.</th>
    <th class="th-blue" style="width: 100px;">TME Espera</th>
    <th class="th-blue" style="width: 110px;">Msgs Enviadas</th>
  </tr>
  ${attendantsRows || '<tr><td colspan="10" class="td-center">Nenhum operador com atendimentos no período.</td></tr>'}
  <tr><td colspan="10" style="height: 16px;"></td></tr>

  <!-- SEÇÃO 3: FORMATOS DE MÍDIA & DEPARTAMENTOS -->
  <tr>
    <td colspan="5" class="section-hdr">3. DISTRIBUIÇÃO POR TIPOS DE MÍDIA</td>
    <td colspan="5" class="section-hdr">4. DEMANDAS POR DEPARTAMENTO</td>
  </tr>
  <tr>
    <th colspan="2" class="th-purple">Tipo de Mídia</th>
    <th colspan="2" class="th-purple">Volume</th>
    <th class="th-purple">Proporção</th>
    <th colspan="2" class="th-emerald">Departamento / Tag</th>
    <th colspan="2" class="th-emerald">Chamados</th>
    <th class="th-emerald">Proporção</th>
  </tr>
  ${(metrics.messageTypes || []).map((mt, i) => {
      const dept = (metrics.departments || [])[i];
      return `
        <tr class="${i % 2 === 1 ? 'td-zebra' : ''}">
          <td colspan="2" class="td-text" style="font-weight: bold;">${mt.label}</td>
          <td colspan="2" class="td-num">${mt.count.toLocaleString("pt-BR")}</td>
          <td class="td-center" style="font-weight: bold;">${mt.percentage}%</td>
          <td colspan="2" class="td-text" style="font-weight: bold;">${dept ? dept.name : '-'}</td>
          <td colspan="2" class="td-num">${dept ? dept.count.toLocaleString("pt-BR") : '-'}</td>
          <td class="td-center" style="font-weight: bold;">${dept ? `${dept.percentage}%` : '-'}</td>
        </tr>
      `;
  }).join("")}
  <tr><td colspan="10" style="height: 16px;"></td></tr>

  <!-- SEÇÃO 4: TOP CLIENTES -->
  <tr>
    <td colspan="10" class="section-hdr">5. CLIENTES COM MAIOR VOLUME DE DEMANDAS</td>
  </tr>
  <tr>
    <th class="th-blue" style="width: 80px;">Posição</th>
    <th colspan="4" class="th-blue">Nome / Identificação do Cliente</th>
    <th colspan="3" class="th-blue">Telefone / WhatsApp</th>
    <th colspan="2" class="th-blue">Mensagens Trocadas</th>
  </tr>
  ${clientRows || '<tr><td colspan="10" class="td-center">Nenhuma conversa registrada.</td></tr>'}
  <tr><td colspan="10" style="height: 16px;"></td></tr>

  <!-- SEÇÃO 5: DESEMPENHO POR LINHA WHATSAPP -->
  <tr>
    <td colspan="10" class="section-hdr">6. DESEMPENHO POR LINHA / CONEXÃO WHATSAPP</td>
  </tr>
  <tr>
    <th colspan="3" class="th-blue">Nome da Linha</th>
    <th colspan="2" class="th-blue">ID da Sessão</th>
    <th class="th-blue">Status</th>
    <th class="th-blue">Clientes Únicos</th>
    <th colspan="2" class="th-blue">Mensagens Enviadas</th>
    <th class="th-blue">Mensagens Recebidas</th>
  </tr>
  ${sessionRows || '<tr><td colspan="10" class="td-center">Nenhuma sessão registrada.</td></tr>'}
</table>
</body>
</html>
        `;

        const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", url);
        downloadAnchor.setAttribute("download", `Relatorio_Atendimento_NEXUS_CHAT_${period}_${dateStr}.xls`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        URL.revokeObjectURL(url);
        toast.success("Planilha Excel (.xls) gerada e baixada com sucesso!");
    };

    if (isLoading && !metrics) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">
                    Carregando inteligência e métricas em tempo real...
                </p>
            </div>
        );
    }

    const summary = metrics?.summary || {
        totalAttendances: 0,
        waiting: 0,
        inProgress: 0,
        closed: 0,
        totalMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        avgWaitTimeMinutes: 0,
        avgResponseTimeMinutes: 0,
        avgResolutionTimeMinutes: 0,
        slaComplianceRate: 100,
        csatScore: 5.0,
        csatPercentage: 100,
        csatRating: "Excelente",
        npsScore: 85,
        uniqueCustomersCount: 0,
        uniqueGroupsCount: 0,
        totalContactsCount: 0,
        newContactsInPeriod: 0,
        readRate: 100,
        deliveryRate: 100,
    };

    const sla = metrics?.slaDistribution || { under1m: 0, between1and5m: 0, between5and15m: 0, over15m: 0 };
    const totalSla = sla.under1m + sla.between1and5m + sla.between5and15m + sla.over15m || 1;

    return (
        <div className="space-y-6 pb-12">
            {/* Header com Barra de Controles e Status Estável Sem Piscamento */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-blue-500/10 border border-primary/20 p-5 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Título e Status */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-400/40" />
                                {liveSyncEnabled ? "Sincronização Ativa" : "Pausado"}
                            </span>

                            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Atualizado: {lastSyncTime.toLocaleTimeString("pt-BR")}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                            Dashboard Analítico de Atendimento
                            <Sparkles className="h-5 w-5 text-amber-500" />
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                            Visão panorâmica com telemetria 100% real: fluxo operacional, produtividade dos atendentes, tempo de resposta, canais e mídias.
                        </p>
                    </div>

                    {/* Ações e Controles de Sincronização */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Seletor de Período */}
                        <div className="flex items-center bg-background/80 backdrop-blur-md rounded-xl p-1 border border-border/60 shadow-xs">
                            {(["today", "7d", "30d", "all"] as const).map((p) => {
                                const labels: Record<string, string> = {
                                    today: "Hoje",
                                    "7d": "7 dias",
                                    "30d": "30 dias",
                                    all: "Geral",
                                };
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                            period === p
                                                ? "bg-primary text-primary-foreground shadow-xs"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        }`}
                                    >
                                        {labels[p]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Botão Sincronizar Agora */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchMetrics(false)}
                            disabled={isRefreshing}
                            className="gap-2 border-border/70 hover:bg-primary/10 hover:border-primary/40 font-medium text-xs h-9 cursor-pointer"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                            Atualizar
                        </Button>

                        {/* Exportar Excel */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportExcel}
                            title="Exportar Relatório em Planilha Excel com Tabelas Modernas e Coloridas"
                            className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/60 font-semibold text-xs h-9 cursor-pointer shadow-2xs"
                        >
                            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            Baixar Excel
                        </Button>
                    </div>
                </div>

                {/* Filtros Secundários: Sessão e Departamento */}
                <div className="mt-4 pt-3 border-t border-border/30 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Filter className="h-3.5 w-3.5 text-primary" /> Filtrar por:
                    </span>

                    {/* Filtro de Sessão WhatsApp */}
                    <select
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="bg-background/90 border border-border/70 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                    >
                        <option value="all">Todas as Sessões ({metrics?.sessions.length || 0})</option>
                        {metrics?.sessions.map((sess) => (
                            <option key={sess.id} value={sess.id}>
                                {sess.name} ({sess.status === "CONNECTED" ? "Online" : "Offline"})
                            </option>
                        ))}
                    </select>

                    {/* Filtro de Departamento */}
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="bg-background/90 border border-border/70 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                    >
                        <option value="all">Todos os Departamentos</option>
                        {metrics?.departments.map((dept) => (
                            <option key={dept.name} value={dept.name}>
                                {dept.name} ({dept.count})
                            </option>
                        ))}
                    </select>

                    {/* Toggle Live Sync */}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-muted-foreground">Auto-refresh:</span>
                        <select
                            value={syncIntervalSeconds}
                            onChange={(e) => setSyncIntervalSeconds(Number(e.target.value))}
                            className="bg-background/90 border border-border/70 rounded-lg px-2 py-1 text-xs font-medium cursor-pointer"
                        >
                            <option value={10}>10s</option>
                            <option value={30}>30s</option>
                            <option value={60}>1 min</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid 1: Cards Principais de Indicadores Operacionais */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Em Fila de Espera (Abertos) */}
                <Card className={`glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md ${
                    summary.waiting > 0 ? "border-amber-500/40 bg-amber-500/5" : ""
                }`}>
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Em Aberto (Fila)
                            </span>
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.waiting}
                                </span>
                                {summary.waiting > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                        Aguardando
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Clientes aguardando operador
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Em Andamento */}
                <Card className="glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md border-blue-500/30 bg-blue-500/5">
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Em Andamento
                            </span>
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.inProgress}
                                </span>
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                    Ativos
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Sendo atendidos neste instante
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Finalizados */}
                <Card className="glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Finalizados
                            </span>
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.closed}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    {summary.totalAttendances > 0
                                        ? `${Math.round((summary.closed / summary.totalAttendances) * 100)}%`
                                        : "100%"}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Atendimentos concluídos
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Tempo Médio de Espera */}
                <Card className="glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Tempo Médio Espera
                            </span>
                            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Zap className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.avgWaitTimeMinutes}
                                </span>
                                <span className="text-xs text-muted-foreground font-semibold">min</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                {summary.avgWaitTimeMinutes <= 3 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                                        <TrendingDown className="h-3 w-3 mr-0.5" /> Fila ágil
                                    </span>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center">
                                        <TrendingUp className="h-3 w-3 mr-0.5" /> Atenção à fila
                                    </span>
                                )}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Nível de Serviço (SLA < 5m) */}
                <Card className="glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Cumprimento SLA
                            </span>
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.slaComplianceRate}%
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div
                                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, summary.slaComplianceRate)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Resposta em &lt; 5 min
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 6. Satisfação do Cliente (CSAT) */}
                <Card className="glass-panel border-border/50 shadow-xs transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Satisfação (CSAT)
                            </span>
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <Smile className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                    {summary.csatScore}
                                </span>
                                <span className="text-xs text-muted-foreground font-semibold">/ 5.0</span>
                            </div>
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                                <Award className="h-3 w-3" /> {summary.csatRating} ({summary.csatPercentage}%)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Grid 1.5: Painel de Telemetria de Comunicação & Entregas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Clientes Únicos */}
                <div className="p-3.5 rounded-xl bg-background/60 border border-border/50 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Users className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Clientes Atendidos</p>
                        <p className="text-lg font-bold text-foreground">{summary.uniqueCustomersCount}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{summary.uniqueGroupsCount} grupos ativos</p>
                    </div>
                </div>

                {/* Mensagens Trocadas */}
                <div className="p-3.5 rounded-xl bg-background/60 border border-border/50 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Total de Mensagens</p>
                        <p className="text-lg font-bold text-foreground">{summary.totalMessages}</p>
                        <p className="text-[10px] text-muted-foreground">
                            {summary.sentMessages} env / {summary.receivedMessages} rec
                        </p>
                    </div>
                </div>

                {/* Taxa de Entrega WhatsApp */}
                <div className="p-3.5 rounded-xl bg-background/60 border border-border/50 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCheck className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Taxa de Entrega</p>
                        <p className="text-lg font-bold text-foreground">{summary.deliveryRate}%</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Entregues no WhatsApp</p>
                    </div>
                </div>

                {/* Taxa de Leitura Real */}
                <div className="p-3.5 rounded-xl bg-background/60 border border-border/50 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Taxa de Leitura (Read)</p>
                        <p className="text-lg font-bold text-foreground">{summary.readRate}%</p>
                        <p className="text-[10px] text-purple-600 font-medium">Lidas pelos clientes</p>
                    </div>
                </div>
            </div>

            {/* Grid 2: Gráficos de Tendência & Níveis de Resposta / SLA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico 1: Área/Linhas de Tendência Interativo */}
                <Card className="glass-panel border-border/50 shadow-xs lg:col-span-2">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    Tendências de Atendimento & Demanda
                                </CardTitle>
                                <CardDescription>
                                    Evolução temporal do volume de conversas, fila e tempo de resposta
                                </CardDescription>
                            </div>

                            {/* Alternador de Modo do Gráfico */}
                            <div className="flex items-center bg-muted/60 p-1 rounded-xl text-xs">
                                <button
                                    onClick={() => setChartMode("flow")}
                                    className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                                        chartMode === "flow" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                                    }`}
                                >
                                    Status
                                </button>
                                <button
                                    onClick={() => setChartMode("messages")}
                                    className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                                        chartMode === "messages" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                                    }`}
                                >
                                    Mensagens
                                </button>
                                <button
                                    onClick={() => setChartMode("wait")}
                                    className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                                        chartMode === "wait" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                                    }`}
                                >
                                    Tempo Espera
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartMode === "flow" ? (
                                    <AreaChart data={metrics?.timeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorWaiting" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                        <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} />
                                        <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "rgba(15, 23, 42, 0.9)",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                color: "#fff",
                                                fontSize: "12px",
                                            }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Area type="monotone" dataKey="inProgress" name="Em Andamento" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorInProgress)" />
                                        <Area type="monotone" dataKey="closed" name="Finalizados" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClosed)" />
                                        <Area type="monotone" dataKey="waiting" name="Fila de Espera" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorWaiting)" />
                                    </AreaChart>
                                ) : chartMode === "messages" ? (
                                    <BarChart data={metrics?.timeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                        <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} />
                                        <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "rgba(15, 23, 42, 0.9)",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                color: "#fff",
                                                fontSize: "12px",
                                            }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Bar dataKey="sent" name="Enviadas (Atendente)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="received" name="Recebidas (Cliente)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                ) : (
                                    <LineChart data={metrics?.timeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                        <XAxis dataKey="time" stroke="#888888" fontSize={11} tickLine={false} />
                                        <YAxis stroke="#888888" fontSize={11} tickLine={false} unit=" min" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "rgba(15, 23, 42, 0.9)",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                color: "#fff",
                                                fontSize: "12px",
                                            }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" />
                                        <Line type="monotone" dataKey="avgWaitMinutes" name="Tempo Médio de Espera (minutos)" stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 2: Níveis de SLA & Velocidade de Resposta */}
                <Card className="glass-panel border-border/50 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-purple-500" />
                            Níveis de Atendimento (SLA)
                        </CardTitle>
                        <CardDescription>
                            Distribuição dos atendimentos por tempo até a primeira resposta
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                        {/* Nível 1: < 1 min */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Instantâneo (&lt; 1 min)
                                </span>
                                <span>{Math.round((sla.under1m / totalSla) * 100)}% ({sla.under1m})</span>
                            </div>
                            <Progress value={(sla.under1m / totalSla) * 100} className="h-2 bg-muted [&>div]:bg-emerald-500" />
                        </div>

                        {/* Nível 2: 1 a 5 min */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                                    Na Meta (1 a 5 min)
                                </span>
                                <span>{Math.round((sla.between1and5m / totalSla) * 100)}% ({sla.between1and5m})</span>
                            </div>
                            <Progress value={(sla.between1and5m / totalSla) * 100} className="h-2 bg-muted [&>div]:bg-blue-500" />
                        </div>

                        {/* Nível 3: 5 a 15 min */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                    Tolerável (5 a 15 min)
                                </span>
                                <span>{Math.round((sla.between5and15m / totalSla) * 100)}% ({sla.between5and15m})</span>
                            </div>
                            <Progress value={(sla.between5and15m / totalSla) * 100} className="h-2 bg-muted [&>div]:bg-amber-500" />
                        </div>

                        {/* Nível 4: > 15 min */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="flex items-center gap-1.5 text-red-500">
                                    <span className="h-2 w-2 rounded-full bg-red-500" />
                                    Crítico (&gt; 15 min)
                                </span>
                                <span>{Math.round((sla.over15m / totalSla) * 100)}% ({sla.over15m})</span>
                            </div>
                            <Progress value={(sla.over15m / totalSla) * 100} className="h-2 bg-muted [&>div]:bg-red-500" />
                        </div>

                        {/* Resumo da Taxa de Satisfação */}
                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mt-4 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                                <span>Índice NPS Estimado</span>
                                <span>+{summary.npsScore} pts (Zona de Excelência)</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Calculado a partir da rapidez no primeiro contato e resolução sem abandono.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Grid 3: Mapa de Calor ESTÁVEL (SEM PISCAMENTO) & Tipos de Mensagens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Mapa de Calor de Horários de Pico */}
                <Card className="glass-panel border-border/50 shadow-xs lg:col-span-2">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                    Mapa de Calor: Demandas & Horários de Pico
                                </CardTitle>
                                <CardDescription>
                                    Densidade e concentração real de mensagens por dia da semana e faixa horária
                                </CardDescription>
                            </div>

                            {/* Legenda de Calor Estável */}
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                <span>Baixo</span>
                                <span className="h-3 w-3 rounded bg-blue-500/20" />
                                <span className="h-3 w-3 rounded bg-indigo-500/40" />
                                <span className="h-3 w-3 rounded bg-purple-600/70" />
                                <span className="h-3 w-3 rounded bg-rose-500" />
                                <span>Pico</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 overflow-x-auto">
                        <div className="min-w-[550px]">
                            {/* Grid do Heatmap */}
                            <div className="grid grid-cols-7 gap-2">
                                {/* Header dos Slots de Horário */}
                                <div className="text-[11px] font-bold text-muted-foreground">Dia / Horário</div>
                                {HEATMAP_SLOTS.map((slot, sIdx) => (
                                    <div key={sIdx} className="text-[10px] font-bold text-center text-muted-foreground font-mono">
                                        {slot}
                                    </div>
                                ))}

                                {/* Linhas para cada dia da semana */}
                                {HEATMAP_DAYS.map((dayLabel, dIdx) => (
                                    <React.Fragment key={dIdx}>
                                        <div className="text-xs font-bold text-foreground flex items-center">
                                            {dayLabel}
                                        </div>
                                        {HEATMAP_SLOTS.map((_, sIdx) => {
                                            const cell = metrics?.heatmap.find(
                                                (h) => h.dayIndex === dIdx && h.slotIndex === sIdx
                                            );
                                            const count = cell?.count || 0;
                                            const intensity = cell?.intensity || 0;

                                            // Estilos 100% estáveis e visíveis sem nenhum efeito de piscar
                                            let bgClass = "bg-muted/40 text-muted-foreground";
                                            if (intensity === 1) bgClass = "bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium";
                                            else if (intensity === 2) bgClass = "bg-indigo-500/40 text-indigo-900 dark:text-indigo-200 font-semibold";
                                            else if (intensity === 3) bgClass = "bg-purple-600/70 text-white font-bold";
                                            else if (intensity === 4) bgClass = "bg-rose-500 text-white font-extrabold shadow-xs hover:bg-rose-600";

                                            return (
                                                <div
                                                    key={sIdx}
                                                    title={`${dayLabel} (${HEATMAP_SLOTS[sIdx]}): ${count} mensagens/demandas`}
                                                    className={`h-9 rounded-lg flex items-center justify-center text-xs font-mono transition-all duration-150 cursor-pointer hover:scale-105 border border-border/20 ${bgClass}`}
                                                >
                                                    {count > 0 ? count : "-"}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Formatos de Mídia Trocados no WhatsApp */}
                <Card className="glass-panel border-border/50 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-emerald-500" />
                            Tipos de Mídia & Conteúdo
                        </CardTitle>
                        <CardDescription>
                            Distribuição dos formatos trocados nas conversas
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {metrics?.messageTypes.length === 0 ? (
                            <div className="py-12 text-center text-xs text-muted-foreground">
                                Nenhuma mensagem registrada no período.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {metrics?.messageTypes.map((mt, idx) => (
                                    <div key={mt.type} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-foreground flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: MEDIA_COLORS[idx % MEDIA_COLORS.length] }}
                                                />
                                                {mt.label}
                                            </span>
                                            <span className="text-muted-foreground font-mono">
                                                {mt.count} ({mt.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${mt.percentage}%`,
                                                    backgroundColor: MEDIA_COLORS[idx % MEDIA_COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Grid 4: Top Clientes com Mais Demandas & Conexões Conectadas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Clientes VIP / Mais Demandas */}
                <Card className="glass-panel border-border/50 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PhoneCall className="h-4 w-4 text-primary" />
                            Clientes com Maior Volume de Demandas
                        </CardTitle>
                        <CardDescription>
                            Conversas com maior número de mensagens trocadas no período
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {metrics?.topCustomers.length === 0 ? (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                Nenhuma conversa recente.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {metrics?.topCustomers.map((cust) => (
                                    <div key={cust.jid} className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-border/40">
                                                <AvatarImage src={cust.profilePic || ""} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {cust.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-xs font-bold text-foreground">{cust.name}</p>
                                                <p className="text-[11px] text-muted-foreground font-mono">{cust.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                {cust.messageCount} msgs
                                            </span>
                                            <Link href={`/dashboard/chat?jid=${encodeURIComponent(cust.jid)}`}>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 cursor-pointer">
                                                    Abrir
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Desempenho por Conexão / Canal WhatsApp */}
                <Card className="glass-panel border-border/50 shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-blue-500" />
                            Desempenho por Linha / Conexão WhatsApp
                        </CardTitle>
                        <CardDescription>
                            Tráfego de mensagens e clientes atendidos por número conectado
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {metrics?.sessionBreakdown.length === 0 ? (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                Nenhuma sessão cadastrada.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {metrics?.sessionBreakdown.map((s) => {
                                    const isConnected = s.status === "CONNECTED";
                                    return (
                                        <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                                        {s.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                                                        isConnected ? "bg-emerald-500" : "bg-red-400"
                                                    }`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-bold text-foreground">{s.name}</p>
                                                        <Badge variant={isConnected ? "default" : "secondary"} className="text-[9px] h-4 px-1.5 py-0">
                                                            {isConnected ? "ONLINE" : "OFFLINE"}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground font-mono">{s.sessionId}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-foreground">
                                                    {s.uniqueCustomers} clientes
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {s.sent} env / {s.received} rec
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Grid 5: Ranking & Produtividade dos Atendentes (Demandas de quem está atendendo mais) */}
            <Card className="glass-panel border-border/50 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Award className="h-5 w-5 text-amber-500" />
                                Produtividade dos Atendentes & Ranking de Demanda
                            </CardTitle>
                            <CardDescription>
                                Acompanhe quem está atendendo mais, taxa de resolução e tempo médio de cada operador
                            </CardDescription>
                        </div>

                        {/* Barra de Filtro e Ordenação dos Atendentes */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Busca por Nome */}
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar atendente..."
                                    value={attendantSearch}
                                    onChange={(e) => setAttendantSearch(e.target.value)}
                                    className="bg-background/80 border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-hidden w-40 sm:w-48"
                                />
                            </div>

                            {/* Ordenação */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-background/80 border border-border/60 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                            >
                                <option value="total">Mais Atendimentos</option>
                                <option value="closed">Mais Finalizados</option>
                                <option value="inProgress">Mais em Andamento</option>
                                <option value="waitTime">Menor Tempo de Espera</option>
                                <option value="resolution">Maior Taxa Resolução</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {sortedAttendants.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-xs">
                            Nenhum atendente com registros para o filtro selecionado.
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {sortedAttendants.map((att, index) => {
                                const isTop = index === 0;
                                const isPodium = index < 3;

                                return (
                                    <div
                                        key={att.userId}
                                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                                    >
                                        {/* Posição e Perfil do Atendente */}
                                        <div className="flex items-center gap-3.5 min-w-[240px]">
                                            {/* Medalha / Posição */}
                                            <div className="shrink-0 w-7 text-center">
                                                {isTop ? (
                                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-xs border border-amber-500/30">
                                                        #1
                                                    </span>
                                                ) : isPodium ? (
                                                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                                        #{index + 1}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-mono text-muted-foreground">
                                                        #{index + 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Avatar */}
                                            <Avatar className="h-10 w-10 border border-border/50">
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                                    {att.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-sm text-foreground truncate">
                                                        {att.name}
                                                    </h4>
                                                    {isTop && (
                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] h-4.5 px-1.5 font-semibold">
                                                            Líder de Atendimento
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {att.email}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Métricas do Atendente */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-2xl">
                                            {/* Demanda Total / Participação */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    Atendimentos
                                                </span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-lg font-bold text-foreground">
                                                        {att.totalAssigned}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                                        ({att.demandShare}% da equipe)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Em Andamento vs Finalizados */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    Andamento / Feitos
                                                </span>
                                                <div className="flex items-center gap-1.5 text-sm font-bold">
                                                    <span className="text-blue-600 dark:text-blue-400" title="Em andamento">
                                                        {att.inProgress} ativos
                                                    </span>
                                                    <span className="text-muted-foreground font-normal">/</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400" title="Finalizados">
                                                        {att.closed} conc.
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Tempo Médio de Espera */}
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-medium text-muted-foreground">
                                                    TME (Espera)
                                                </span>
                                                <p className="text-base font-bold text-foreground">
                                                    {att.avgWaitMinutes}{" "}
                                                    <span className="text-xs font-normal text-muted-foreground">min</span>
                                                </p>
                                            </div>

                                            {/* Taxa de Resolução */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                                                    <span>Resolução</span>
                                                    <span className="font-bold text-foreground">{att.resolutionRate}%</span>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(100, att.resolutionRate)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ação Rápida */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Link href="/dashboard/chat">
                                                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 cursor-pointer">
                                                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                                    Ver Conversas
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
        </div>
    );
}
