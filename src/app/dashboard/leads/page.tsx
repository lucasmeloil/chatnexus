"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Target,
    Plus,
    Search,
    RefreshCw,
    Phone,
    Calendar,
    Clock,
    User,
    Building2,
    CalendarClock,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    MessageSquare,
    PhoneCall,
    Share2,
    Edit,
    Trash2,
    History,
    Sparkles,
    Monitor,
    Layers,
    MapPin,
    ArrowUpRight,
    Filter,
    CalendarCheck,
    Check,
    X,
    Laptop,
    FileSpreadsheet,
    Upload,
    Download,
    FileText,
    AlertTriangle
} from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface NexusLead {
    id: string;
    companyName: string;
    ownerName: string;
    phone: string;
    segment: string | null;
    systemOfInterest: string | null;
    currentSystem: string | null;
    posCount: number;
    city: string | null;
    state: string | null;
    status: "NOVO" | "EM_CONTATO" | "VISITA_DEMO" | "PROPOSTA_ENVIADA" | "FECHADO" | "PERDIDO";
    capturedAt: string;
    lastContactAt: string | null;
    nextContactAt: string | null;
    notes: string | null;
    assignedTo: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LeadActivity {
    id: string;
    leadId: string;
    type: "WHATSAPP" | "LIGACAO" | "VISITA" | "DEMO" | "PROPOSTA" | "NOTA";
    notes: string;
    nextContactAt: string | null;
    newStatus: string | null;
    createdBy: string;
    createdAt: string;
}

export interface LeadMetrics {
    total: number;
    pendingToday: number;
    overdue: number;
    inProgress: number;
    won: number;
    conversionRate: number;
}

const SEGMENT_OPTIONS = [
    "Varejo em Geral",
    "Confecções & Vestuário (Moda)",
    "Loja de Calçados",
    "Materiais de Construção",
    "Supermercado / Mercadinho",
    "Farmácia & Drogaria",
    "Ótica",
    "Atacadista & Distribuidora",
    "Autopeças / Moto Peças",
    "Restaurante / Lanchonete",
    "Outro"
];

const SYSTEM_INTEREST_OPTIONS = [
    "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
    "Frente de Caixa (PDV) / Emissão de Cupom Fiscal NFC-e",
    "Emissão de Nota Fiscal Eletrônica (NF-e / MDF-e)",
    "Controle de Estoque & Grade (Cores e Tamanhos)",
    "Gestão Financeira & DRE / Contas a Pagar e Receber",
    "TEF Integrado / Maquininhas e PIX Direto no PDV",
    "Todos os Sistemas Nexus Soft Tech"
];

const CURRENT_SYSTEM_OPTIONS = [
    "Nenhum / Anotações no Caderno",
    "Planilhas do Excel",
    "Software Concorrente",
    "Já é cliente (Expansão / Novo Módulo)"
];

const STATUS_CONFIG: Record<NexusLead["status"], { label: string; badgeClass: string; borderClass: string; bgClass: string }> = {
    NOVO: {
        label: "Novo Lead",
        badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
        borderClass: "border-l-blue-500",
        bgClass: "bg-blue-500/10"
    },
    EM_CONTATO: {
        label: "Em Contato",
        badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
        borderClass: "border-l-cyan-500",
        bgClass: "bg-cyan-500/10"
    },
    VISITA_DEMO: {
        label: "Demonstração / Visita",
        badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
        borderClass: "border-l-purple-500",
        bgClass: "bg-purple-500/10"
    },
    PROPOSTA_ENVIADA: {
        label: "Proposta Enviada",
        badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        borderClass: "border-l-amber-500",
        bgClass: "bg-amber-500/10"
    },
    FECHADO: {
        label: "Cliente Fechado! 🎉",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        borderClass: "border-l-emerald-500",
        bgClass: "bg-emerald-500/10"
    },
    PERDIDO: {
        label: "Sem Interesse / Perdido",
        badgeClass: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
        borderClass: "border-l-zinc-500",
        bgClass: "bg-zinc-500/10"
    }
};

export default function LeadsPage() {
    const router = useRouter();
    const [leads, setLeads] = useState<NexusLead[]>([]);
    const [metrics, setMetrics] = useState<LeadMetrics>({
        total: 0,
        pendingToday: 0,
        overdue: 0,
        inProgress: 0,
        won: 0,
        conversionRate: 0
    });
    const [loading, setLoading] = useState(true);

    // Filtros
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [segmentFilter, setSegmentFilter] = useState("ALL");
    const [dateFilter, setDateFilter] = useState<"all" | "today" | "overdue" | "upcoming">("all");

    // Modais
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Estado de Importação de Planilha Excel
    const [parsedLeads, setParsedLeads] = useState<any[]>([]);
    const [selectedFileName, setSelectedFileName] = useState("");
    const [fileError, setFileError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    // Lead selecionado
    const [selectedLead, setSelectedLead] = useState<NexusLead | null>(null);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);

    // Formulário de Lead (Criar / Editar)
    const [formData, setFormData] = useState({
        companyName: "",
        ownerName: "",
        phone: "",
        segment: "Varejo em Geral",
        systemOfInterest: "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
        currentSystem: "Nenhum / Anotações no Caderno",
        posCount: 1,
        city: "Itabaiana",
        state: "SE",
        status: "NOVO" as NexusLead["status"],
        capturedAt: new Date().toISOString().split("T")[0],
        nextContactAt: "",
        notes: ""
    });

    // Formulário de Registrar Contato
    const [contactForm, setContactForm] = useState({
        type: "WHATSAPP" as LeadActivity["type"],
        notes: "",
        newStatus: "" as NexusLead["status"] | "",
        nextContactAt: ""
    });

    const loadLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.append("search", search.trim());
            if (statusFilter !== "ALL") params.append("status", statusFilter);
            if (segmentFilter !== "ALL") params.append("segment", segmentFilter);
            if (dateFilter !== "all") params.append("filterDate", dateFilter);

            const res = await fetch(`/api/leads?${params.toString()}`);
            const json = await res.json();
            if (json.status && json.data) {
                setLeads(json.data.leads || []);
                if (json.data.metrics) {
                    setMetrics(json.data.metrics);
                }
            } else {
                toast.error(json.message || "Erro ao carregar leads");
            }
        } catch (e) {
            console.error("Erro ao carregar leads:", e);
            toast.error("Falha ao comunicar com o servidor");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadLeads();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, statusFilter, segmentFilter, dateFilter]);

    // Helpers de formatação
    const formatDate = (isoString?: string | null) => {
        if (!isoString) return "-";
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        } catch {
            return "-";
        }
    };

    const formatDateTime = (isoString?: string | null) => {
        if (!isoString) return "-";
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return "-";
        }
    };

    const cleanPhone = (phone: string) => {
        return phone.replace(/\D/g, "");
    };

    const formatPhoneDisplay = (phone: string) => {
        const clean = cleanPhone(phone);
        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }
        if (clean.length === 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        }
        return phone;
    };

    // Avaliação de urgência do contato agendado
    const getContactUrgency = (nextContactAt?: string | null, status?: NexusLead["status"]) => {
        if (!nextContactAt || status === "FECHADO" || status === "PERDIDO") {
            return { type: "none", text: "Sem agendamento", badgeClass: "bg-muted text-muted-foreground" };
        }

        const now = new Date();
        const contactDate = new Date(nextContactAt);
        const isSameDay =
            now.getDate() === contactDate.getDate() &&
            now.getMonth() === contactDate.getMonth() &&
            now.getFullYear() === contactDate.getFullYear();

        if (contactDate < now && !isSameDay) {
            return {
                type: "overdue",
                text: "Atrasado!",
                badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse"
            };
        }

        if (isSameDay) {
            return {
                type: "today",
                text: "Contato Hoje!",
                badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold"
            };
        }

        return {
            type: "upcoming",
            text: "Agendado",
            badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        };
    };

    // Iniciar conversa no Chat ao Vivo do NEXUS Chat
    const handleWhatsAppClick = (lead: NexusLead) => {
        let clean = cleanPhone(lead.phone);
        if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
            clean = `55${clean}`;
        }
        toast.info(`Abrindo conversa com ${lead.ownerName} (${lead.companyName}) no Chat ao Vivo...`, { id: "lead-chat-open" });
        router.push(`/dashboard/chat/${clean}`);
    };

    // Abrir Modal de Criação
    const handleOpenCreate = () => {
        const today = new Date();
        const defaultNext = new Date();
        defaultNext.setDate(today.getDate() + 1);
        defaultNext.setHours(10, 0, 0, 0);

        setFormData({
            companyName: "",
            ownerName: "",
            phone: "",
            segment: "Varejo em Geral",
            systemOfInterest: "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
            currentSystem: "Nenhum / Anotações no Caderno",
            posCount: 1,
            city: "Itabaiana",
            state: "SE",
            status: "NOVO",
            capturedAt: today.toISOString().split("T")[0],
            nextContactAt: defaultNext.toISOString().slice(0, 16),
            notes: ""
        });
        setIsCreateModalOpen(true);
    };

    // Salvar Lead (Criar)
    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName.trim() || !formData.ownerName.trim() || !formData.phone.trim()) {
            toast.warning("Por favor, preencha o nome da empresa, responsável e telefone.");
            return;
        }

        try {
            const res = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    posCount: Number(formData.posCount) || 1,
                    nextContactAt: formData.nextContactAt ? new Date(formData.nextContactAt).toISOString() : null
                })
            });
            const json = await res.json();
            if (json.status) {
                toast.success("Lead cadastrado com sucesso!");
                setIsCreateModalOpen(false);
                loadLeads();
            } else {
                toast.error(json.message || "Erro ao cadastrar lead");
            }
        } catch {
            toast.error("Erro ao salvar lead");
        }
    };

    // Abrir Modal de Edição
    const handleOpenEdit = (lead: NexusLead) => {
        setSelectedLead(lead);
        setFormData({
            companyName: lead.companyName,
            ownerName: lead.ownerName,
            phone: lead.phone,
            segment: lead.segment || "Varejo em Geral",
            systemOfInterest: lead.systemOfInterest || "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
            currentSystem: lead.currentSystem || "Nenhum / Anotações no Caderno",
            posCount: lead.posCount || 1,
            city: lead.city || "Itabaiana",
            state: lead.state || "SE",
            status: lead.status,
            capturedAt: lead.capturedAt ? lead.capturedAt.split("T")[0] : new Date().toISOString().split("T")[0],
            nextContactAt: lead.nextContactAt ? new Date(lead.nextContactAt).toISOString().slice(0, 16) : "",
            notes: lead.notes || ""
        });
        setIsEditModalOpen(true);
    };

    // Salvar Edição
    const handleUpdateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead) return;

        try {
            const res = await fetch(`/api/leads/${selectedLead.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    posCount: Number(formData.posCount) || 1,
                    nextContactAt: formData.nextContactAt ? new Date(formData.nextContactAt).toISOString() : null
                })
            });
            const json = await res.json();
            if (json.status) {
                toast.success("Lead atualizado com sucesso!");
                setIsEditModalOpen(false);
                loadLeads();
            } else {
                toast.error(json.message || "Erro ao atualizar lead");
            }
        } catch {
            toast.error("Erro ao salvar alterações");
        }
    };

    // Excluir Lead
    const handleDeleteLead = async (lead: NexusLead) => {
        if (!confirm(`Tem certeza que deseja excluir o lead da empresa "${lead.companyName}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.status) {
                toast.success("Lead removido!");
                loadLeads();
            } else {
                toast.error(json.message || "Erro ao excluir lead");
            }
        } catch {
            toast.error("Erro ao excluir lead");
        }
    };

    // Abrir Modal de Registrar Contato
    const handleOpenContact = (lead: NexusLead) => {
        setSelectedLead(lead);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        tomorrow.setHours(14, 0, 0, 0);

        setContactForm({
            type: "WHATSAPP",
            notes: "",
            newStatus: lead.status === "NOVO" ? "EM_CONTATO" : "",
            nextContactAt: tomorrow.toISOString().slice(0, 16)
        });
        setIsContactModalOpen(true);
    };

    // Salvar Registro de Contato
    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead) return;
        if (!contactForm.notes.trim()) {
            toast.warning("Por favor, informe o resumo ou anotação do contato realizado.");
            return;
        }

        try {
            const res = await fetch(`/api/leads/${selectedLead.id}/activities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: contactForm.type,
                    notes: contactForm.notes.trim(),
                    newStatus: contactForm.newStatus || undefined,
                    nextContactAt: contactForm.nextContactAt ? new Date(contactForm.nextContactAt).toISOString() : null
                })
            });
            const json = await res.json();
            if (json.status) {
                toast.success("Contato e agendamento registrados!");
                setIsContactModalOpen(false);
                loadLeads();
            } else {
                toast.error(json.message || "Erro ao registrar contato");
            }
        } catch {
            toast.error("Erro ao salvar contato");
        }
    };

    // Abrir Modal de Histórico
    const handleOpenHistory = async (lead: NexusLead) => {
        setSelectedLead(lead);
        setIsHistoryModalOpen(true);
        setLoadingActivities(true);
        try {
            const res = await fetch(`/api/leads/${lead.id}`);
            const json = await res.json();
            if (json.status && json.data) {
                setActivities(json.data.activities || []);
            }
        } catch {
            toast.error("Erro ao carregar histórico");
        } finally {
            setLoadingActivities(false);
        }
    };

    // Leitura e mapeamento de arquivo Excel / CSV
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFileName(file.name);
        setFileError(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json<any>(ws);

                if (!data || data.length === 0) {
                    setFileError("A planilha selecionada está vazia.");
                    setParsedLeads([]);
                    return;
                }

                // Mapeamento inteligente de colunas
                const mappedLeads: any[] = [];
                for (const row of data) {
                    const getVal = (possibleKeys: string[]) => {
                        for (const key of Object.keys(row)) {
                            const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                            for (const pk of possibleKeys) {
                                const cleanPk = pk.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                                if (cleanKey === cleanPk || cleanKey.includes(cleanPk)) {
                                    return String(row[key] || "").trim();
                                }
                            }
                        }
                        return "";
                    };

                    const companyName = getVal(["empresa", "razaosocial", "nomefantasia", "loja", "nomeloja", "cliente", "company"]);
                    const ownerName = getVal(["dono", "responsavel", "proprietario", "contato", "nome", "decisor", "owner"]);
                    const phone = getVal(["whatsapp", "telefone", "celular", "fone", "tel", "phone", "numero"]);
                    const segment = getVal(["segmento", "nicho", "ramo", "atividade", "tipo", "categoria"]);
                    const city = getVal(["cidade", "municipio", "city"]);
                    const state = getVal(["estado", "uf", "state"]);
                    const currentSystem = getVal(["sistemaatual", "softwareatual", "sistema", "software"]);
                    const systemOfInterest = getVal(["solucao", "interesse", "produtodeinteresse", "sistemadeinteresse"]);
                    const posCountStr = getVal(["caixas", "pdvs", "pdv", "qtdcaixas"]);
                    const notes = getVal(["observacoes", "observacao", "obs", "notas", "notes", "detalhes"]);

                    if (companyName || phone) {
                        mappedLeads.push({
                            companyName: companyName || "Empresa sem nome",
                            ownerName: ownerName || "Responsável",
                            phone: phone || "",
                            segment: segment || "Varejo em Geral",
                            city: city || "Itabaiana",
                            state: state || "SE",
                            currentSystem: currentSystem || "Nenhum / Anotações no Caderno",
                            systemOfInterest: systemOfInterest || "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
                            posCount: Number(posCountStr) || 1,
                            notes: notes || "Importado via planilha Excel",
                            status: "NOVO"
                        });
                    }
                }

                if (mappedLeads.length === 0) {
                    setFileError("Não foi possível identificar colunas válidas como 'Empresa' ou 'Telefone' na planilha.");
                    setParsedLeads([]);
                } else {
                    setParsedLeads(mappedLeads);
                    toast.success(`${mappedLeads.length} leads identificados na planilha!`);
                }
            } catch (err: any) {
                console.error("Erro ao ler Excel:", err);
                setFileError("Erro ao processar arquivo. Certifique-se de que é um arquivo Excel (.xlsx, .xls) ou CSV válido.");
            }
        };
        reader.readAsBinaryString(file);
    };

    // Baixar planilha modelo (.xlsx)
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                "Nome da Empresa": "Loja Bella Moda",
                "Nome do Dono": "Carlos Silva",
                "WhatsApp / Telefone": "(79) 99988-7766",
                "Cidade": "Itabaiana",
                "Estado": "SE",
                "Segmento": "Confecções & Vestuário (Moda)",
                "Sistema Atual": "Nenhum / Anotações no Caderno",
                "Solução Nexus de Interesse": "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
                "Qtd de Caixas": 2,
                "Observações": "Interessado em emissão de NFC-e e controle de estoque por grade"
            },
            {
                "Nome da Empresa": "Mercadinho São José",
                "Nome do Dono": "Maria Oliveira",
                "WhatsApp / Telefone": "(79) 98877-6655",
                "Cidade": "Itabaiana",
                "Estado": "SE",
                "Segmento": "Supermercado / Mercadinho",
                "Sistema Atual": "Planilhas do Excel",
                "Solução Nexus de Interesse": "Frente de Caixa (PDV) / Emissão de Cupom Fiscal NFC-e",
                "Qtd de Caixas": 3,
                "Observações": "Quer agilidade no caixa e leitor de código de barras"
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo Leads Nexus");
        XLSX.writeFile(wb, "modelo_leads_nexus_soft_tech.xlsx");
        toast.success("Planilha modelo baixada com sucesso!");
    };

    // Confirmar e enviar lote de leads para o backend
    const handleConfirmImport = async () => {
        if (parsedLeads.length === 0) {
            toast.warning("Nenhum lead pronto para importação.");
            return;
        }
        setImporting(true);
        try {
            const res = await fetch("/api/leads/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leads: parsedLeads })
            });
            const json = await res.json();
            if (json.status) {
                toast.success(json.message || `${parsedLeads.length} leads importados com sucesso!`);
                setIsImportModalOpen(false);
                setParsedLeads([]);
                setSelectedFileName("");
                loadLeads();
            } else {
                toast.error(json.message || "Erro ao importar leads");
            }
        } catch {
            toast.error("Erro na comunicação ao importar leads");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            <Target className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Prospecção & Leads Nexus Soft Tech</h1>
                            <p className="text-sm text-muted-foreground">
                                Gestão comercial de lojistas captados, histórico de contatos e agendamentos de retorno.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadLeads}
                        disabled={loading}
                        className="h-10 px-3 rounded-xl border-border/60 hover:bg-muted/80"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setParsedLeads([]);
                            setSelectedFileName("");
                            setFileError(null);
                            setIsImportModalOpen(true);
                        }}
                        className="h-10 px-3.5 rounded-xl border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold gap-2 shadow-sm"
                        title="Importar planilha Excel ou CSV com leads captados"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Importar Excel
                    </Button>
                    <Button
                        onClick={handleOpenCreate}
                        className="h-10 px-4 rounded-xl shadow-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Lead
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas / Indicadores Comerciais */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                <Card className="rounded-2xl border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Total de Leads</p>
                            <p className="text-2xl font-bold tracking-tight mt-1">{metrics.total}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Captados no funil</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Building2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
                    className={`rounded-2xl border-border/60 shadow-sm bg-card/60 backdrop-blur-sm cursor-pointer transition-all hover:border-amber-500/50 ${
                        dateFilter === "today" ? "ring-2 ring-amber-500 bg-amber-500/5" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                Contatos Hoje
                                {metrics.pendingToday > 0 && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                )}
                            </p>
                            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
                                {metrics.pendingToday}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Retornos para hoje</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    onClick={() => setDateFilter(dateFilter === "overdue" ? "all" : "overdue")}
                    className={`rounded-2xl border-border/60 shadow-sm bg-card/60 backdrop-blur-sm cursor-pointer transition-all hover:border-red-500/50 ${
                        dateFilter === "overdue" ? "ring-2 ring-red-500 bg-red-500/5" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-red-600 dark:text-red-400">Contatos Atrasados</p>
                            <p className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 mt-1">
                                {metrics.overdue}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Necessitam atenção</p>
                        </div>
                        <div className="p-3 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Em Negociação</p>
                            <p className="text-2xl font-bold tracking-tight mt-1">{metrics.inProgress}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Visitas e propostas</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm bg-card/60 backdrop-blur-sm col-span-2 lg:col-span-1">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Clientes Fechados</p>
                            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                                {metrics.won}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Conversão: {metrics.conversionRate}%</p>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="bg-card/70 backdrop-blur-md p-4 rounded-2xl border border-border/60 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Campo de Busca */}
                    <div className="relative md:col-span-5">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por Empresa, Dono, Telefone ou Cidade..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 rounded-xl bg-background/80 border-border/60"
                        />
                    </div>

                    {/* Filtro de Status */}
                    <div className="md:col-span-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="ALL">Todos os Status</option>
                            <option value="NOVO">Novo Lead</option>
                            <option value="EM_CONTATO">Em Contato</option>
                            <option value="VISITA_DEMO">Visita / Demonstração</option>
                            <option value="PROPOSTA_ENVIADA">Proposta Enviada</option>
                            <option value="FECHADO">Cliente Fechado 🎉</option>
                            <option value="PERDIDO">Sem Interesse / Perdido</option>
                        </select>
                    </div>

                    {/* Filtro de Segmento */}
                    <div className="md:col-span-2">
                        <select
                            value={segmentFilter}
                            onChange={(e) => setSegmentFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="ALL">Todos os Segmentos</option>
                            {SEGMENT_OPTIONS.map((seg) => (
                                <option key={seg} value={seg}>{seg}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro de Urgência de Datas */}
                    <div className="md:col-span-2">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="all">Todas as Datas</option>
                            <option value="today">Contato Hoje</option>
                            <option value="overdue">Atrasados</option>
                            <option value="upcoming">Agendados</option>
                        </select>
                    </div>
                </div>

                {/* Filtros ativos pills */}
                {(statusFilter !== "ALL" || segmentFilter !== "ALL" || dateFilter !== "all" || search) && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground flex-wrap">
                        <span>Filtros ativos:</span>
                        {search && (
                            <Badge variant="outline" className="rounded-lg gap-1 bg-background/50">
                                Busca: "{search}"
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
                            </Badge>
                        )}
                        {statusFilter !== "ALL" && (
                            <Badge variant="outline" className="rounded-lg gap-1 bg-background/50">
                                Status: {STATUS_CONFIG[statusFilter as NexusLead["status"]]?.label || statusFilter}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("ALL")} />
                            </Badge>
                        )}
                        {segmentFilter !== "ALL" && (
                            <Badge variant="outline" className="rounded-lg gap-1 bg-background/50">
                                Segmento: {segmentFilter}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setSegmentFilter("ALL")} />
                            </Badge>
                        )}
                        {dateFilter !== "all" && (
                            <Badge variant="outline" className="rounded-lg gap-1 bg-background/50">
                                Data: {dateFilter === "today" ? "Contato Hoje" : dateFilter === "overdue" ? "Atrasados" : "Agendados"}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => setDateFilter("all")} />
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setSearch("");
                                setStatusFilter("ALL");
                                setSegmentFilter("ALL");
                                setDateFilter("all");
                            }}
                        >
                            Limpar filtros
                        </Button>
                    </div>
                )}
            </div>

            {/* Listagem de Leads */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Carregando leads da Nexus Soft Tech...</p>
                </div>
            ) : leads.length === 0 ? (
                <Card className="rounded-2xl border-dashed border-2 border-border/80 p-12 text-center bg-card/40">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <Target className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold">Nenhum lead encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
                        {search || statusFilter !== "ALL" || segmentFilter !== "ALL" || dateFilter !== "all"
                            ? "Nenhum lojista corresponde aos filtros aplicados. Tente ajustar os termos de busca."
                            : "Você ainda não cadastrou nenhum lead. Cadastre lojistas para iniciar a prospecção ativa!"}
                    </p>
                    <Button onClick={handleOpenCreate} className="rounded-xl px-5">
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar Primeiro Lead
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {leads.map((lead) => {
                        const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NOVO;
                        const urgency = getContactUrgency(lead.nextContactAt, lead.status);

                        return (
                            <Card
                                key={lead.id}
                                className={`rounded-2xl border border-border/70 shadow-sm transition-all hover:shadow-md bg-card/90 overflow-hidden border-l-4 ${statusInfo.borderClass}`}
                            >
                                <CardHeader className="p-4 pb-2.5 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="font-bold text-base tracking-tight truncate" title={lead.companyName}>
                                                    {lead.companyName}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <User className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                                                <span className="font-medium text-foreground/90 truncate">{lead.ownerName}</span>
                                                <span className="text-muted-foreground/60">•</span>
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span>{lead.city || "Itabaiana"}-{lead.state || "SE"}</span>
                                            </div>
                                        </div>

                                        <Badge variant="outline" className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold shrink-0 border ${statusInfo.badgeClass}`}>
                                            {statusInfo.label}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 pt-1 space-y-3.5">
                                    {/* Segmento & Sistema */}
                                    <div className="p-2.5 rounded-xl bg-muted/50 border border-border/50 text-xs space-y-1.5">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Layers className="h-3.5 w-3.5 text-primary/70" />
                                                Segmento:
                                            </span>
                                            <span className="font-medium text-foreground truncate max-w-[160px]" title={lead.segment || ""}>
                                                {lead.segment || "Varejo em Geral"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Monitor className="h-3.5 w-3.5 text-primary/70" />
                                                Sistema Atual:
                                            </span>
                                            <span className="font-medium text-foreground truncate max-w-[160px]" title={lead.currentSystem || ""}>
                                                {lead.currentSystem || "Nenhum / Caderno"}
                                            </span>
                                        </div>
                                        {lead.systemOfInterest && (
                                            <div className="pt-1 border-t border-border/40 text-[11px] text-primary/90 flex items-center gap-1 truncate font-medium">
                                                <Sparkles className="h-3 w-3 shrink-0" />
                                                <span className="truncate" title={lead.systemOfInterest}>{lead.systemOfInterest}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bloco de Datas Críticas */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded-lg bg-background/60 border border-border/50 space-y-0.5">
                                            <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                                                <Calendar className="h-3 w-3" />
                                                Captado em
                                            </p>
                                            <p className="font-medium">{formatDate(lead.capturedAt)}</p>
                                        </div>

                                        <div className="p-2 rounded-lg bg-background/60 border border-border/50 space-y-0.5">
                                            <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                                                <PhoneCall className="h-3 w-3" />
                                                Último contato
                                            </p>
                                            <p className="font-medium">
                                                {lead.lastContactAt ? formatDate(lead.lastContactAt) : "Nenhum ainda"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Data de Novo Contato / Agendamento com Alerta */}
                                    <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                        urgency.type === "overdue"
                                            ? "bg-red-500/10 border-red-500/30"
                                            : urgency.type === "today"
                                            ? "bg-amber-500/10 border-amber-500/30"
                                            : "bg-muted/40 border-border/50"
                                    }`}>
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <CalendarClock className="h-3 w-3" />
                                                Próximo Contato Agendado:
                                            </span>
                                            <p className="font-semibold text-foreground">
                                                {lead.nextContactAt ? formatDateTime(lead.nextContactAt) : "Não agendado"}
                                            </p>
                                        </div>
                                        {urgency.type !== "none" && (
                                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md ${urgency.badgeClass}`}>
                                                {urgency.text}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Observações rápidas */}
                                    {lead.notes && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 italic bg-muted/20 p-2 rounded-lg border border-border/30">
                                            "{lead.notes}"
                                        </p>
                                    )}

                                    {/* Botões de Ação */}
                                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-1">
                                            {/* Chamar no WhatsApp */}
                                            <Button
                                                onClick={() => handleWhatsAppClick(lead)}
                                                size="sm"
                                                className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex-1 shadow-sm"
                                                title="Iniciar conversa no WhatsApp com mensagem da Nexus"
                                            >
                                                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                                WhatsApp
                                            </Button>

                                            {/* Registrar Contato */}
                                            <Button
                                                onClick={() => handleOpenContact(lead)}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10 text-xs font-medium flex-1"
                                                title="Registrar contato realizado e agendar retorno"
                                            >
                                                <PhoneCall className="h-3.5 w-3.5 mr-1" />
                                                Registrar
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {/* Histórico */}
                                            <Button
                                                onClick={() => handleOpenHistory(lead)}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-muted"
                                                title="Ver histórico de contatos"
                                            >
                                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>

                                            {/* Editar */}
                                            <Button
                                                onClick={() => handleOpenEdit(lead)}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-muted"
                                                title="Editar dados do lead"
                                            >
                                                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>

                                            {/* Excluir */}
                                            <Button
                                                onClick={() => handleDeleteLead(lead)}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                                title="Excluir lead"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* MODAL: NOVO LEAD */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 md:p-8 border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                <Target className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                                    Cadastrar Novo Lead de Lojista
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                    Preencha as informações do lojista captado para a prospecção da Nexus Soft Tech.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleCreateLead} className="space-y-5 pt-3">
                        {/* Seção 1: Dados da Empresa e Dono */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Dados da Empresa & Dono
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                                <div className="lg:col-span-6 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Nome da Empresa / Loja *</label>
                                    <Input
                                        placeholder="Ex: Loja Bella Moda"
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="lg:col-span-6 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Nome do Dono / Responsável *</label>
                                    <Input
                                        placeholder="Ex: Carlos Silva"
                                        value={formData.ownerName}
                                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">WhatsApp / Telefone *</label>
                                    <Input
                                        placeholder="Ex: (79) 99988-7766"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-1 lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Cidade</label>
                                    <Input
                                        placeholder="Ex: Itabaiana"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-1 lg:col-span-3 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Estado (UF)</label>
                                    <Input
                                        placeholder="Ex: SE"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção 2: Perfil Comercial & Sistemas */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <Monitor className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Perfil Comercial & Soluções Nexus Soft Tech
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                                <div className="lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Segmento do Lojista</label>
                                    <select
                                        value={formData.segment}
                                        onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {SEGMENT_OPTIONS.map((seg) => (
                                            <option key={seg} value={seg}>{seg}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Sistema Atual que o Lojista Usa</label>
                                    <select
                                        value={formData.currentSystem}
                                        onChange={(e) => setFormData({ ...formData, currentSystem: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {CURRENT_SYSTEM_OPTIONS.map((sys) => (
                                            <option key={sys} value={sys}>{sys}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Qtd de Caixas / PDVs</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={formData.posCount}
                                        onChange={(e) => setFormData({ ...formData, posCount: Number(e.target.value) || 1 })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="lg:col-span-12 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                        Solução Nexus de Interesse
                                    </label>
                                    <select
                                        value={formData.systemOfInterest}
                                        onChange={(e) => setFormData({ ...formData, systemOfInterest: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {SYSTEM_INTEREST_OPTIONS.map((sol) => (
                                            <option key={sol} value={sol}>{sol}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Seção 3: Datas & Agendamento */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <CalendarClock className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Datas & Agendamento de Contato
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Data de Captação *</label>
                                    <Input
                                        type="date"
                                        value={formData.capturedAt}
                                        onChange={(e) => setFormData({ ...formData, capturedAt: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Status Inicial</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        <option value="NOVO">Novo Lead</option>
                                        <option value="EM_CONTATO">Em Contato</option>
                                        <option value="VISITA_DEMO">Visita / Demonstração</option>
                                        <option value="PROPOSTA_ENVIADA">Proposta Enviada</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Data de Novo Contato (Retorno)</label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.nextContactAt}
                                        onChange={(e) => setFormData({ ...formData, nextContactAt: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="sm:col-span-3 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Observações Iniciais</label>
                                    <Textarea
                                        placeholder="Ex: Lojista interessado em trocar o sistema antigo para emitir NFC-e mais rápido e controlar estoque por tamanho..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        className="rounded-xl resize-none bg-background/80"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-3 gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl h-11 px-5">
                                Cancelar
                            </Button>
                            <Button type="submit" className="rounded-xl h-11 px-6 bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90">
                                Cadastrar Lead
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: EDITAR LEAD */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 md:p-8 border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                <Edit className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                                    Editar Dados do Lead
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                    Atualize as informações comerciais da empresa {selectedLead?.companyName}.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleUpdateLead} className="space-y-5 pt-3">
                        {/* Seção 1: Dados da Empresa e Dono */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Dados da Empresa & Dono
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                                <div className="lg:col-span-6 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Nome da Empresa / Loja *</label>
                                    <Input
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="lg:col-span-6 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Nome do Dono / Responsável *</label>
                                    <Input
                                        value={formData.ownerName}
                                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">WhatsApp / Telefone *</label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        required
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-1 lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Cidade</label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                                <div className="sm:col-span-1 lg:col-span-3 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Estado (UF)</label>
                                    <Input
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção 2: Perfil Comercial & Sistemas */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <Monitor className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Perfil Comercial & Soluções Nexus Soft Tech
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                                <div className="lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Segmento</label>
                                    <select
                                        value={formData.segment}
                                        onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {SEGMENT_OPTIONS.map((seg) => (
                                            <option key={seg} value={seg}>{seg}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="lg:col-span-5 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Sistema Atual do Lojista</label>
                                    <select
                                        value={formData.currentSystem}
                                        onChange={(e) => setFormData({ ...formData, currentSystem: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {CURRENT_SYSTEM_OPTIONS.map((sys) => (
                                            <option key={sys} value={sys}>{sys}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Qtd de Caixas</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={formData.posCount}
                                        onChange={(e) => setFormData({ ...formData, posCount: Number(e.target.value) || 1 })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="lg:col-span-12 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                        Solução Nexus de Interesse
                                    </label>
                                    <select
                                        value={formData.systemOfInterest}
                                        onChange={(e) => setFormData({ ...formData, systemOfInterest: e.target.value })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        {SYSTEM_INTEREST_OPTIONS.map((sol) => (
                                            <option key={sol} value={sol}>{sol}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Seção 3: Datas & Agendamento */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                <CalendarClock className="h-4 w-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Status & Agendamento
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Data de Captação</label>
                                    <Input
                                        type="date"
                                        value={formData.capturedAt}
                                        onChange={(e) => setFormData({ ...formData, capturedAt: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Status do Funil</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full h-10 px-3 rounded-xl bg-background/80 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                                    >
                                        <option value="NOVO">Novo Lead</option>
                                        <option value="EM_CONTATO">Em Contato</option>
                                        <option value="VISITA_DEMO">Visita / Demonstração</option>
                                        <option value="PROPOSTA_ENVIADA">Proposta Enviada</option>
                                        <option value="FECHADO">Cliente Fechado 🎉</option>
                                        <option value="PERDIDO">Sem Interesse / Perdido</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Data de Novo Contato</label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.nextContactAt}
                                        onChange={(e) => setFormData({ ...formData, nextContactAt: e.target.value })}
                                        className="rounded-xl h-10 bg-background/80"
                                    />
                                </div>

                                <div className="sm:col-span-3 space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground/90">Observações</label>
                                    <Textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        className="rounded-xl resize-none bg-background/80"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-3 gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl h-11 px-5">
                                Cancelar
                            </Button>
                            <Button type="submit" className="rounded-xl h-11 px-6 bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90">
                                Salvar Alterações
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: REGISTRAR CONTATO / FOLLOW-UP */}
            <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
                <DialogContent className="max-w-lg rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <PhoneCall className="h-5 w-5 text-emerald-500" />
                            Registrar Contato com o Lojista
                        </DialogTitle>
                        <DialogDescription>
                            Anote o retorno obtido com <strong className="text-foreground">{selectedLead?.ownerName}</strong> ({selectedLead?.companyName}) e programe a próxima ação.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveContact} className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Canal de Contato</label>
                                <select
                                    value={contactForm.type}
                                    onChange={(e) => setContactForm({ ...contactForm, type: e.target.value as any })}
                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="LIGACAO">Ligação Telefônica</option>
                                    <option value="VISITA">Visita Presencial</option>
                                    <option value="DEMO">Demonstração Online</option>
                                    <option value="PROPOSTA">Proposta Comercial</option>
                                    <option value="NOTA">Apenas Anotação</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Mudar Status para (opcional)</label>
                                <select
                                    value={contactForm.newStatus}
                                    onChange={(e) => setContactForm({ ...contactForm, newStatus: e.target.value as any })}
                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    <option value="">Manter atual ({selectedLead ? STATUS_CONFIG[selectedLead.status]?.label : ""})</option>
                                    <option value="EM_CONTATO">Em Contato</option>
                                    <option value="VISITA_DEMO">Visita / Demonstração Agendada</option>
                                    <option value="PROPOSTA_ENVIADA">Proposta Enviada</option>
                                    <option value="FECHADO">Cliente Fechado! 🎉</option>
                                    <option value="PERDIDO">Sem Interesse / Perdido</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Resumo do Contato / O que o cliente falou *</label>
                            <Textarea
                                placeholder="Ex: Conversei pelo WhatsApp, o dono se interessou pelo controle de estoque com grade. Pediu para ligar na quinta-feira às 15h para agendar a demonstração..."
                                value={contactForm.notes}
                                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                                required
                                rows={3}
                                className="rounded-xl resize-none"
                            />
                        </div>

                        <div className="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                            <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                <CalendarClock className="h-4 w-4" />
                                Data de Novo Contato (Agendamento de Retorno)
                            </label>
                            <Input
                                type="datetime-local"
                                value={contactForm.nextContactAt}
                                onChange={(e) => setContactForm({ ...contactForm, nextContactAt: e.target.value })}
                                className="rounded-xl bg-background"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                O sistema alertará quando a data de retorno chegar para que o vendedor não perca o lead!
                            </p>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsContactModalOpen(false)} className="rounded-xl">
                                Cancelar
                            </Button>
                            <Button type="submit" className="rounded-xl bg-primary font-semibold text-primary-foreground">
                                Salvar Contato & Atualizar Lead
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: HISTÓRICO DE ATIVIDADES / TIMELINE */}
            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <History className="h-5 w-5 text-primary" />
                            Histórico de Contatos — {selectedLead?.companyName}
                        </DialogTitle>
                        <DialogDescription>
                            Registro cronológico de todas as conversas, ligações e retornos com o lojista.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-3">
                        {loadingActivities ? (
                            <div className="flex justify-center py-10">
                                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground space-y-2">
                                <History className="h-8 w-8 mx-auto opacity-40" />
                                <p className="text-sm">Nenhum contato registrado ainda para este lead.</p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setIsHistoryModalOpen(false);
                                        if (selectedLead) handleOpenContact(selectedLead);
                                    }}
                                    className="rounded-xl mt-2"
                                >
                                    <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                                    Registrar Primeiro Contato
                                </Button>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-primary/30 pl-4 ml-2 space-y-4">
                                {activities.map((act) => (
                                    <div key={act.id} className="relative space-y-1.5">
                                        <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                                                {act.type === "WHATSAPP" && <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />}
                                                {act.type === "LIGACAO" && <PhoneCall className="h-3.5 w-3.5 text-blue-500" />}
                                                {act.type === "VISITA" && <Building2 className="h-3.5 w-3.5 text-purple-500" />}
                                                {act.type === "DEMO" && <Laptop className="h-3.5 w-3.5 text-amber-500" />}
                                                {act.type === "PROPOSTA" && <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />}
                                                {act.type} • {act.createdBy}
                                            </span>
                                            <span>{formatDateTime(act.createdAt)}</span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                            {act.notes}
                                        </div>
                                        {act.nextContactAt && (
                                            <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                                                <CalendarClock className="h-3.5 w-3.5" />
                                                Próximo retorno agendado para: {formatDateTime(act.nextContactAt)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-3">
                        <Button
                            onClick={() => {
                                setIsHistoryModalOpen(false);
                                if (selectedLead) handleOpenContact(selectedLead);
                            }}
                            className="rounded-xl bg-primary text-primary-foreground font-semibold"
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Novo Contato
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: IMPORTAR LEADS VIA EXCEL / CSV */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7 md:p-8 border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <FileSpreadsheet className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                                        Importar Leads via Excel / CSV
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                        Anexe sua planilha com os lojistas captados para adicionar ao funil de prospecção da Nexus Soft Tech.
                                    </DialogDescription>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadTemplate}
                                className="rounded-xl gap-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 h-9"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Baixar Modelo (.xlsx)
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="space-y-5 pt-3">
                        {/* Área de Anexo / Upload */}
                        <div className="p-6 border-2 border-dashed border-border/80 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors text-center relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <Upload className="h-6 w-6" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-semibold text-foreground">
                                        {selectedFileName ? selectedFileName : "Clique ou arraste sua planilha aqui"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Formatos suportados: Excel (.xlsx, .xls) ou CSV com colunas de Empresa, Dono e Telefone
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Mensagem de Erro de Arquivo */}
                        {fileError && (
                            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{fileError}</span>
                            </div>
                        )}

                        {/* Pré-visualização dos Leads Lidos */}
                        {parsedLeads.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                        <Check className="h-4 w-4" />
                                        {parsedLeads.length} leads prontos para serem adicionados à sua base
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">
                                        Mostrando prévia das primeiras 5 linhas
                                    </span>
                                </div>

                                <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/50 sticky top-0">
                                                <tr>
                                                    <th className="p-2.5 pl-3">Empresa / Loja</th>
                                                    <th className="p-2.5">Dono / Responsável</th>
                                                    <th className="p-2.5">Telefone / WhatsApp</th>
                                                    <th className="p-2.5">Cidade</th>
                                                    <th className="p-2.5">Segmento</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30">
                                                {parsedLeads.slice(0, 5).map((lead, idx) => (
                                                    <tr key={idx} className="hover:bg-muted/20">
                                                        <td className="p-2.5 pl-3 font-semibold text-foreground truncate max-w-[180px]">
                                                            {lead.companyName}
                                                        </td>
                                                        <td className="p-2.5 text-muted-foreground truncate max-w-[140px]">
                                                            {lead.ownerName}
                                                        </td>
                                                        <td className="p-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                                                            {lead.phone}
                                                        </td>
                                                        <td className="p-2.5 text-muted-foreground">
                                                            {lead.city}-{lead.state}
                                                        </td>
                                                        <td className="p-2.5 text-muted-foreground truncate max-w-[140px]">
                                                            {lead.segment}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground">
                                    * Todos os leads importados entrarão automaticamente com status <strong>"Novo Lead"</strong> para que sua equipe possa iniciar o primeiro contato pelo WhatsApp no Chat ao Vivo.
                                </p>
                            </div>
                        )}

                        <DialogFooter className="pt-3 gap-2 sm:gap-0 border-t border-border/50">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsImportModalOpen(false)}
                                disabled={importing}
                                className="rounded-xl h-11 px-5"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleConfirmImport}
                                disabled={parsedLeads.length === 0 || importing}
                                className="rounded-xl h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md gap-2"
                            >
                                {importing ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Importando {parsedLeads.length} leads...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Confirmar Importação de {parsedLeads.length} Leads
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

