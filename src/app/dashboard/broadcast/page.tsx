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
    Zap,
    Save,
    Search,
    UserCheck,
    Calendar,
    DollarSign,
    CheckSquare,
    Square,
    Image as ImageIcon,
    Megaphone,
    Target
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { useSocket } from "@/components/chat/socket-context";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

interface CollectiveContactRow {
    id: string;
    phone: string;
    name: string;
}

interface BroadcastTemplateItem {
    id: string;
    templateKey: string;
    title: string;
    content: string;
    category?: string;
    updatedAt?: string;
}

const DEFAULT_COLLECTIVE_TEMPLATES: Record<string, { title: string; content: string }> = {
    fatura_atraso: {
        title: "Aviso de Fatura em Atraso",
        content: `⚠️ *AVISO DE FATURA EM ATRASO* ⚠️\n\nOlá *[NOME]*, tudo bem?\n\nIdentificamos em nosso sistema que a fatura referente aos serviços contratados encontra-se em atraso.\n\n📌 *Dados da Cobrança:*\n• Cliente: *[NOME]*\n• Valor em Aberto: *[VALOR]*\n• Data de Vencimento: *[DATA]*\n\nPara evitar a suspensão temporária dos seus acessos e serviços, solicitamos a regularização o mais breve possível.\n\n🔑 *Chave PIX Copia e Cola:*\n[PIX]\n\n_Caso o pagamento já tenha sido efetuado nas últimas horas, por favor desconsidere este aviso ou nos envie o comprovante de pagamento por aqui._\n\nAgradecemos pela compreensão e parceria!\n*Equipe Financeira Nexus*`
    },
    vencimento_proximo: {
        title: "Vencimento se Aproxima",
        content: `📅 *LEMBRETE: SUA FATURA VENCE EM BREVE* 🔔\n\nOlá *[NOME]*, tudo bem?\n\nPassando para lembrar que a sua fatura mensal referente aos serviços Nexus vencerá em breve.\n\n📌 *Informações da Fatura:*\n• Cliente: *[NOME]*\n• Valor: *[VALOR]*\n• Vencimento: *[DATA]*\n\nVocê pode antecipar seu pagamento de forma rápida e prática utilizando a chave PIX Copia e Cola:\n\n🔑 *Chave PIX:*\n[PIX]\n\nAgradecemos pela pontualidade e preferência!\n*Equipe Financeira Nexus*`
    },
    vencimento_hoje: {
        title: "Vencimento Hoje",
        content: `⏰ *ATENÇÃO: SUA FATURA VENCE HOJE* ⏰\n\nOlá *[NOME]*, esperamos que esteja tudo bem!\n\nLembramos que a sua fatura mensal referente aos serviços contratados vence no dia de hoje: *[DATA]*.\n\n📌 *Resumo para Pagamento:*\n• Cliente: *[NOME]*\n• Valor: *[VALOR]*\n• Vencimento: *Hoje (*[DATA]*)*\n\nPara manter seus serviços operando normalmente sem interrupções, realize o pagamento com rapidez pelo PIX Copia e Cola:\n\n🔑 *Chave PIX:*\n[PIX]\n\n_Se você já realizou o pagamento hoje, desconsidere este lembrete._\n\nMuito obrigado pela parceria de sempre!\n*Equipe Financeira Nexus*`
    }
};

const DEFAULT_LEAD_TEMPLATES: Record<string, { title: string; content: string }> = {
    apresentacao_servicos: {
        title: "Apresentação & Demonstração",
        content: `Olá *[NOME]*, tudo bem? Espero que sim! 👋\n\nMe chamo [Seu Nome] da equipe comercial da *Nexus Soft Tech*.\n\nIdentifiquei uma excelente oportunidade de melhoria para o atendimento e a gestão da sua empresa via WhatsApp.\n\nTrabalhamos com soluções completas que incluem:\n✅ Central multiatendimento com vários atendentes em 1 único número\n✅ Disparos inteligentes e notificações automáticas\n✅ Gestão financeira integrada e envio de faturas/PIX\n\nGostaria de agendar uma breve demonstração de 10 minutinhos sem compromisso para você ver na prática?\n\n_Segue em anexo nossa apresentação detalhada._\n\nFico no aguardo do seu retorno!`
    },
    oferta_especial: {
        title: "Condição Especial & Desconto",
        content: `Olá *[NOME]*, tudo ótimo com você? 🚀\n\nPreparamos uma oportunidade exclusiva e por tempo limitado para sua empresa elevar o nível do atendimento via WhatsApp.\n\nAdquirindo nossa plataforma esta semana, você garante:\n🎁 Implantação e treinamento totalmente gratuitos\n🎁 Condição comercial diferenciada com desconto de lançamento\n🎁 Suporte prioritário dedicado\n\nSe tiver interesse em conhecer mais detalhes, basta responder esta mensagem que te envio uma proposta personalizada!\n\n_Dê uma olhada no anexo com mais informações._`
    },
    catalogo_pdf: {
        title: "Envio de Catálogo / Portfólio PDF",
        content: `Olá *[NOME]*, como vai? 📄✨\n\nEstamos compartilhando com você nosso *Catálogo / Portfólio Oficial Atualizado*.\n\nNo documento em anexo você encontrará todas as novidades, soluções e pacotes disponíveis com condições especiais.\n\nFico à inteira disposição para tirar dúvidas ou preparar um orçamento sob medida para você!\n\nUm forte abraço,\n*Equipe Nexus*`
    }
};

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

interface CsvLead {
    phone: string;
    company: string;
    originalPhone: string;
}

export default function BroadcastPage() {
    const { sessionId } = useSession();
    const [activeTab, setActiveTab] = useState<"new" | "history">("new");
    const [broadcastMode, setBroadcastMode] = useState<"standard" | "individual" | "leads">("individual");

    // Disparo Coletivo / Cobranças & Faturas State
    const [collectiveTargetMode, setCollectiveTargetMode] = useState<"single" | "multiple">("multiple");
    const [collectiveRows, setCollectiveRows] = useState<CollectiveContactRow[]>([
        { id: "1", phone: "", name: "" }
    ]);
    const [collectiveAmount, setCollectiveAmount] = useState("");
    const [collectiveDueDate, setCollectiveDueDate] = useState("");
    const [collectivePixCode, setCollectivePixCode] = useState("");
    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("fatura_atraso");
    const [savedTemplates, setSavedTemplates] = useState<Record<string, BroadcastTemplateItem>>({});
    const [templatesLoaded, setTemplatesLoaded] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [useDefaultBanner, setUseDefaultBanner] = useState(true);
    const [showPasteNumbers, setShowPasteNumbers] = useState(false);
    const [pastedNumbersText, setPastedNumbersText] = useState("");

    // Campanhas & Prospecção de Leads State
    const [leadsTargetMode, setLeadsTargetMode] = useState<"single" | "multiple">("multiple");
    const [leadRows, setLeadRows] = useState<CollectiveContactRow[]>([
        { id: "1", phone: "", name: "" }
    ]);
    const [selectedLeadTemplateKey, setSelectedLeadTemplateKey] = useState<string>("apresentacao_servicos");
    const [leadMessage, setLeadMessage] = useState(DEFAULT_LEAD_TEMPLATES.apresentacao_servicos.content);
    const [savedLeadTemplates, setSavedLeadTemplates] = useState<Record<string, BroadcastTemplateItem>>({});
    const [savingLeadTemplate, setSavingLeadTemplate] = useState(false);
    const [leadMediaFile, setLeadMediaFile] = useState<File | null>(null);
    const [leadMediaPreviewUrl, setLeadMediaPreviewUrl] = useState<string | null>(null);
    const leadFileInputRef = useRef<HTMLInputElement>(null);
    const [showPasteLeadNumbers, setShowPasteLeadNumbers] = useState(false);
    const [pastedLeadNumbersText, setPastedLeadNumbersText] = useState("");

    // Modal de Seleção de Contatos Salvos
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [systemContacts, setSystemContacts] = useState<any[]>([]);
    const [contactLoading, setContactLoading] = useState(false);
    const [contactSearch, setContactSearch] = useState("");
    const [selectedContactJids, setSelectedContactJids] = useState<Set<string>>(new Set());

    // Standard Mode State
    const [contacts, setContacts] = useState("");
    const [message, setMessage] = useState(DEFAULT_COLLECTIVE_TEMPLATES.fatura_atraso.content);
    const [standardFile, setStandardFile] = useState<File | null>(null);
    const [standardPreviewUrl, setStandardPreviewUrl] = useState<string | null>(null);
    const standardFileInputRef = useRef<HTMLInputElement>(null);
    const [csvLeads, setCsvLeads] = useState<CsvLead[]>([]);
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);

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

    // Spreadsheet (CSV & Excel .xlsx / .xls) Leads Import Handlers
    const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileNameLower = file.name.toLowerCase();
        const isExcel = fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls");
        const isCsv = fileNameLower.endsWith(".csv") || file.type === "text/csv";

        if (!isExcel && !isCsv) {
            toast.error("Por favor, selecione um arquivo no formato .csv ou .xlsx / .xls");
            return;
        }

        try {
            let rows: string[][] = [];

            if (isExcel) {
                const XLSX = await import("xlsx");
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    toast.error("A planilha do Excel está vazia.");
                    return;
                }
                const worksheet = workbook.Sheets[firstSheetName];
                const rawSheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                rows = rawSheetData.map(r => r.map(cell => String(cell ?? "").trim()));
            } else {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

                if (lines.length < 2) {
                    toast.error("O arquivo CSV está vazio ou contém apenas o cabeçalho.");
                    return;
                }

                // Detect delimiter (; or , or \t)
                const headerLine = lines[0];
                const semicolons = (headerLine.match(/;/g) || []).length;
                const commas = (headerLine.match(/,/g) || []).length;
                const tabs = (headerLine.match(/\t/g) || []).length;
                const delimiter = (semicolons >= commas && semicolons >= tabs && semicolons > 0)
                    ? ";"
                    : (tabs >= commas && tabs > 0 ? "\t" : ",");

                const parseCsvLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = "";
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            if (inQuotes && line[i + 1] === '"') {
                                current += '"';
                                i++;
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === delimiter && !inQuotes) {
                            result.push(current.trim());
                            current = "";
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };

                rows = lines.map(line => parseCsvLine(line));
            }

            if (rows.length < 2) {
                toast.error("A planilha está vazia ou contém apenas o cabeçalho.");
                return;
            }

            const headerRow = rows[0];
            const normalizedHeaders = headerRow.map(h =>
                h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
            );

            // Find phone and company index
            let phoneIdx = normalizedHeaders.findIndex(h => /telefone|celular|whatsapp|phone|contato|fone|mobile|numero|num/.test(h));
            let companyIdx = normalizedHeaders.findIndex(h => /empresa|company|razao|fantasia|negocio|organizacao|nomeempresa/.test(h));

            if (companyIdx === -1) {
                companyIdx = normalizedHeaders.findIndex(h => /lead|cliente|nome/.test(h));
            }

            // Fallback for phone column: inspect row 1
            if (phoneIdx === -1 && rows.length > 1) {
                phoneIdx = rows[1].findIndex(val => {
                    const digits = val.replace(/\D/g, "");
                    return digits.length >= 8 && digits.length <= 14;
                });
            }

            if (phoneIdx === -1) {
                toast.error("Não foi possível identificar a coluna de telefone. Verifique se o cabeçalho possui 'telefone', 'celular' ou 'whatsapp'.");
                return;
            }

            const extractedLeads: CsvLead[] = [];
            const phoneList: string[] = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length <= phoneIdx) continue;

                const rawPhone = row[phoneIdx] || "";
                const cleanDigits = rawPhone.replace(/\D/g, "");
                if (cleanDigits.length < 8) continue;

                const companyName = companyIdx !== -1 && row[companyIdx]
                    ? row[companyIdx].replace(/^["']|["']$/g, "").trim()
                    : "";

                extractedLeads.push({
                    phone: cleanDigits,
                    originalPhone: rawPhone.trim(),
                    company: companyName
                });
                phoneList.push(cleanDigits);
            }

            if (extractedLeads.length === 0) {
                toast.error("Nenhum lead com telefone válido foi encontrado no arquivo.");
                return;
            }

            setCsvLeads(extractedLeads);
            setCsvFileName(file.name);
            setContacts(phoneList.join("\n"));

            // Converte os leads da planilha diretamente para as linhas da tabela de destinatários
            const newCollectiveRows: CollectiveContactRow[] = extractedLeads.map((lead, idx) => ({
                id: String(Date.now() + idx + Math.random()),
                phone: lead.phone,
                name: lead.company || ""
            }));
            setCollectiveRows(newCollectiveRows);

            const companiesCount = extractedLeads.filter(l => l.company).length;
            if (companiesCount > 0) {
                toast.success(`${extractedLeads.length} clientes importados (${companiesCount} com nome identificado)!`);
            } else {
                toast.info(`${extractedLeads.length} telefones importados para a tabela.`);
            }
        } catch (err) {
            console.error("Erro ao processar planilha:", err);
            toast.error("Erro ao ler planilha. Verifique a formatação.");
        } finally {
            if (csvFileInputRef.current) csvFileInputRef.current.value = "";
        }
    };

    const handleClearCsv = () => {
        setCsvLeads([]);
        setCsvFileName(null);
        setContacts("");
        setCollectiveRows([{ id: String(Date.now()), phone: "", name: "" }]);
        if (csvFileInputRef.current) csvFileInputRef.current.value = "";
        toast.info("Planilha removida da tabela.");
    };

    // Ações das Linhas de Destinatários do Disparo Coletivo
    const addCollectiveRow = () => {
        setCollectiveRows(prev => [
            ...prev,
            { id: String(Date.now() + Math.random()), phone: "", name: "" }
        ]);
    };

    const updateCollectiveRow = (id: string, updates: Partial<CollectiveContactRow>) => {
        setCollectiveRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const removeCollectiveRow = (id: string) => {
        setCollectiveRows(prev => {
            if (prev.length <= 1) {
                return [{ id: String(Date.now()), phone: "", name: "" }];
            }
            return prev.filter(r => r.id !== id);
        });
    };

    const handleConvertPastedContactsToRows = () => {
        const rawPhones = pastedNumbersText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        if (rawPhones.length === 0) {
            toast.error("Nenhum número digitado para conversão.");
            return;
        }

        const newRows: CollectiveContactRow[] = rawPhones.map((phone, idx) => ({
            id: String(Date.now() + idx + Math.random()),
            phone,
            name: ""
        }));

        setCollectiveRows(prev => {
            const hasEmptyFirst = prev.length === 1 && !prev[0].phone && !prev[0].name;
            return hasEmptyFirst ? newRows : [...prev, ...newRows];
        });
        toast.success(`${newRows.length} contato(s) adicionado(s) à tabela!`);
        setPastedNumbersText("");
        setShowPasteNumbers(false);
    };

    // Carregar modelos de mensagens salvos no banco de dados
    const loadTemplates = useCallback(async () => {
        try {
            const res = await fetch("/api/broadcast/templates");
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.data)) {
                    const map: Record<string, BroadcastTemplateItem> = {};
                    data.data.forEach((item: BroadcastTemplateItem) => {
                        map[item.templateKey] = item;
                    });
                    setSavedTemplates(map);
                    setSavedLeadTemplates(map);
                    if (map["fatura_atraso"]?.content) {
                        setMessage(map["fatura_atraso"].content);
                    }
                    if (map["apresentacao_servicos"]?.content) {
                        setLeadMessage(map["apresentacao_servicos"].content);
                    }
                }
            }
        } catch (e) {
            console.error("Falha ao carregar modelos de broadcast:", e);
        } finally {
            setTemplatesLoaded(true);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    // Trocar de modelo de mensagem
    const handleSelectTemplate = (key: string) => {
        setSelectedTemplateKey(key);
        if (key === "custom") return;
        const tmpl = savedTemplates[key]?.content || DEFAULT_COLLECTIVE_TEMPLATES[key]?.content;
        if (tmpl) {
            setMessage(tmpl);
            toast.info(`Modelo "${DEFAULT_COLLECTIVE_TEMPLATES[key]?.title || key}" carregado.`);
        }
    };

    // Salvar modelo no banco de dados com precisão
    const handleSaveTemplateToDb = async () => {
        if (!selectedTemplateKey || selectedTemplateKey === "custom") {
            toast.error("Selecione um dos modelos específicos (Fatura em Atraso, Vencimento se Aproxima ou Vencimento Hoje) para salvar no banco de dados.");
            return;
        }
        if (!message.trim()) {
            toast.error("O texto da mensagem não pode estar vazio.");
            return;
        }

        setSavingTemplate(true);
        try {
            const currentTitle = DEFAULT_COLLECTIVE_TEMPLATES[selectedTemplateKey]?.title || selectedTemplateKey;
            const res = await fetch("/api/broadcast/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateKey: selectedTemplateKey,
                    title: currentTitle,
                    content: message,
                    category: "billing"
                })
            });

            const data = await res.json();
            if (res.ok && data.status) {
                setSavedTemplates(prev => ({
                    ...prev,
                    [selectedTemplateKey]: data.data
                }));
                toast.success(`Modelo "${currentTitle}" salvo no banco de dados com precisão!`);
            } else {
                toast.error(data.message || "Erro ao salvar modelo no banco de dados.");
            }
        } catch (e) {
            console.error("Erro ao salvar modelo:", e);
            toast.error("Falha ao salvar modelo no banco de dados.");
        } finally {
            setSavingTemplate(false);
        }
    };

    // Restaurar modelo original
    const handleRestoreDefaultTemplate = () => {
        if (selectedTemplateKey && DEFAULT_COLLECTIVE_TEMPLATES[selectedTemplateKey]) {
            setMessage(DEFAULT_COLLECTIVE_TEMPLATES[selectedTemplateKey].content);
            toast.info("Mensagem restaurada para o padrão oficial.");
        }
    };

    // --- FUNÇÕES ESPECÍFICAS DE LEADS & CAMPANHAS ---
    const addLeadRow = () => {
        setLeadRows(prev => [
            ...prev,
            { id: String(Date.now() + Math.random()), phone: "", name: "" }
        ]);
    };

    const updateLeadRow = (id: string, field: "phone" | "name", value: string) => {
        setLeadRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const removeLeadRow = (id: string) => {
        setLeadRows(prev => {
            if (prev.length <= 1) {
                return [{ id: String(Date.now()), phone: "", name: "" }];
            }
            return prev.filter(row => row.id !== id);
        });
    };

    const clearLeadRows = () => {
        setLeadRows([{ id: String(Date.now()), phone: "", name: "" }]);
        toast.info("Lista de leads limpa.");
    };

    const handleSelectLeadTemplate = (key: string) => {
        setSelectedLeadTemplateKey(key);
        if (key === "custom") return;
        const tmpl = savedLeadTemplates[key]?.content || DEFAULT_LEAD_TEMPLATES[key]?.content;
        if (tmpl) {
            setLeadMessage(tmpl);
            toast.info(`Modelo de prospecção "${DEFAULT_LEAD_TEMPLATES[key]?.title || key}" carregado.`);
        }
    };

    const handleSaveLeadTemplateToDb = async () => {
        if (!selectedLeadTemplateKey || selectedLeadTemplateKey === "custom") {
            toast.error("Selecione um dos modelos específicos de prospecção para salvar no banco de dados.");
            return;
        }
        if (!leadMessage.trim()) {
            toast.error("O texto da campanha não pode estar vazio.");
            return;
        }

        setSavingLeadTemplate(true);
        try {
            const currentTitle = DEFAULT_LEAD_TEMPLATES[selectedLeadTemplateKey]?.title || selectedLeadTemplateKey;
            const res = await fetch("/api/broadcast/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateKey: selectedLeadTemplateKey,
                    title: currentTitle,
                    content: leadMessage,
                    category: "leads"
                })
            });

            const data = await res.json();
            if (res.ok && data.status) {
                setSavedLeadTemplates(prev => ({
                    ...prev,
                    [selectedLeadTemplateKey]: data.data
                }));
                toast.success(`Modelo "${currentTitle}" salvo no banco de dados com sucesso!`);
            } else {
                toast.error(data.message || "Erro ao salvar modelo no banco de dados.");
            }
        } catch (e) {
            console.error("Erro ao salvar modelo de lead:", e);
            toast.error("Falha ao salvar modelo no banco de dados.");
        } finally {
            setSavingLeadTemplate(false);
        }
    };

    const handleRestoreDefaultLeadTemplate = () => {
        if (selectedLeadTemplateKey && DEFAULT_LEAD_TEMPLATES[selectedLeadTemplateKey]) {
            setLeadMessage(DEFAULT_LEAD_TEMPLATES[selectedLeadTemplateKey].content);
            toast.info("Texto restaurado para o modelo padrão.");
        }
    };

    const handleLeadMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast.error("O arquivo excede o limite máximo de 25MB.");
            return;
        }

        setLeadMediaFile(file);
        if (file.type.startsWith("image/")) {
            setLeadMediaPreviewUrl(URL.createObjectURL(file));
        } else {
            setLeadMediaPreviewUrl(null);
        }
        toast.success(`${file.type.startsWith("image/") ? "Imagem" : "PDF"} anexado: ${file.name}`);
    };

    const handleRemoveLeadMedia = () => {
        setLeadMediaFile(null);
        setLeadMediaPreviewUrl(null);
        if (leadFileInputRef.current) leadFileInputRef.current.value = "";
        toast.info("Anexo removido da campanha.");
    };

    const handleApplyPastedLeadNumbers = () => {
        if (!pastedLeadNumbersText.trim()) {
            toast.error("Cole ao menos um número de telefone.");
            return;
        }

        const lines = pastedLeadNumbersText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const newRows: CollectiveContactRow[] = [];
        const existingPhones = new Set(leadRows.map(r => r.phone.replace(/\D/g, "")).filter(Boolean));

        lines.forEach((line, idx) => {
            const parts = line.split(/[,;\t]/);
            const rawPhone = parts[0] || "";
            const cleanDigits = rawPhone.replace(/\D/g, "");
            const rawName = parts.slice(1).join(" ").trim();

            if (cleanDigits.length >= 8 && !existingPhones.has(cleanDigits)) {
                existingPhones.add(cleanDigits);
                newRows.push({
                    id: String(Date.now() + idx + Math.random()),
                    phone: cleanDigits,
                    name: rawName
                });
            }
        });

        if (newRows.length === 0) {
            toast.warning("Nenhum número novo válido encontrado.");
            return;
        }

        setLeadRows(prev => {
            const hasEmptyFirst = prev.length === 1 && !prev[0].phone && !prev[0].name;
            return hasEmptyFirst ? newRows : [...prev, ...newRows];
        });

        toast.success(`${newRows.length} lead(s) adicionado(s) à lista!`);
        setPastedLeadNumbersText("");
        setShowPasteLeadNumbers(false);
    };

    // Seleção de Contatos Salvos no Sistema
    const loadSystemContacts = async () => {
        if (!sessionId) return;
        setContactLoading(true);
        try {
            const res = await fetch(`/api/contacts/${sessionId}?limit=all`);
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data.data) ? data.data : [];
                setSystemContacts(list.filter((c: any) => !c.jid.endsWith("@g.us")));
            } else {
                toast.error("Erro ao carregar contatos do sistema.");
            }
        } catch (e) {
            console.error("Falha ao carregar contatos:", e);
            toast.error("Erro ao comunicar com a agenda de contatos.");
        } finally {
            setContactLoading(false);
        }
    };

    const handleOpenContactModal = () => {
        setSelectedContactJids(new Set());
        setContactSearch("");
        setContactModalOpen(true);
        loadSystemContacts();
    };

    const handleSelectSingleContact = (contact: any) => {
        const cleanPhone = contact.jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const contactName = contact.name || contact.notify || contact.verifiedName || "";
        
        if (broadcastMode === "leads") {
            setLeadRows(prev => {
                const updated = [...prev];
                updated[0] = {
                    id: updated[0]?.id || String(Date.now()),
                    phone: cleanPhone,
                    name: contactName
                };
                return updated;
            });
            setContactModalOpen(false);
            toast.success(`Lead ${contactName || cleanPhone} selecionado com sucesso!`);
            return;
        }

        setCollectiveRows(prev => {
            const updated = [...prev];
            updated[0] = {
                id: updated[0]?.id || String(Date.now()),
                phone: cleanPhone,
                name: contactName
            };
            return updated;
        });

        setContactModalOpen(false);
        toast.success(`Contato ${contactName || cleanPhone} selecionado com sucesso!`);
    };

    const handleToggleContactSelection = (jid: string) => {
        setSelectedContactJids(prev => {
            const next = new Set(prev);
            if (next.has(jid)) next.delete(jid);
            else next.add(jid);
            return next;
        });
    };

    const handleSelectAllFiltered = (filtered: any[]) => {
        setSelectedContactJids(new Set(filtered.map(c => c.jid)));
    };

    const handleClearContactSelection = () => {
        setSelectedContactJids(new Set());
    };

    const handleAddSelectedContactsToRows = () => {
        if (selectedContactJids.size === 0) {
            toast.warning("Nenhum contato selecionado.");
            return;
        }

        if (broadcastMode === "leads") {
            const existingPhones = new Set(leadRows.map(r => r.phone.replace(/\D/g, "")).filter(Boolean));
            const newRows: CollectiveContactRow[] = [];

            systemContacts.forEach((contact, idx) => {
                if (selectedContactJids.has(contact.jid)) {
                    const cleanPhone = contact.jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
                    const cleanDigits = cleanPhone.replace(/\D/g, "");
                    if (cleanDigits && !existingPhones.has(cleanDigits)) {
                        existingPhones.add(cleanDigits);
                        newRows.push({
                            id: String(Date.now() + idx + Math.random()),
                            phone: cleanPhone,
                            name: contact.name || contact.notify || contact.verifiedName || ""
                        });
                    }
                }
            });

            if (newRows.length === 0) {
                toast.info("Os contatos selecionados já constam na tabela de leads.");
            } else {
                setLeadRows(prev => {
                    const hasEmptyFirst = prev.length === 1 && !prev[0].phone && !prev[0].name;
                    return hasEmptyFirst ? newRows : [...prev, ...newRows];
                });
                toast.success(`${newRows.length} lead(s) adicionado(s) à tabela!`);
            }

            setContactModalOpen(false);
            return;
        }

        const existingPhones = new Set(collectiveRows.map(r => r.phone.replace(/\D/g, "")).filter(Boolean));
        const newRows: CollectiveContactRow[] = [];

        systemContacts.forEach((contact, idx) => {
            if (selectedContactJids.has(contact.jid)) {
                const cleanPhone = contact.jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
                const cleanDigits = cleanPhone.replace(/\D/g, "");
                if (cleanDigits && !existingPhones.has(cleanDigits)) {
                    existingPhones.add(cleanDigits);
                    newRows.push({
                        id: String(Date.now() + idx + Math.random()),
                        phone: cleanPhone,
                        name: contact.name || contact.notify || contact.verifiedName || ""
                    });
                }
            }
        });

        if (newRows.length === 0) {
            toast.info("Os contatos selecionados já constam na tabela.");
        } else {
            setCollectiveRows(prev => {
                const hasEmptyFirst = prev.length === 1 && !prev[0].phone && !prev[0].name;
                return hasEmptyFirst ? newRows : [...prev, ...newRows];
            });
            toast.success(`${newRows.length} contato(s) adicionado(s) à tabela!`);
        }

        setContactModalOpen(false);
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

            } else if (broadcastMode === "leads") {
                // Modo Campanhas & Prospecção de Leads
                const targetRows = leadsTargetMode === "single"
                    ? (leadRows[0]?.phone.trim().replace(/\D/g, "").length >= 8 ? [leadRows[0]] : [])
                    : leadRows.filter(r => r.phone.trim().replace(/\D/g, "").length >= 8);

                if (targetRows.length === 0) {
                    toast.error("Informe pelo menos 1 número de WhatsApp válido para o envio da campanha.");
                    setLoading(false);
                    return;
                }

                if (!leadMessage.trim() && !leadMediaFile) {
                    toast.error("Digite o texto da campanha ou selecione uma imagem/PDF de apresentação.");
                    setLoading(false);
                    return;
                }

                const itemsMeta = targetRows.map((row) => {
                    const formattedJid = formatToBrazilPhoneJid(row.phone);
                    let itemMsg = leadMessage
                        .replace(/\[NOME\]|{nome}/gi, row.name?.trim() || "")
                        .replace(/\[TELEFONE\]|{telefone}/gi, row.phone.trim() || "");

                    return {
                        jid: formattedJid,
                        name: row.name?.trim() || "",
                        message: itemMsg,
                        hasFile: !!leadMediaFile,
                        fileIndex: leadMediaFile ? 0 : -1
                    };
                });

                const formData = new FormData();
                formData.append("mode", "individual");
                formData.append("delay", String(delay[0]));
                formData.append("sendPixSeparately", "false");
                formData.append("items", JSON.stringify(itemsMeta));
                if (leadMediaFile) {
                    formData.append("file_0", leadMediaFile);
                }

                const res = await fetch(`/api/messages/${sessionId}/broadcast`, {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (res.ok) {
                    toast.info(`Campanha de prospecção iniciada para ${targetRows.length} lead${targetRows.length !== 1 ? "s" : ""}...`);
                } else {
                    toast.error(data.message || "Falha ao iniciar campanha de prospecção");
                    setLoading(false);
                }

            } else {
                // Modo Disparo Coletivo & Cobranças
                const targetRows = collectiveTargetMode === "single"
                    ? (collectiveRows[0]?.phone.trim().replace(/\D/g, "").length >= 8 ? [collectiveRows[0]] : [])
                    : collectiveRows.filter(r => r.phone.trim().replace(/\D/g, "").length >= 8);

                if (targetRows.length === 0) {
                    toast.error("Informe pelo menos 1 número de WhatsApp válido para o envio.");
                    setLoading(false);
                    return;
                }

                if (!message.trim() && !standardFile && !useDefaultBanner) {
                    toast.error("Digite o texto da mensagem ou selecione uma imagem/arquivo.");
                    setLoading(false);
                    return;
                }

                // Preparar imagem/anexo (arquivo personalizado ou banner profissional padrão)
                let fileToSend: File | null = standardFile;
                if (!fileToSend && useDefaultBanner) {
                    try {
                        const resp = await fetch("/fatura_atraso_default.jpg");
                        const blob = await resp.blob();
                        fileToSend = new File([blob], "aviso_fatura_nexus.jpg", { type: "image/jpeg" });
                    } catch (e) {
                        console.error("Não foi possível carregar o banner padrão, prosseguindo sem arquivo:", e);
                    }
                }

                let formattedAmount = collectiveAmount.trim();
                if (formattedAmount && !formattedAmount.startsWith("R$")) {
                    formattedAmount = `R$ ${formattedAmount}`;
                }

                const pixReplacement = (sendPixSeparately && collectivePixCode.trim())
                    ? "👇 (Enviado em mensagem separada a seguir para você copiar)"
                    : (collectivePixCode.trim() || "");

                const itemsMeta = targetRows.map((row) => {
                    const formattedJid = formatToBrazilPhoneJid(row.phone);
                    let itemMsg = message
                        .replace(/\[NOME\]|{nome}/gi, row.name?.trim() || "")
                        .replace(/\[VALOR\]|{valor}/gi, formattedAmount || "")
                        .replace(/\[DATA\]|\[VENCIMENTO\]|{data}|{vencimento}/gi, collectiveDueDate.trim() || "")
                        .replace(/\[PIX\]|{pix}/gi, pixReplacement)
                        .replace(/\[TELEFONE\]|{telefone}/gi, row.phone.trim() || "");

                    return {
                        jid: formattedJid,
                        name: row.name?.trim() || "",
                        pix: collectivePixCode.trim() || "",
                        message: itemMsg,
                        hasFile: !!fileToSend,
                        fileIndex: fileToSend ? 0 : -1
                    };
                });

                const formData = new FormData();
                formData.append("mode", "individual");
                formData.append("delay", String(delay[0]));
                formData.append("sendPixSeparately", sendPixSeparately && collectivePixCode.trim() ? "true" : "false");
                formData.append("items", JSON.stringify(itemsMeta));
                if (fileToSend) {
                    formData.append("file_0", fileToSend);
                }

                const res = await fetch(`/api/messages/${sessionId}/broadcast`, {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (res.ok) {
                    toast.info(`Disparo coletivo iniciado para ${targetRows.length} destinatário${targetRows.length !== 1 ? "s" : ""}...`);
                } else {
                    toast.error(data.message || "Falha ao iniciar disparo coletivo");
                    setLoading(false);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar disparo");
            setLoading(false);
        }
    };

    const collectiveValidRows = collectiveTargetMode === "single"
        ? (collectiveRows[0]?.phone.trim().replace(/\D/g, "").length >= 8 ? [collectiveRows[0]] : [])
        : collectiveRows.filter(r => r.phone.trim().replace(/\D/g, "").length >= 8);

    const leadValidRows = leadsTargetMode === "single"
        ? (leadRows[0]?.phone.trim().replace(/\D/g, "").length >= 8 ? [leadRows[0]] : [])
        : leadRows.filter(r => r.phone.trim().replace(/\D/g, "").length >= 8);

    const recipientCount = broadcastMode === "individual"
        ? individualRows.filter(r => r.phone.trim().length >= 8).length
        : broadcastMode === "leads"
            ? leadValidRows.length
            : collectiveValidRows.length;

    const filesCount = broadcastMode === "individual"
        ? individualRows.filter(r => r.file !== null).length
        : broadcastMode === "leads"
            ? (leadMediaFile ? 1 : 0)
            : (standardFile || useDefaultBanner) ? 1 : 0;

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
                                    Escolha entre envio individualizado de boletos, disparos coletivos de cobrança, ou campanhas de prospecção para leads.
                                </p>
                            </div>

                            <div className="flex gap-1.5 bg-background p-1 rounded-xl border shadow-2xs flex-wrap">
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
                                    <Users className="h-3.5 w-3.5" /> Disparo Coletivo & Cobranças
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBroadcastMode("leads")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        broadcastMode === "leads"
                                            ? "bg-primary text-primary-foreground shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Megaphone className="h-3.5 w-3.5" /> Campanhas & Prospecção de Leads
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

                        {/* MODE 2: DISPARO COLETIVO & COBRANÇAS */}
                        {broadcastMode === "standard" && (
                            <div className="space-y-6">
                                <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                                    {/* Destinatários Card (5 Cols) - Estilo Disparo de Boletos com WhatsApp e Nome Cliente */}
                                    <Card className="lg:col-span-5 shadow-xs border-border/70 flex flex-col justify-between">
                                        <div>
                                            <CardHeader className="flex flex-col gap-3 pb-3 border-b bg-muted/20">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                            <Users className="h-4 w-4 text-primary" /> Destinatários do Disparo
                                                        </CardTitle>
                                                        <CardDescription className="text-xs mt-0.5">
                                                            Envie para 1 número específico ou organize múltiplos contatos na tabela.
                                                        </CardDescription>
                                                    </div>

                                                    {/* Toggle 1 Número vs Múltiplos Números */}
                                                    <div className="flex items-center p-0.5 bg-background rounded-lg border shadow-2xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCollectiveTargetMode("single")}
                                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                                                                collectiveTargetMode === "single"
                                                                    ? "bg-primary text-primary-foreground shadow-xs"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            1 Número
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCollectiveTargetMode("multiple")}
                                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                                                                collectiveTargetMode === "multiple"
                                                                    ? "bg-primary text-primary-foreground shadow-xs"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            Vários Números
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Toolbar de Ações Rápidas */}
                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleOpenContactModal}
                                                        className="h-7 text-[11px] gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                                                        disabled={loading}
                                                    >
                                                        <UserCheck className="h-3.5 w-3.5" /> Selecionar Contatos Salvos
                                                    </Button>

                                                    {collectiveTargetMode === "multiple" && (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={addCollectiveRow}
                                                                className="h-7 text-[11px] gap-1 cursor-pointer font-semibold"
                                                                disabled={loading}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" /> Adicionar Cliente
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setShowPasteNumbers(!showPasteNumbers)}
                                                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                                            >
                                                                {showPasteNumbers ? "Ocultar Colar em Lote" : "Colar em Lote"}
                                                            </Button>

                                                            <input
                                                                ref={csvFileInputRef}
                                                                type="file"
                                                                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                                                className="hidden"
                                                                onChange={handleSpreadsheetUpload}
                                                                disabled={loading}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => csvFileInputRef.current?.click()}
                                                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                disabled={loading}
                                                                title="Importar de arquivo CSV ou Excel"
                                                            >
                                                                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV/Excel
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-4 space-y-3">
                                                {/* Caixa para Colar Números em Lote se ativada */}
                                                {showPasteNumbers && collectiveTargetMode === "multiple" && (
                                                    <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                                                        <Label className="text-xs font-semibold text-primary flex items-center justify-between">
                                                            <span>Colar lista de números (um por linha):</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPasteNumbers(false)}
                                                                className="text-[10px] text-muted-foreground hover:text-foreground"
                                                            >
                                                                Fechar
                                                            </button>
                                                        </Label>
                                                        <Textarea
                                                            placeholder={"(11) 98765-4321\n11912345678\n552199887766"}
                                                            className="min-h-[80px] font-mono text-xs bg-background"
                                                            value={pastedNumbersText}
                                                            onChange={e => setPastedNumbersText(e.target.value)}
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={handleConvertPastedContactsToRows}
                                                            className="w-full h-7 text-xs font-semibold cursor-pointer"
                                                        >
                                                            Converter e Adicionar à Tabela
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* CSV Leads Banner se houver */}
                                                {csvLeads.length > 0 && (
                                                    <div className="p-2.5 rounded-lg border border-primary/25 bg-primary/5 flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                                                            <span className="font-semibold text-foreground truncate max-w-[150px]" title={csvFileName || ""}>
                                                                {csvFileName || "planilha.csv"}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary font-bold">
                                                                {csvLeads.length} leads
                                                            </Badge>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleClearCsv}
                                                            className="text-muted-foreground hover:text-red-500 p-0.5 cursor-pointer text-xs"
                                                            title="Limpar planilha"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* MODO 1: ENVIAR PARA APENAS 1 NÚMERO */}
                                                {collectiveTargetMode === "single" ? (
                                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3.5">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-semibold text-foreground">
                                                                WhatsApp do Cliente <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                placeholder="(11) 98765-4321 ou 11987654321"
                                                                value={collectiveRows[0]?.phone || ""}
                                                                onChange={e => updateCollectiveRow(collectiveRows[0]?.id || "1", { phone: e.target.value })}
                                                                className="h-9 text-xs font-mono bg-background"
                                                                disabled={loading}
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-semibold text-foreground">
                                                                Nome do Cliente (para preenchimento de <code className="text-primary font-mono text-[11px]">*&#91;NOME&#93;*</code>)
                                                            </Label>
                                                            <Input
                                                                placeholder="Ex: Carlos Silva"
                                                                value={collectiveRows[0]?.name || ""}
                                                                onChange={e => updateCollectiveRow(collectiveRows[0]?.id || "1", { name: e.target.value })}
                                                                className="h-9 text-xs bg-background"
                                                                disabled={loading}
                                                            />
                                                        </div>

                                                        <div className="pt-1">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleOpenContactModal}
                                                                className="w-full text-xs gap-1.5 h-8 font-medium cursor-pointer"
                                                            >
                                                                <Search className="h-3.5 w-3.5 text-primary" /> Buscar nos Contatos Salvos no Sistema
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* MODO 2: ENVIAR PARA DIVERSOS NÚMEROS (Tabela exatamente como no disparo de boletos, sem pix/valor/vencimento) */
                                                    <div className="border rounded-xl overflow-hidden shadow-2xs">
                                                        <div className="overflow-x-auto max-h-[380px]">
                                                            <table className="w-full text-xs">
                                                                <thead className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10">
                                                                    <tr className="border-b text-left text-muted-foreground">
                                                                        <th className="py-2 px-2.5 font-semibold w-10 text-center">#</th>
                                                                        <th className="py-2 px-2.5 font-semibold min-w-[140px]">WhatsApp</th>
                                                                        <th className="py-2 px-2.5 font-semibold min-w-[140px]">Nome Cliente</th>
                                                                        <th className="py-2 px-1.5 font-semibold w-10 text-center">Ação</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border/40 bg-background">
                                                                    {collectiveRows.map((row, index) => (
                                                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                                                            <td className="py-2 px-2.5 text-center font-mono text-muted-foreground font-semibold">
                                                                                {index + 1}
                                                                            </td>
                                                                            <td className="py-2 px-2.5">
                                                                                <Input
                                                                                    placeholder="(11) 98765-4321"
                                                                                    value={row.phone}
                                                                                    onChange={e => updateCollectiveRow(row.id, { phone: e.target.value })}
                                                                                    className="h-7.5 text-xs font-mono"
                                                                                    disabled={loading}
                                                                                />
                                                                            </td>
                                                                            <td className="py-2 px-2.5">
                                                                                <Input
                                                                                    placeholder="Ex: Carlos Silva"
                                                                                    value={row.name}
                                                                                    onChange={e => updateCollectiveRow(row.id, { name: e.target.value })}
                                                                                    className="h-7.5 text-xs"
                                                                                    disabled={loading}
                                                                                />
                                                                            </td>
                                                                            <td className="py-2 px-1.5 text-center">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeCollectiveRow(row.id)}
                                                                                    className="text-muted-foreground hover:text-red-600 p-1 cursor-pointer transition-colors"
                                                                                    title="Remover linha"
                                                                                    disabled={loading}
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="p-2.5 border-t bg-muted/20 flex items-center justify-between">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={addCollectiveRow}
                                                                className="h-7 text-xs gap-1 font-semibold cursor-pointer"
                                                                disabled={loading}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" /> Adicionar Mais um Cliente
                                                            </Button>

                                                            <span className="text-[11px] font-semibold text-muted-foreground">
                                                                {collectiveValidRows.length} cliente{collectiveValidRows.length !== 1 ? "s" : ""} válido{collectiveValidRows.length !== 1 ? "s" : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </div>

                                        {/* Rodapé informativo de contatos */}
                                        <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                Formato automático com DDI +55
                                            </span>
                                            <span className="font-semibold text-primary">
                                                Total: {recipientCount} destinatário{recipientCount !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </Card>

                                    {/* Mensagem, Modelos & Imagem Profissional (7 Cols) */}
                                    <Card className="lg:col-span-7 shadow-xs border-border/70">
                                        <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-amber-500" /> Modelos & Conteúdo da Mensagem
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    Escolha um modelo inteligente, personalize o texto e salve no banco de dados.
                                                </CardDescription>
                                            </div>

                                            {/* Botão de Salvar no Banco de Dados */}
                                            {selectedTemplateKey !== "custom" && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleSaveTemplateToDb}
                                                    disabled={savingTemplate || loading}
                                                    className="h-7.5 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs shrink-0"
                                                >
                                                    {savingTemplate ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Save className="h-3.5 w-3.5" />
                                                    )}
                                                    Salvar no Banco de Dados
                                                </Button>
                                            )}
                                        </CardHeader>

                                        <CardContent className="p-5 space-y-4">
                                            {/* Seletor de Modelos Pré-Configurados */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-semibold text-foreground">
                                                        Modelos Pré-Configurados:
                                                    </Label>
                                                    {selectedTemplateKey !== "custom" && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRestoreDefaultTemplate}
                                                            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <RefreshCw className="h-3 w-3" /> Restaurar Padrão
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectTemplate("fatura_atraso")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedTemplateKey === "fatura_atraso"
                                                                ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                            <span>Fatura em Atraso</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Aviso de pendência
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectTemplate("vencimento_proximo")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedTemplateKey === "vencimento_proximo"
                                                                ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-400 shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                            <span>Vence em Breve</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Lembrete prévio
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectTemplate("vencimento_hoje")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedTemplateKey === "vencimento_hoje"
                                                                ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400 shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <Calendar className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                                            <span>Vencimento Hoje</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Aviso do dia
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTemplateKey("custom")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedTemplateKey === "custom"
                                                                ? "bg-primary/10 border-primary/40 text-primary shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                            <span>Mensagem Livre</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Texto personalizado
                                                        </p>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Textarea da Mensagem */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <Label className="text-xs font-semibold">
                                                        Texto da Mensagem:
                                                    </Label>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <span className="text-[10px] text-muted-foreground font-medium">Inserir:</span>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMessage(prev => prev + " *[NOME]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Nome
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMessage(prev => prev + " *[VALOR]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Valor
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMessage(prev => prev + " *[DATA]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Vencimento
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMessage(prev => prev + " [PIX]")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Pix
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMessage(prev => prev + " *[TELEFONE]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Tel
                                                        </Button>
                                                    </div>
                                                </div>

                                                <Textarea
                                                    placeholder="Digite a mensagem do disparo..."
                                                    className="min-h-[140px] text-xs font-mono leading-relaxed bg-background"
                                                    value={message}
                                                    onChange={e => setMessage(e.target.value)}
                                                    disabled={loading}
                                                />
                                            </div>

                                            {/* Parâmetros Globais Opcionais (Preenchem [VALOR], [DATA] e [PIX]) */}
                                            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Dados da Cobrança / Fatura (Opcional):
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">Preenche as variáveis do texto</span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                    <div>
                                                        <Label className="text-[11px] text-muted-foreground font-medium">Valor Total:</Label>
                                                        <Input
                                                            placeholder="R$ 150,00"
                                                            value={collectiveAmount}
                                                            onChange={e => setCollectiveAmount(e.target.value)}
                                                            className="h-7.5 text-xs bg-background mt-1"
                                                            disabled={loading}
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-muted-foreground font-medium">Data de Vencimento:</Label>
                                                        <Input
                                                            placeholder="10/10/2026 ou Hoje"
                                                            value={collectiveDueDate}
                                                            onChange={e => setCollectiveDueDate(e.target.value)}
                                                            className="h-7.5 text-xs bg-background mt-1"
                                                            disabled={loading}
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-muted-foreground font-medium">Chave Pix Copia e Cola:</Label>
                                                        <Input
                                                            placeholder="00020126... ou Chave Pix"
                                                            value={collectivePixCode}
                                                            onChange={e => setCollectivePixCode(e.target.value)}
                                                            className="h-7.5 text-xs font-mono bg-background mt-1"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Switch Pix Separado */}
                                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                                    <div className="space-y-0.5 pr-2">
                                                        <Label htmlFor="collective-pix-sep" className="text-xs font-semibold cursor-pointer">
                                                            Enviar Código Pix em mensagem separada logo após o aviso
                                                        </Label>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Permite ao cliente copiar a chave PIX com 1 toque no celular sem copiar o texto junto.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        id="collective-pix-sep"
                                                        checked={sendPixSeparately}
                                                        onCheckedChange={setSendPixSeparately}
                                                    />
                                                </div>
                                            </div>

                                            {/* Imagem Profissional de Fatura / Aviso de Cobrança */}
                                            <div className="space-y-2 pt-1">
                                                <Label className="text-xs font-semibold flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <ImageIcon className="h-3.5 w-3.5 text-primary" /> Imagem Profissional do Disparo
                                                    </span>
                                                    {standardFile && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveStandardFile}
                                                            className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-medium"
                                                        >
                                                            <X className="h-3 w-3" /> Remover arquivo próprio
                                                        </button>
                                                    )}
                                                </Label>

                                                {/* Se tiver arquivo próprio carregado */}
                                                {standardFile ? (
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
                                                                <span className="font-semibold text-xs text-foreground truncate block max-w-[220px]">
                                                                    {standardFile.name}
                                                                </span>
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                    {formatFileSize(standardFile.size)} • Arquivo próprio anexado
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={handleRemoveStandardFile}
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 cursor-pointer"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : useDefaultBanner ? (
                                                    /* Banner Profissional Padrão */
                                                    <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold border-0">
                                                                    Banner Profissional Integrado
                                                                </Badge>
                                                                <span className="text-[11px] text-muted-foreground">Alta Resolução • Design Executivo</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUseDefaultBanner(false)}
                                                                className="text-[11px] text-muted-foreground hover:text-red-500 cursor-pointer"
                                                            >
                                                                Não enviar imagem
                                                            </button>
                                                        </div>

                                                        <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[140px] bg-slate-950">
                                                            <img
                                                                src="/fatura_atraso_default.jpg"
                                                                alt="Banner de Fatura em Atraso"
                                                                className="w-full h-full object-cover max-h-[140px]"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2.5">
                                                                <span className="text-[11px] text-white font-medium">
                                                                    Arte profissional de fatura e cobrança pronta para envio no WhatsApp
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between pt-1">
                                                            <input
                                                                ref={standardFileInputRef}
                                                                type="file"
                                                                accept="image/*,application/pdf"
                                                                className="hidden"
                                                                onChange={handleStandardFileSelect}
                                                                disabled={loading}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => standardFileInputRef.current?.click()}
                                                                className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <UploadCloud className="h-3.5 w-3.5" /> Trocar por Imagem Própria ou PDF
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Estado sem imagem */
                                                    <div className="p-3.5 rounded-xl border border-dashed text-center space-y-2 bg-muted/20">
                                                        <p className="text-xs text-muted-foreground">Nenhuma imagem selecionada (o disparo enviará apenas texto).</p>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setUseDefaultBanner(true)}
                                                                className="h-7 text-xs font-semibold cursor-pointer text-primary"
                                                            >
                                                                <Sparkles className="h-3 w-3 mr-1" /> Usar Banner Profissional Nexus
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => standardFileInputRef.current?.click()}
                                                                className="h-7 text-xs cursor-pointer"
                                                            >
                                                                <Paperclip className="h-3 w-3 mr-1" /> Carregar Arquivo
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delay e Botão de Disparo */}
                                            <div className="space-y-4 pt-3 border-t">
                                                <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/50">
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
                                                </div>

                                                <Button
                                                    className="w-full font-bold h-12 text-sm shadow-md cursor-pointer bg-primary hover:bg-primary/90"
                                                    onClick={handleSend}
                                                    disabled={loading || !sessionId || recipientCount === 0 || (!message.trim() && !standardFile && !useDefaultBanner)}
                                                >
                                                    {loading ? (
                                                        <>
                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando mensagens...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="mr-2 h-4 w-4" /> Iniciar Disparo Coletivo ({recipientCount} Destinatário{recipientCount !== 1 ? "s" : ""})
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {/* MODE 3: CAMPANHAS & PROSPECÇÃO DE LEADS */}
                        {broadcastMode === "leads" && (
                            <div className="space-y-6">
                                <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                                    {/* Destinatários Card (5 Cols) - Lista de Leads e Prospecção */}
                                    <Card className="lg:col-span-5 shadow-xs border-border/70 flex flex-col justify-between">
                                        <div>
                                            <CardHeader className="flex flex-col gap-3 pb-3 border-b bg-muted/20">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                            <Target className="h-4 w-4 text-primary" /> Destinatários da Campanha
                                                        </CardTitle>
                                                        <CardDescription className="text-xs mt-0.5">
                                                            Insira os números dos contatos ou leads para prospecção.
                                                        </CardDescription>
                                                    </div>

                                                    {/* Toggle 1 Lead vs Múltiplos Leads */}
                                                    <div className="flex items-center p-0.5 bg-background rounded-lg border shadow-2xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => setLeadsTargetMode("single")}
                                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                                                                leadsTargetMode === "single"
                                                                    ? "bg-primary text-primary-foreground shadow-xs"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            1 Lead
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLeadsTargetMode("multiple")}
                                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                                                                leadsTargetMode === "multiple"
                                                                    ? "bg-primary text-primary-foreground shadow-xs"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            Vários Leads
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Toolbar de Ações Rápidas */}
                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleOpenContactModal}
                                                        className="h-7 text-[11px] gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                                                        disabled={loading}
                                                    >
                                                        <UserCheck className="h-3.5 w-3.5" /> Selecionar Contatos Salvos
                                                    </Button>

                                                    {leadsTargetMode === "multiple" && (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={addLeadRow}
                                                                className="h-7 text-[11px] gap-1 cursor-pointer font-semibold"
                                                                disabled={loading}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" /> Adicionar Lead
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setShowPasteLeadNumbers(!showPasteLeadNumbers)}
                                                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                                            >
                                                                📋 Colar Lista
                                                            </Button>

                                                            {leadRows.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={clearLeadRows}
                                                                    className="h-7 text-[11px] gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer ml-auto"
                                                                >
                                                                    <Trash2 className="h-3 w-3" /> Limpar
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Caixa Retrátil de Colar Telefones em Massa */}
                                                {showPasteLeadNumbers && leadsTargetMode === "multiple" && (
                                                    <div className="p-3 bg-background rounded-xl border border-primary/20 space-y-2 mt-1">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[11px] font-semibold text-primary">
                                                                Cole números ou "Telefone, Nome" (um por linha):
                                                            </Label>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPasteLeadNumbers(false)}
                                                                className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                                            >
                                                                Fechar
                                                            </button>
                                                        </div>
                                                        <Textarea
                                                            placeholder="557999887766, Lucas Melo&#10;5511999998888, Padaria Central&#10;5521988887777"
                                                            value={pastedLeadNumbersText}
                                                            onChange={e => setPastedLeadNumbersText(e.target.value)}
                                                            rows={3}
                                                            className="text-xs font-mono"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={handleApplyPastedLeadNumbers}
                                                                className="h-7 text-xs font-semibold cursor-pointer"
                                                            >
                                                                Adicionar à Lista
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardHeader>

                                            <CardContent className="p-4 space-y-4">
                                                {/* Modo 1 Lead / Teste */}
                                                {leadsTargetMode === "single" ? (
                                                    <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-semibold">
                                                                WhatsApp do Lead: <span className="text-red-500">*</span>
                                                            </Label>
                                                            <Input
                                                                placeholder="ex: 5579999887766 ou 79999887766"
                                                                value={leadRows[0]?.phone || ""}
                                                                onChange={e => updateLeadRow(leadRows[0]?.id || "1", "phone", e.target.value)}
                                                                className="h-8 text-xs font-mono"
                                                                disabled={loading}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs font-semibold">
                                                                Nome do Lead / Empresa: <span className="text-muted-foreground font-normal">(opcional)</span>
                                                            </Label>
                                                            <Input
                                                                placeholder="ex: Dr. Ricardo / Loja Alpha"
                                                                value={leadRows[0]?.name || ""}
                                                                onChange={e => updateLeadRow(leadRows[0]?.id || "1", "name", e.target.value)}
                                                                className="h-8 text-xs"
                                                                disabled={loading}
                                                            />
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                Substitui a tag <code className="bg-muted px-1 rounded text-[10px] font-mono">*&#91;NOME&#93;*</code> na mensagem.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Modo Vários Leads: Tabela */
                                                    <div className="border border-border/70 rounded-xl overflow-hidden bg-card shadow-2xs">
                                                        <div className="max-h-[380px] overflow-y-auto">
                                                            <table className="w-full text-xs text-left border-collapse">
                                                                <thead className="bg-muted/40 sticky top-0 z-10 border-b text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                                                                    <tr>
                                                                        <th className="py-2 px-3 w-10 text-center">#</th>
                                                                        <th className="py-2 px-3">WhatsApp do Lead <span className="text-red-500">*</span></th>
                                                                        <th className="py-2 px-3">Nome / Empresa</th>
                                                                        <th className="py-2 px-3 w-12 text-center">Ação</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border/50">
                                                                    {leadRows.map((row, index) => {
                                                                        const hasValidPhone = row.phone.trim().replace(/\D/g, "").length >= 8;
                                                                        return (
                                                                            <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                                                                                <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[11px]">
                                                                                    {index + 1}
                                                                                </td>
                                                                                <td className="py-2 px-3">
                                                                                    <Input
                                                                                        placeholder="ex: 557999887766"
                                                                                        value={row.phone}
                                                                                        onChange={e => updateLeadRow(row.id, "phone", e.target.value)}
                                                                                        className={`h-7.5 text-xs font-mono ${
                                                                                            row.phone && !hasValidPhone
                                                                                                ? "border-red-400 focus-visible:ring-red-400"
                                                                                                : ""
                                                                                        }`}
                                                                                        disabled={loading}
                                                                                    />
                                                                                </td>
                                                                                <td className="py-2 px-3">
                                                                                    <Input
                                                                                        placeholder="Nome / Empresa"
                                                                                        value={row.name}
                                                                                        onChange={e => updateLeadRow(row.id, "name", e.target.value)}
                                                                                        className="h-7.5 text-xs"
                                                                                        disabled={loading}
                                                                                    />
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => removeLeadRow(row.id)}
                                                                                        className="text-muted-foreground hover:text-red-500 transition-colors p-1 cursor-pointer"
                                                                                        title="Remover linha"
                                                                                        disabled={loading}
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </div>

                                        {/* Status Footer */}
                                        <div className="p-3 bg-muted/20 border-t flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                Leads válidos: <strong className="text-foreground font-mono">{leadValidRows.length}</strong>
                                            </span>
                                            {leadsTargetMode === "multiple" && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={addLeadRow}
                                                    className="h-7 text-xs font-semibold text-primary cursor-pointer gap-1"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Adicionar Linha
                                                </Button>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Conteúdo da Mensagem & Anexo (Imagem ou PDF) (7 Cols) */}
                                    <Card className="lg:col-span-7 shadow-xs border-border/70 flex flex-col justify-between">
                                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                                            <div>
                                                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-amber-500" /> Mensagem da Campanha & Proposta
                                                </CardTitle>
                                                <CardDescription className="text-xs mt-0.5">
                                                    Configure o texto persuasivo e anexe uma foto ou documento PDF (catálogo/apresentação).
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleSaveLeadTemplateToDb}
                                                    disabled={savingLeadTemplate || loading || selectedLeadTemplateKey === "custom"}
                                                    className="h-7.5 text-xs font-semibold gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                                                >
                                                    {savingLeadTemplate ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Save className="h-3.5 w-3.5" />
                                                    )}
                                                    Salvar no Banco
                                                </Button>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-5 space-y-4">
                                            {/* Modelos Inteligentes de Prospecção */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-foreground">
                                                        Modelos de Prospecção:
                                                    </Label>
                                                    {selectedLeadTemplateKey !== "custom" && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRestoreDefaultLeadTemplate}
                                                            className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                                        >
                                                            Restaurar padrão
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectLeadTemplate("apresentacao_servicos")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedLeadTemplateKey === "apresentacao_servicos"
                                                                ? "bg-primary/10 border-primary/40 text-primary shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                                            <span>Apresentação</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Demonstração
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectLeadTemplate("oferta_especial")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedLeadTemplateKey === "oferta_especial"
                                                                ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                            <span>Oferta Especial</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Condição e desconto
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectLeadTemplate("catalogo_pdf")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedLeadTemplateKey === "catalogo_pdf"
                                                                ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400 shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                                            <span>Catálogo PDF</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Portfólio em anexo
                                                        </p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectLeadTemplate("custom")}
                                                        className={`p-2 rounded-lg text-left text-xs font-semibold transition-all border cursor-pointer ${
                                                            selectedLeadTemplateKey === "custom"
                                                                ? "bg-primary/10 border-primary/40 text-primary shadow-2xs"
                                                                : "bg-background hover:bg-muted/50 text-muted-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold truncate">
                                                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                            <span>Mensagem Livre</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                            Texto personalizado
                                                        </p>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Textarea da Mensagem */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <Label className="text-xs font-semibold">
                                                        Texto da Mensagem:
                                                    </Label>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <span className="text-[10px] text-muted-foreground font-medium">Inserir:</span>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setLeadMessage(prev => prev + " *[NOME]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Nome (*&#91;NOME&#93;*)
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setLeadMessage(prev => prev + " *[TELEFONE]*")}
                                                            className="h-6 text-[10px] px-1.5 gap-1 cursor-pointer font-medium"
                                                        >
                                                            + Tel (*&#91;TELEFONE&#93;*)
                                                        </Button>
                                                    </div>
                                                </div>

                                                <Textarea
                                                    placeholder="Digite o texto da sua campanha de prospecção..."
                                                    className="min-h-[140px] text-xs font-mono leading-relaxed bg-background"
                                                    value={leadMessage}
                                                    onChange={e => setLeadMessage(e.target.value)}
                                                    disabled={loading}
                                                />
                                            </div>

                                            {/* Anexo da Campanha: Imagem OU Documento PDF */}
                                            <div className="space-y-2 pt-1">
                                                <Label className="text-xs font-semibold flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Paperclip className="h-3.5 w-3.5 text-primary" /> Foto Promocional ou Catálogo / Apresentação em PDF:
                                                    </span>
                                                    {leadMediaFile && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveLeadMedia}
                                                            className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-medium"
                                                        >
                                                            <X className="h-3 w-3" /> Remover anexo
                                                        </button>
                                                    )}
                                                </Label>

                                                <input
                                                    ref={leadFileInputRef}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    className="hidden"
                                                    onChange={handleLeadMediaSelect}
                                                    disabled={loading}
                                                />

                                                {leadMediaFile ? (
                                                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/30 bg-primary/5 shadow-2xs">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {leadMediaFile.type.startsWith("image/") && leadMediaPreviewUrl ? (
                                                                <img
                                                                    src={leadMediaPreviewUrl}
                                                                    alt="Preview da Campanha"
                                                                    className="h-14 w-14 rounded-lg object-cover border shrink-0 bg-background"
                                                                />
                                                            ) : (
                                                                <div className="h-14 w-14 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 flex flex-col items-center justify-center shrink-0 border border-red-300 dark:border-red-900">
                                                                    <FileText className="h-7 w-7" />
                                                                    <span className="text-[9px] font-black uppercase tracking-wider">PDF</span>
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                                                                        {leadMediaFile.name}
                                                                    </span>
                                                                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                                                                        {leadMediaFile.type.startsWith("image/") ? "Imagem" : "PDF"}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                    {formatFileSize(leadMediaFile.size)} • Pronto para ser enviado aos leads
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => leadFileInputRef.current?.click()}
                                                                className="h-7 text-xs font-medium cursor-pointer"
                                                            >
                                                                Trocar
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={handleRemoveLeadMedia}
                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 cursor-pointer"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Estado sem anexo: área para upload */
                                                    <div
                                                        onClick={() => leadFileInputRef.current?.click()}
                                                        className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 text-center space-y-2 bg-muted/20 cursor-pointer transition-all hover:bg-muted/40"
                                                    >
                                                        <div className="flex items-center justify-center gap-3 text-muted-foreground">
                                                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                                                <ImageIcon className="h-5 w-5" />
                                                            </div>
                                                            <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                                                                <FileText className="h-5 w-5" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-foreground">
                                                                Clique para anexar Imagem (JPG, PNG) ou Catálogo/Apresentação (PDF)
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                Tamanho máximo: 25MB • Opcional (se não anexar, o lead receberá apenas o texto)
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delay e Botão de Disparo */}
                                            <div className="space-y-4 pt-3 border-t">
                                                <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/50">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <Label className="font-semibold">Intervalo de Segurança Anti-Ban:</Label>
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
                                                    />
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Recomendado de 2.5s a 5.0s entre disparos para contatos novos e prospecção de leads.
                                                    </p>
                                                </div>

                                                <Button
                                                    className="w-full font-bold h-12 text-sm shadow-md cursor-pointer bg-primary hover:bg-primary/90"
                                                    onClick={handleSend}
                                                    disabled={loading || !sessionId || recipientCount === 0 || (!leadMessage.trim() && !leadMediaFile)}
                                                >
                                                    {loading ? (
                                                        <>
                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Disparando campanha...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="mr-2 h-4 w-4" /> Iniciar Campanha de Prospecção ({recipientCount} Lead{recipientCount !== 1 ? "s" : ""})
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {/* Modal para Selecionar Contatos Salvos no Sistema */}
                        <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
                            <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden">
                                <DialogHeader className="p-4 border-b bg-muted/20">
                                    <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" /> Contatos Salvos no Sistema
                                    </DialogTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Selecione os clientes cadastrados no NEXUS Chat para adicionar ao disparo.
                                    </p>
                                </DialogHeader>

                                <div className="p-4 space-y-3">
                                    {/* Busca */}
                                    <div className="relative">
                                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por nome ou telefone..."
                                            value={contactSearch}
                                            onChange={e => setContactSearch(e.target.value)}
                                            className="pl-9 h-8 text-xs bg-background"
                                        />
                                    </div>

                                    {/* Controles para Seleção Múltipla */}
                                    {collectiveTargetMode === "multiple" && (
                                        <div className="flex items-center justify-between text-xs pt-1">
                                            <span className="font-semibold text-muted-foreground">
                                                {selectedContactJids.size} contato(s) selecionado(s)
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const query = contactSearch.toLowerCase().trim();
                                                        const filtered = systemContacts.filter(c => {
                                                            const name = (c.name || c.notify || c.verifiedName || "").toLowerCase();
                                                            const jid = (c.jid || "").toLowerCase();
                                                            return !query || name.includes(query) || jid.includes(query);
                                                        });
                                                        handleSelectAllFiltered(filtered);
                                                    }}
                                                    className="text-primary hover:underline text-xs font-semibold cursor-pointer"
                                                >
                                                    Marcar Todos
                                                </button>
                                                <span>•</span>
                                                <button
                                                    type="button"
                                                    onClick={handleClearContactSelection}
                                                    className="text-muted-foreground hover:underline text-xs cursor-pointer"
                                                >
                                                    Desmarcar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Lista de Contatos com Scroll */}
                                    <div className="border rounded-xl divide-y overflow-y-auto max-h-[300px]">
                                        {contactLoading ? (
                                            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                                                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-primary" />
                                                <p>Carregando contatos do sistema...</p>
                                            </div>
                                        ) : (() => {
                                            const query = contactSearch.toLowerCase().trim();
                                            const filtered = systemContacts.filter(c => {
                                                const name = (c.name || c.notify || c.verifiedName || "").toLowerCase();
                                                const jid = (c.jid || "").toLowerCase();
                                                return !query || name.includes(query) || jid.includes(query);
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="p-8 text-center text-xs text-muted-foreground">
                                                        Nenhum contato encontrado{query ? ` para "${contactSearch}"` : ""}.
                                                    </div>
                                                );
                                            }

                                            return filtered.map((c) => {
                                                const cleanPhone = c.jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
                                                const displayName = c.name || c.notify || c.verifiedName || cleanPhone;
                                                const isSelected = selectedContactJids.has(c.jid);

                                                return (
                                                    <div
                                                        key={c.jid}
                                                        onClick={() => {
                                                            if (collectiveTargetMode === "single") {
                                                                handleSelectSingleContact(c);
                                                            } else {
                                                                handleToggleContactSelection(c.jid);
                                                            }
                                                        }}
                                                        className={`p-2.5 flex items-center justify-between gap-3 hover:bg-muted/40 cursor-pointer transition-colors ${
                                                            isSelected ? "bg-primary/5" : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {collectiveTargetMode === "multiple" && (
                                                                <div className="shrink-0">
                                                                    {isSelected ? (
                                                                        <CheckSquare className="h-4 w-4 text-primary" />
                                                                    ) : (
                                                                        <Square className="h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <Avatar className="h-8 w-8 shrink-0">
                                                                {c.profilePic && <AvatarImage src={c.profilePic} />}
                                                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                                                    {displayName.slice(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-foreground truncate">
                                                                    {displayName}
                                                                </p>
                                                                <p className="text-[11px] font-mono text-muted-foreground">
                                                                    {cleanPhone}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {collectiveTargetMode === "single" && (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-[11px] text-primary hover:text-primary font-semibold"
                                                            >
                                                                Selecionar
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {collectiveTargetMode === "multiple" && (
                                    <div className="p-3 border-t bg-muted/20 flex items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setContactModalOpen(false)}
                                            className="h-8 text-xs cursor-pointer"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddSelectedContactsToRows}
                                            disabled={selectedContactJids.size === 0}
                                            className="h-8 text-xs font-semibold cursor-pointer"
                                        >
                                            Adicionar {selectedContactJids.size} Contato{selectedContactJids.size !== 1 ? "s" : ""} à Tabela
                                        </Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>

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
