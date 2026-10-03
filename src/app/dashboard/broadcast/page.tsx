"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
    RefreshCw, 
    Send, 
    CheckCircle2, 
    XCircle, 
    Radio, 
    Clock, 
    AlertTriangle, 
    History, 
    Eye, 
    Paperclip, 
    FileText, 
    UploadCloud, 
    X, 
    FileUp,
    Plus,
    Trash2,
    Users,
    FileSpreadsheet,
    Sparkles,
    Check,
    Receipt,
    HelpCircle,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { useSocket } from "@/components/chat/socket-context";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

interface BroadcastProgress {
    broadcastId: string;
    status: "running" | "completed";
    total: number;
    sent: number;
    failed: number;
    current?: string | null;
    progress?: number;
    errors?: { jid: string; error: string }[];
    startedAt?: string;
    completedAt?: string;
}

interface BroadcastLog {
    id: string;
    sessionId: string;
    message: string;
    total: number;
    sent: number;
    failed: number;
    status: string;
    delay: number;
    startedAt: string;
    completedAt: string | null;
    _count?: { recipients: number };
    recipients?: BroadcastRecipient[];
}

interface BroadcastRecipient {
    id: string;
    jid: string;
    status: string;
    error: string | null;
    sentAt: string | null;
}

const DEFAULT_NEXUS_BOLETO_TEMPLATE = `Olá *[NOME]*

O boleto PIX para pagamento do uso do sistema Nexus  já está disponível.
Valor: *[VALOR]*
Data de vencimento: *[DATA]*

Você pode realizar o pagamento de forma prática e rápida utilizando a opção *PIX copia e cola*.

Agradecemos pela confiança e seguimos juntos para garantir o melhor desempenho da sua empresa 🚀.

_mensagem enviada automaticamente pelo sistema Nexus Soft Tech_`;

interface IndividualClientRow {
    id: string;
    phone: string;
    name: string;
    amount?: string;
    dueDate?: string;
    pixCode: string;
    customMessage: string;
    file: File | null;
    previewUrl?: string | null;
}

export default function BroadcastPage() {
    const { sessionId } = useSession();
    const [activeTab, setActiveTab] = useState<"new" | "history">("new");
    const [broadcastMode, setBroadcastMode] = useState<"standard" | "individual">("individual");

    // Standard Mode State
    const [contacts, setContacts] = useState("");
    const [message, setMessage] = useState("");
    const [standardFile, setStandardFile] = useState<File | null>(null);
    const [standardPreviewUrl, setStandardPreviewUrl] = useState<string | null>(null);
    const standardFileInputRef = useRef<HTMLInputElement>(null);

    // Individual Mode (Boletos & Cobrança) State
    const [sendPixSeparately, setSendPixSeparately] = useState(true);
    const [templateText, setTemplateText] = useState(DEFAULT_NEXUS_BOLETO_TEMPLATE);
    const [showTemplate, setShowTemplate] = useState(true);
    const [individualRows, setIndividualRows] = useState<IndividualClientRow[]>([
        { id: "1", phone: "", name: "", amount: "", dueDate: "", pixCode: "", customMessage: "", file: null }
    ]);
    const bulkPdfInputRef = useRef<HTMLInputElement>(null);

    // General Controls
    const [delay, setDelay] = useState([2000]);
    const [loading, setLoading] = useState(false);
    const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress | null>(null);

    // History State
    const [history, setHistory] = useState<BroadcastLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<BroadcastLog | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const { getSocket, joinSession } = useSocket();

    // Socket for progress updates
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !sessionId) return;

        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);

        const handler = (data: BroadcastProgress) => {
            setBroadcastProgress(data);
            if (data.status === "completed") {
                setLoading(false);
                fetchHistory();
                if (data.failed === 0) {
                    toast.success(`Disparo finalizado com sucesso! ${data.sent} mensagens enviadas.`);
                } else {
                    toast.warning(`Disparo concluído: ${data.sent} enviadas, ${data.failed} falhas.`);
                }
            }
        };

        socket.on("broadcast.progress", handler);
        return () => { socket.off("connect", onConnect); socket.off("broadcast.progress", handler); };
    }, [sessionId, getSocket, joinSession]);

    // Standard File Select
    const handleStandardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast.error("O arquivo excede o limite máximo de 25MB.");
            return;
        }

        setStandardFile(file);
        if (file.type.startsWith("image/")) {
            setStandardPreviewUrl(URL.createObjectURL(file));
        } else {
            setStandardPreviewUrl(null);
        }
    };

    const handleRemoveStandardFile = () => {
        setStandardFile(null);
        if (standardPreviewUrl) {
            URL.revokeObjectURL(standardPreviewUrl);
            setStandardPreviewUrl(null);
        }
        if (standardFileInputRef.current) {
            standardFileInputRef.current.value = "";
        }
    };

    // Individual Rows Actions
    const addIndividualRow = () => {
        setIndividualRows(prev => [
            ...prev,
            { id: String(Date.now() + Math.random()), phone: "", name: "", amount: "", dueDate: "", pixCode: "", customMessage: "", file: null }
        ]);
    };

    const updateIndividualRow = (id: string, updates: Partial<IndividualClientRow>) => {
        setIndividualRows(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));
    };

    const removeIndividualRow = (id: string) => {
        setIndividualRows(prev => {
            if (prev.length <= 1) {
                return [{ id: String(Date.now()), phone: "", name: "", amount: "", dueDate: "", pixCode: "", customMessage: "", file: null }];
            }
            return prev.filter(row => row.id !== id);
        });
    };

    const handleRowFileChange = (id: string, file: File | null) => {
        if (!file) {
            updateIndividualRow(id, { file: null, previewUrl: null });
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            toast.error("Arquivo excede 25MB.");
            return;
        }
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        updateIndividualRow(id, { file, previewUrl });
    };

    // Bulk upload multiple PDFs at once
    const handleBulkPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newRows: IndividualClientRow[] = files.map((file, idx) => {
            // Tenta adivinhar nome ou telefone a partir do nome do arquivo (ex: "11987654321_Joao.pdf")
            const cleanName = file.name.replace(/\.[^/.]+$/, "");
            const digits = cleanName.replace(/\D/g, "");
            const phoneGuessed = digits.length >= 10 && digits.length <= 13 ? digits : "";
            const nameGuessed = cleanName.replace(/[0-9_\-]/g, " ").trim();

            return {
                id: String(Date.now() + idx + Math.random()),
                phone: phoneGuessed,
                name: nameGuessed || "",
                amount: "",
                dueDate: "",
                pixCode: "",
                customMessage: "",
                file,
                previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
            };
        });

        setIndividualRows(prev => {
            const hasEmptyFirst = prev.length === 1 && !prev[0].phone && !prev[0].file;
            return hasEmptyFirst ? newRows : [...prev, ...newRows];
        });

        toast.success(`${files.length} arquivo(s) carregado(s) com sucesso na lista!`);
        if (bulkPdfInputRef.current) bulkPdfInputRef.current.value = "";
    };

    const insertVariableIntoTemplate = (variable: string) => {
        setTemplateText(prev => prev + variable);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (!sessionId) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/messages/${sessionId}/broadcast/history?limit=20`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.data || []);
            }
        } catch (e) {
            console.error("Failed to fetch broadcast history", e);
        } finally {
            setHistoryLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        if (activeTab === "history" && sessionId) {
            fetchHistory();
        }
    }, [activeTab, sessionId, fetchHistory]);

    // Open detail modal
    const openDetail = async (log: BroadcastLog) => {
        setSelectedLog(log);
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/messages/${sessionId}/broadcast/history/${log.id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedLog(data.data);
            }
        } catch (e) {
            console.error("Failed to fetch broadcast detail", e);
        } finally {
            setDetailLoading(false);
        }
    };

    // Send Broadcast
    const handleSend = async () => {
        if (!sessionId) return toast.error("Nenhuma sessão ativa selecionada");
        setLoading(true);
        setBroadcastProgress(null);

        try {
            if (broadcastMode === "individual") {
                // Validate individual rows
                const validRows = individualRows.filter(r => r.phone.trim().length >= 8);

                if (validRows.length === 0) {
                    toast.error("Informe pelo menos 1 destinatário com telefone válido.");
                    setLoading(false);
                    return;
                }

                const formData = new FormData();
                formData.append("mode", "individual");
                formData.append("delay", String(delay[0]));
                formData.append("sendPixSeparately", sendPixSeparately ? "true" : "false");

                const itemsMeta = validRows.map((row, index) => {
                    const formattedJid = formatToBrazilPhoneJid(row.phone);
                    
                    // Build customized message
                    let itemMsg = row.customMessage?.trim() || "";
                    if (!itemMsg && templateText.trim()) {
                        let formattedAmount = row.amount?.trim() || "";
                        if (formattedAmount && !formattedAmount.startsWith("R$")) {
                            formattedAmount = `R$ ${formattedAmount}`;
                        }

                        const pixReplacement = sendPixSeparately 
                            ? "👇 (Enviado em mensagem separada a seguir para você copiar)" 
                            : (row.pixCode || "");

                        itemMsg = templateText
                            .replace(/\[NOME\]|{nome}/gi, row.name || "")
                            .replace(/\[VALOR\]|{valor}/gi, formattedAmount || "")
                            .replace(/\[DATA\]|\[VENCIMENTO\]|{data}|{vencimento}/gi, row.dueDate || "")
                            .replace(/\[PIX\]|{pix}/gi, pixReplacement)
                            .replace(/\[TELEFONE\]|{telefone}/gi, row.phone || "");
                    }
                    if (!itemMsg) {
                        itemMsg = `Olá${row.name ? ` *${row.name}*` : ""}\n\nO boleto PIX para pagamento do uso do sistema Nexus já está disponível.${row.amount ? `\nValor: *${row.amount}*` : ""}${row.dueDate ? `\nData de vencimento: *${row.dueDate}*` : ""}\n\nVocê pode realizar o pagamento de forma prática e rápida utilizando a opção *PIX copia e cola*.\n\nAgradecemos pela confiança e seguimos juntos para garantir o melhor desempenho da sua empresa 🚀.\n\n_mensagem enviada automaticamente pelo sistema Nexus Soft Tech_`;
                    }

                    return {
                        jid: formattedJid,
                        name: row.name,
                        pix: row.pixCode?.trim() || "",
                        message: itemMsg,
                        hasFile: !!row.file,
                        fileIndex: row.file ? index : -1
                    };
                });

                formData.append("items", JSON.stringify(itemsMeta));

                // Append each file with unique key
                validRows.forEach((row, index) => {
                    if (row.file) {
                        formData.append(`file_${index}`, row.file);
                    }
                });

                const res = await fetch(`/api/messages/${sessionId}/broadcast`, {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (res.ok) {
                    toast.info(`Disparo individualizado iniciado para ${validRows.length} clientes...`);
                } else {
                    toast.error(data.message || "Falha ao iniciar disparo individual");
                    setLoading(false);
                }

            } else {
                // Standard mode
                const recipients = contacts.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(s => {
                    return formatToBrazilPhoneJid(s);
                });

                if (recipients.length === 0) {
                    toast.error("Nenhum destinatário válido informado");
                    setLoading(false);
                    return;
                }

                if (!message.trim() && !standardFile) {
                    toast.error("Digite uma mensagem ou anexe um arquivo.");
                    setLoading(false);
                    return;
                }

                let res: Response;

                if (standardFile) {
                    const formData = new FormData();
                    formData.append("mode", "standard");
                    formData.append("recipients", JSON.stringify(recipients));
                    formData.append("message", message.trim());
                    formData.append("delay", String(delay[0]));
                    formData.append("file", standardFile);

                    res = await fetch(`/api/messages/${sessionId}/broadcast`, {
                        method: "POST",
                        body: formData
                    });
                } else {
                    res = await fetch(`/api/messages/${sessionId}/broadcast`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            mode: "standard",
                            recipients,
                            message: message.trim(),
                            delay: delay[0]
                        })
                    });
                }

                const data = await res.json();

                if (res.ok) {
                    toast.info(`Disparo iniciado para ${recipients.length} destinatários...`);
                } else {
                    toast.error(data.message || "Falha ao iniciar disparo");
                    setLoading(false);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar disparo");
            setLoading(false);
        }
    };

    const recipientCount = broadcastMode === "individual"
        ? individualRows.filter(r => r.phone.trim().length >= 8).length
        : contacts.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length;

    const filesCount = broadcastMode === "individual"
        ? individualRows.filter(r => r.file !== null).length
        : standardFile ? 1 : 0;

    const formatJid = (jid: string) => {
        if (!jid) return "-";
        return jid.replace("@s.whatsapp.net", "").replace("@g.us", " (Grupo)");
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SessionGuard>
            <div className="space-y-6 max-w-6xl mx-auto pb-16">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                            <Receipt className="h-7 w-7 text-primary" /> Disparos em Massa & Boletos
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                            Envie boletos em PDF, chaves Pix Copia e Cola e mensagens personalizadas para cada cliente.
                        </p>
                    </div>

                    {/* Main View Tabs */}
                    <div className="flex gap-1 bg-muted/60 p-1 rounded-lg border border-border/50">
                        <button
                            onClick={() => setActiveTab("new")}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                activeTab === "new"
                                    ? "bg-background shadow-xs text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Send className="h-3.5 w-3.5" /> Novo Disparo
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                activeTab === "history"
                                    ? "bg-background shadow-xs text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <History className="h-3.5 w-3.5" /> Histórico
                        </button>
                    </div>
                </div>

                {activeTab === "new" && (
                    <>
                        {/* Mode Selector Segmented Control */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-xs font-bold text-foreground">Modalidade de Envio</h4>
                                <p className="text-[11px] text-muted-foreground">
                                    Escolha entre envio individualizado por cliente (boletos e Pix) ou disparo padrão coletivo.
                                </p>
                            </div>

                            <div className="flex gap-1.5 bg-background p-1 rounded-xl border shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setBroadcastMode("individual")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        broadcastMode === "individual"
                                            ? "bg-primary text-primary-foreground shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Receipt className="h-3.5 w-3.5" /> Boletos & Pix Individuais
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBroadcastMode("standard")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        broadcastMode === "standard"
                                            ? "bg-primary text-primary-foreground shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Users className="h-3.5 w-3.5" /> Disparo Coletivo (Mesmo Arquivo)
                                </button>
                            </div>
                        </div>

                        {/* MODE 1: INDIVIDUAL BOLETOS & PIX */}
                        {broadcastMode === "individual" && (
                            <div className="space-y-5">
                                
                                {/* Template Helper Box */}
                                <Card className="shadow-xs border-border/70">
                                    <CardHeader className="py-3 px-5 flex flex-row items-center justify-between border-b bg-muted/20">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            <CardTitle className="text-xs sm:text-sm font-bold">
                                                Modelo / Template Inteligente da Mensagem de Cobrança
                                            </CardTitle>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowTemplate(!showTemplate)}
                                            className="text-xs text-primary font-medium hover:underline cursor-pointer"
                                        >
                                            {showTemplate ? "Ocultar modelo" : "Editar modelo"}
                                        </button>
                                    </CardHeader>
                                    {showTemplate && (
                                        <CardContent className="p-5 space-y-3">
                                            <p className="text-xs text-muted-foreground">
                                                Este texto será enviado junto ao boleto anexado de cada cliente. As variáveis <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">*&#91;NOME&#93;*</code>, <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">*&#91;VALOR&#93;*</code> e <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">*&#91;DATA&#93;*</code> são preenchidas automaticamente pelos dados de cada cliente na tabela.
                                            </p>
                                            <Textarea
                                                value={templateText}
                                                onChange={e => setTemplateText(e.target.value)}
                                                rows={7}
                                                className="text-xs font-mono leading-relaxed"
                                                placeholder="Digite o texto base da cobrança..."
                                            />
                                            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[11px] text-muted-foreground font-medium">Inserir:</span>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariableIntoTemplate("*[NOME]*")} className="h-7 text-[11px] px-2 gap-1 cursor-pointer">
                                                        + Nome (*&#91;NOME&#93;*)
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariableIntoTemplate("*[VALOR]*")} className="h-7 text-[11px] px-2 gap-1 cursor-pointer">
                                                        + Valor (*&#91;VALOR&#93;*)
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariableIntoTemplate("*[DATA]*")} className="h-7 text-[11px] px-2 gap-1 cursor-pointer">
                                                        + Vencimento (*&#91;DATA&#93;*)
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => insertVariableIntoTemplate("[PIX]")} className="h-7 text-[11px] px-2 gap-1 cursor-pointer">
                                                        + Pix (&#91;PIX&#93;)
                                                    </Button>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => setTemplateText(DEFAULT_NEXUS_BOLETO_TEMPLATE)} 
                                                    className="h-7 text-[11px] text-primary hover:text-primary gap-1 cursor-pointer"
                                                >
                                                    <RefreshCw className="h-3 w-3" /> Restaurar Mensagem Padrão Nexus
                                                </Button>
                                            </div>

                                            {/* Opção Pix Separado */}
                                            <div className="flex items-center justify-between p-3 rounded-xl border border-blue-500/25 bg-blue-500/5 mt-3">
                                                <div className="space-y-0.5 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                                        <Label htmlFor="send-pix-separately" className="text-xs font-semibold text-foreground cursor-pointer">
                                                            Enviar Código Pix em mensagem separada logo após o boleto
                                                        </Label>
                                                        <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold border-0">
                                                            1-Toque Copia e Cola
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                        O WhatsApp enviará primeiro o boleto com a mensagem explicativa e, logo em seguida, enviará <strong>apenas o código Pix Copia e Cola puro</strong>. Assim, o seu cliente consegue copiar o código com apenas 1 clique no celular sem copiar o restante do texto junto!
                                                    </p>
                                                </div>
                                                <Switch
                                                    id="send-pix-separately"
                                                    checked={sendPixSeparately}
                                                    onCheckedChange={setSendPixSeparately}
                                                />
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>

                                {/* Clients & Boletos Table Card */}
                                <Card className="shadow-xs border-border/70">
                                    <CardHeader className="py-4 px-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b bg-muted/20">
                                        <div>
                                            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                <FileSpreadsheet className="h-4 w-4 text-primary" /> Clientes & Boletos Individualizados
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-0.5">
                                                Configure cada destinatário com seu próprio WhatsApp, PDF de boleto e código Pix.
                                            </CardDescription>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <input
                                                ref={bulkPdfInputRef}
                                                type="file"
                                                multiple
                                                accept="application/pdf,image/*"
                                                className="hidden"
                                                onChange={handleBulkPdfUpload}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => bulkPdfInputRef.current?.click()}
                                                className="h-8 text-xs gap-1.5 cursor-pointer font-semibold"
                                            >
                                                <UploadCloud className="h-3.5 w-3.5 text-primary" /> Carregar Vários PDFs de uma vez
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={addIndividualRow}
                                                className="h-8 text-xs gap-1.5 cursor-pointer font-semibold"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Adicionar Cliente
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                                                        <th className="py-2.5 px-3 font-semibold w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 font-semibold w-40">WhatsApp</th>
                                                        <th className="py-2.5 px-3 font-semibold w-36">Nome Cliente</th>
                                                        <th className="py-2.5 px-3 font-semibold w-28">Valor (R$)</th>
                                                        <th className="py-2.5 px-3 font-semibold w-28">Vencimento</th>
                                                        <th className="py-2.5 px-3 font-semibold min-w-[180px]">Código Pix Copia e Cola</th>
                                                        <th className="py-2.5 px-3 font-semibold w-56">Boleto (PDF/Img)</th>
                                                        <th className="py-2.5 px-2 font-semibold w-10 text-center">Ação</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                    {individualRows.map((row, index) => (
                                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                                            <td className="py-2.5 px-3 text-center font-mono text-muted-foreground font-semibold">
                                                                {index + 1}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <Input
                                                                    placeholder="(11) 98765-4321"
                                                                    value={row.phone}
                                                                    onChange={e => updateIndividualRow(row.id, { phone: e.target.value })}
                                                                    className="h-8 text-xs font-mono"
                                                                    disabled={loading}
                                                                />
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <Input
                                                                    placeholder="Ex: Carlos Silva"
                                                                    value={row.name}
                                                                    onChange={e => updateIndividualRow(row.id, { name: e.target.value })}
                                                                    className="h-8 text-xs"
                                                                    disabled={loading}
                                                                />
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <Input
                                                                    placeholder="R$ 150,00"
                                                                    value={row.amount || ""}
                                                                    onChange={e => updateIndividualRow(row.id, { amount: e.target.value })}
                                                                    className="h-8 text-xs font-medium"
                                                                    disabled={loading}
                                                                />
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <Input
                                                                    placeholder="10/10/2026"
                                                                    value={row.dueDate || ""}
                                                                    onChange={e => updateIndividualRow(row.id, { dueDate: e.target.value })}
                                                                    className="h-8 text-xs font-mono"
                                                                    disabled={loading}
                                                                />
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <Input
                                                                    placeholder="00020126580014br.gov.bcb.pix..."
                                                                    value={row.pixCode}
                                                                    onChange={e => updateIndividualRow(row.id, { pixCode: e.target.value })}
                                                                    className="h-8 text-xs font-mono"
                                                                    disabled={loading}
                                                                />
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                {row.file ? (
                                                                    <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card text-[11px] gap-2">
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                            <span className="font-semibold truncate max-w-[150px]" title={row.file.name}>
                                                                                {row.file.name}
                                                                            </span>
                                                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                                                ({formatFileSize(row.file.size)})
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRowFileChange(row.id, null)}
                                                                            className="text-muted-foreground hover:text-red-600 p-0.5 cursor-pointer"
                                                                            title="Remover arquivo"
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary cursor-pointer transition-colors bg-muted/40">
                                                                            <Paperclip className="h-3 w-3" /> Anexar Boleto
                                                                            <input
                                                                                type="file"
                                                                                accept="application/pdf,image/*"
                                                                                className="hidden"
                                                                                onChange={e => {
                                                                                    const f = e.target.files?.[0];
                                                                                    if (f) handleRowFileChange(row.id, f);
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => removeIndividualRow(row.id)}
                                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 cursor-pointer"
                                                                    title="Remover linha"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Bottom row summary & add button */}
                                        <div className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addIndividualRow}
                                                className="gap-1.5 text-xs font-semibold cursor-pointer"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Adicionar Mais um Cliente
                                            </Button>

                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span><strong>{recipientCount}</strong> clientes válidos</span>
                                                <span>•</span>
                                                <span><strong>{filesCount}</strong> boletos anexados</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Action & Delay Footer Card */}
                                <Card className="shadow-xs border-border/70">
                                    <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                                        <div className="w-full sm:w-1/2 space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <Label className="font-semibold">Intervalo de Segurança (Delay anti-ban):</Label>
                                                <span className="font-mono font-bold text-primary">{(delay[0] / 1000).toFixed(1)}s</span>
                                            </div>
                                            <Slider
                                                defaultValue={[2000]}
                                                min={1000}
                                                max={15000}
                                                step={500}
                                                value={delay}
                                                onValueChange={setDelay}
                                                disabled={loading}
                                                className="cursor-pointer"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Tempo aleatório entre os envios para manter a segurança do número.
                                            </p>
                                        </div>

                                        <div className="w-full sm:w-1/2">
                                            <Button
                                                className="w-full font-bold h-12 text-sm shadow-md cursor-pointer bg-primary hover:bg-primary/90"
                                                onClick={handleSend}
                                                disabled={loading || !sessionId || recipientCount === 0}
                                            >
                                                {loading ? (
                                                    <>
                                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando boletos...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Receipt className="mr-2 h-4 w-4" /> Iniciar Disparo de {recipientCount} Boleto{recipientCount !== 1 ? "s" : ""}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                            </div>
                        )}

                        {/* MODE 2: STANDARD COLETIVO (Same File/Message) */}
                        {broadcastMode === "standard" && (
                            <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                                {/* Recipients Card (5 Cols) */}
                                <Card className="lg:col-span-5 shadow-xs border-border/70">
                                    <CardHeader>
                                        <CardTitle className="text-base font-bold">Destinatários</CardTitle>
                                        <CardDescription className="text-xs">
                                            Insira os números de telefone separados por linha ou vírgula.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold">Números de Destino</Label>
                                            <Textarea
                                                placeholder={"11987654321\n(11) 91234-5678\n552199887766"}
                                                className="min-h-[220px] font-mono text-xs leading-relaxed"
                                                value={contacts}
                                                onChange={e => setContacts(e.target.value)}
                                                disabled={loading}
                                            />
                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                                                <span className="font-semibold text-primary">
                                                    {recipientCount} contato{recipientCount !== 1 ? "s" : ""} identificado{recipientCount !== 1 ? "s" : ""}
                                                </span>
                                                <span className="text-[11px]">DDI +55 padronizado</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Message & Attachment Card (7 Cols) */}
                                <Card className="lg:col-span-7 shadow-xs border-border/70">
                                    <CardHeader>
                                        <CardTitle className="text-base font-bold">Conteúdo Coletivo</CardTitle>
                                        <CardDescription className="text-xs">
                                            Escreva o texto e anexe uma imagem ou arquivo PDF comum a todos os contatos.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        
                                        {/* File Attachment Box */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                                    <Paperclip className="h-3.5 w-3.5 text-primary" /> Anexo (PDF ou Imagem)
                                                </Label>
                                                {standardFile && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveStandardFile}
                                                        className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-medium"
                                                    >
                                                        <X className="h-3 w-3" /> Remover anexo
                                                    </button>
                                                )}
                                            </div>

                                            {!standardFile ? (
                                                <div
                                                    onClick={() => standardFileInputRef.current?.click()}
                                                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary/60 rounded-xl p-4 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-900/30 hover:bg-primary/5"
                                                >
                                                    <input
                                                        ref={standardFileInputRef}
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        className="hidden"
                                                        onChange={handleStandardFileSelect}
                                                        disabled={loading}
                                                    />
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                                            <UploadCloud className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-foreground">
                                                                Clique para anexar ou arraste o arquivo aqui
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                Suporta <strong>PDF, PNG, JPG, JPEG, WEBP</strong> (até 25MB)
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-card shadow-2xs">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {standardPreviewUrl ? (
                                                            <img
                                                                src={standardPreviewUrl}
                                                                alt="Preview"
                                                                className="h-12 w-12 rounded-lg object-cover border shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="h-12 w-12 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 flex flex-col items-center justify-center shrink-0 border border-red-200/60 dark:border-red-900/40">
                                                                <FileText className="h-6 w-6" />
                                                                <span className="text-[9px] font-bold mt-0.5 uppercase">PDF</span>
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-xs text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                                                                    {standardFile.name}
                                                                </span>
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                                                    {standardFile.type.startsWith("image/") ? "Imagem" : "Documento PDF"}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                {formatFileSize(standardFile.size)} • Pronto para disparo
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleRemoveStandardFile}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 cursor-pointer"
                                                        title="Remover anexo"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Message Textarea */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold">
                                                {standardFile ? "Legenda do Arquivo" : "Mensagem de Texto"}
                                            </Label>
                                            <Textarea
                                                placeholder={standardFile ? "Digite uma legenda para acompanhar o arquivo (opcional)..." : "Digite a mensagem do disparo aqui..."}
                                                className="min-h-[120px] text-sm leading-relaxed"
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>

                                        {/* Delay & Send */}
                                        <div className="space-y-4 pt-2">
                                            <div className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border/50">
                                                <div className="flex justify-between items-center text-xs">
                                                    <Label className="font-semibold">Intervalo de Segurança (Delay):</Label>
                                                    <span className="font-mono font-bold text-primary">{(delay[0] / 1000).toFixed(1)}s</span>
                                                </div>
                                                <Slider
                                                    defaultValue={[2000]}
                                                    min={1000}
                                                    max={15000}
                                                    step={500}
                                                    value={delay}
                                                    onValueChange={setDelay}
                                                    disabled={loading}
                                                    className="cursor-pointer"
                                                />
                                            </div>

                                            <Button
                                                className="w-full font-semibold h-11 text-sm shadow-sm cursor-pointer"
                                                onClick={handleSend}
                                                disabled={loading || !sessionId || recipientCount === 0 || (!message.trim() && !standardFile)}
                                            >
                                                {loading ? (
                                                    <>
                                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando mensagens...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="mr-2 h-4 w-4" /> Iniciar Disparo Coletivo ({recipientCount})
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Live Progress Card */}
                        {broadcastProgress && (
                            <Card className={`border-2 transition-colors ${
                                broadcastProgress.status === "completed"
                                    ? (broadcastProgress.failed === 0 ? "border-green-500/40 bg-green-50/20 dark:bg-green-950/10" : "border-yellow-500/40 bg-yellow-50/20 dark:bg-yellow-950/10")
                                    : "border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/10"
                            }`}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                                        {broadcastProgress.status === "running" ? (
                                            <><Radio className="h-5 w-5 text-blue-500 animate-pulse" /><span>Disparo em Andamento</span></>
                                        ) : broadcastProgress.failed === 0 ? (
                                            <><CheckCircle2 className="h-5 w-5 text-emerald-500" /><span>Disparo Concluído com Sucesso</span></>
                                        ) : (
                                            <><AlertTriangle className="h-5 w-5 text-amber-500" /><span>Disparo Finalizado com Alertas</span></>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="text-xs font-mono">ID: {broadcastProgress.broadcastId}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-muted-foreground">Progresso do Envio</span>
                                            <span className="font-mono">
                                                {broadcastProgress.sent + broadcastProgress.failed} de {broadcastProgress.total} ({broadcastProgress.progress || 0}%)
                                            </span>
                                        </div>
                                        <Progress value={broadcastProgress.progress || 0} className="h-2.5" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-background rounded-lg p-3 text-center border shadow-2xs">
                                            <div className="text-2xl font-bold text-emerald-600">{broadcastProgress.sent}</div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1 font-medium">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Enviados
                                            </div>
                                        </div>
                                        <div className="bg-background rounded-lg p-3 text-center border shadow-2xs">
                                            <div className="text-2xl font-bold text-red-500">{broadcastProgress.failed}</div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1 font-medium">
                                                <XCircle className="h-3.5 w-3.5 text-red-500" /> Falhas
                                            </div>
                                        </div>
                                        <div className="bg-background rounded-lg p-3 text-center border shadow-2xs">
                                            <div className="text-2xl font-bold text-muted-foreground">
                                                {broadcastProgress.total - broadcastProgress.sent - broadcastProgress.failed}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1 font-medium">
                                                <Clock className="h-3.5 w-3.5" /> Pendentes
                                            </div>
                                        </div>
                                    </div>

                                    {broadcastProgress.status === "running" && broadcastProgress.current && (
                                        <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 bg-muted/60 rounded-lg border font-mono">
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                                            <span className="text-muted-foreground">Enviando agora para:</span>
                                            <span className="font-bold text-foreground truncate">{broadcastProgress.current}</span>
                                        </div>
                                    )}

                                    {broadcastProgress.errors && broadcastProgress.errors.length > 0 && (
                                        <div className="space-y-1.5 pt-2">
                                            <Label className="text-xs font-semibold text-destructive">Falhas Registradas ({broadcastProgress.errors.length}):</Label>
                                            <div className="max-h-36 overflow-y-auto space-y-1 text-xs font-mono bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                                                {broadcastProgress.errors.map((e, i) => (
                                                    <div key={i} className="flex justify-between items-center gap-2 text-destructive">
                                                        <span className="truncate">{e.jid}:</span>
                                                        <span className="shrink-0 text-[11px] opacity-80">{e.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* History Tab */}
                {activeTab === "history" && (
                    <Card className="shadow-xs border-border/70">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base font-bold">Histórico de Disparos</CardTitle>
                                <CardDescription className="text-xs">
                                    Consulte os disparos realizados nesta sessão, status de entrega e anexos.
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading} className="gap-1.5 cursor-pointer">
                                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                                Atualizar
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Carregando histórico...</span>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12 px-4 border border-dashed rounded-xl">
                                    <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                                    <h3 className="font-semibold text-sm">Nenhum disparo registrado</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Os disparos realizados nesta sessão serão listados aqui.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="pb-3 font-semibold">Data / Hora</th>
                                                <th className="pb-3 font-semibold">Conteúdo / Anexo</th>
                                                <th className="pb-3 font-semibold text-center">Total</th>
                                                <th className="pb-3 font-semibold text-center">Enviados</th>
                                                <th className="pb-3 font-semibold text-center">Falhas</th>
                                                <th className="pb-3 font-semibold">Status</th>
                                                <th className="pb-3 font-semibold text-right">Detalhes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {history.map(log => {
                                                const hasAttachment = log.message.startsWith("📎 [") || log.message.startsWith("📄 [");
                                                return (
                                                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                                                        <td className="py-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                                                            {formatTime(log.startedAt)}
                                                        </td>
                                                        <td className="py-3 max-w-[280px]">
                                                            {hasAttachment ? (
                                                                <span className="inline-flex items-center gap-1.5 font-medium text-primary truncate max-w-full">
                                                                    <Paperclip className="h-3 w-3 shrink-0" />
                                                                    <span className="truncate">{log.message}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="truncate block text-foreground">
                                                                    {log.message}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 text-center font-mono font-semibold">
                                                            {log.total}
                                                        </td>
                                                        <td className="py-3 text-center font-mono font-semibold text-emerald-600">
                                                            {log.sent}
                                                        </td>
                                                        <td className="py-3 text-center font-mono font-semibold text-red-500">
                                                            {log.failed}
                                                        </td>
                                                        <td className="py-3">
                                                            <Badge
                                                                variant={
                                                                    log.status === "completed"
                                                                        ? log.failed === 0 ? "default" : "secondary"
                                                                        : log.status === "running"
                                                                        ? "outline"
                                                                        : "destructive"
                                                                }
                                                                className="text-[10px] px-1.5 py-0 capitalize font-medium"
                                                            >
                                                                {log.status === "completed" ? "Concluído" : log.status === "running" ? "Enviando" : log.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openDetail(log)}
                                                                className="h-7 px-2 text-xs gap-1 cursor-pointer"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" /> Ver
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Detail Modal */}
                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                    <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <History className="h-4 w-4 text-primary" /> Detalhes do Disparo
                            </DialogTitle>
                        </DialogHeader>

                        {detailLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Carregando detalhes...</span>
                            </div>
                        ) : selectedLog && (
                            <div className="space-y-4 overflow-y-auto pr-1">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/40 border text-xs">
                                    <div>
                                        <span className="text-muted-foreground block text-[10px] uppercase">Data de Início</span>
                                        <span className="font-mono font-medium">{formatTime(selectedLog.startedAt)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[10px] uppercase">Status</span>
                                        <span className="font-semibold capitalize text-primary">{selectedLog.status}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[10px] uppercase">Enviados</span>
                                        <span className="font-mono font-bold text-emerald-600">{selectedLog.sent} / {selectedLog.total}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[10px] uppercase">Falhas</span>
                                        <span className="font-mono font-bold text-red-500">{selectedLog.failed}</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Resumo do Disparo</Label>
                                    <div className="p-3 rounded-lg border bg-card text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                                        {selectedLog.message}
                                    </div>
                                </div>

                                {selectedLog.recipients && selectedLog.recipients.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">
                                            Lista de Destinatários ({selectedLog.recipients.length})
                                        </Label>
                                        <div className="border rounded-lg max-h-48 overflow-y-auto divide-y divide-border/40 text-xs">
                                            {selectedLog.recipients.map(r => (
                                                <div key={r.id} className="flex items-center justify-between px-3 py-2">
                                                    <span className="font-mono text-muted-foreground truncate">{formatJid(r.jid)}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {r.status === "sent" ? (
                                                            <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                                                                <CheckCircle2 className="h-3 w-3" /> Enviado
                                                            </span>
                                                        ) : r.status === "failed" ? (
                                                            <span className="flex items-center gap-1 text-red-500 font-medium text-[11px]" title={r.error || ""}>
                                                                <XCircle className="h-3 w-3" /> Falhou
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                                                <Clock className="h-3 w-3" /> Pendente
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </SessionGuard>
    );
}
