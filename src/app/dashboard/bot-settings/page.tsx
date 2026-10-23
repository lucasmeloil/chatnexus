"use client";

import { useState, useEffect } from "react";
import { useSession as useSessionProvider } from "@/components/dashboard/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Save, AlertCircle, Bot, X, Plus, ShieldCheck, Zap, UserCheck, MessageSquarePlus, FileJson, Upload, Trash2, Mic, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

export default function BotSettingsPage() {
    const { sessionId } = useSessionProvider();

    const [botConfig, setBotConfig] = useState({
        enabled: true,
        botName: "WA-AKG Bot",
        prefix: "#",
        enableSticker: true,
        enableVideoSticker: true,
        maxStickerDuration: 10,
        enablePing: true,
        enableUptime: true,
        removeBgApiKey: "",
        botMode: "OWNER",
        autoReplyMode: "ALL",
        antiSpamEnabled: false,
        spamLimit: 5,
        spamInterval: 10,
        spamDelayMin: 1000,
        spamDelayMax: 3000,

        // New fields
        welcomeMessage: "",
        autoRead: false,
        alwaysOnline: false,
        botAllowedJids: [] as string[],
        botBlockedJids: [] as string[],
        autoReplyAllowedJids: [] as string[],
        autoReplyBlockedJids: [] as string[],
    });
    const [botLoading, setBotLoading] = useState(false);

    const [newJid, setNewJid] = useState("");

    const [privacyConfig, setPrivacyConfig] = useState({
        ghostMode: false,
        antiDelete: false,
        readReceipts: true,
    });
    const [privacyLoading, setPrivacyLoading] = useState(false);

    // Typebot State
    const [typebotConfig, setTypebotConfig] = useState({
        enabled: true,
        transcribeAudio: false,
        openaiApiKey: "",
        handoverKeywords: "atendente, humano, suporte, sair",
        delayBetweenMessages: 1200,
    });
    const [typebotSummary, setTypebotSummary] = useState<{
        hasFlow: boolean;
        flowName?: string;
        groupsCount?: number;
        blocksCount?: number;
        updatedAt?: string;
    } | null>(null);
    const [typebotLoading, setTypebotLoading] = useState(false);
    const [uploadingJson, setUploadingJson] = useState(false);

    const loadTypebot = () => {
        if (!sessionId) return;
        fetch(`/api/sessions/${sessionId}/typebot`)
            .then(res => res.json())
            .then(data => {
                if (data.status) {
                    if (data.config) setTypebotConfig(data.config);
                    if (data.summary) setTypebotSummary(data.summary);
                }
            })
            .catch(() => { });
    };

    useEffect(() => {
        if (!sessionId) return;

        loadTypebot();

        fetch(`/api/sessions/${sessionId}/bot-config`)
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(responseData => {
                const data = responseData?.data;
                if (data && !responseData.error) {
                    setBotConfig(prev => ({
                        ...prev,
                        ...data,
                        enabled: data.enabled ?? true,
                        removeBgApiKey: data.removeBgApiKey || "",
                        prefix: data.prefix || "#",
                        welcomeMessage: data.welcomeMessage || "",
                        botAllowedJids: data.botAllowedJids || [],
                        botBlockedJids: data.botBlockedJids || [],
                        autoReplyAllowedJids: data.autoReplyAllowedJids || [],
                        autoReplyBlockedJids: data.autoReplyBlockedJids || [],
                    }));
                }
            })
            .catch(() => { });

        fetch(`/api/sessions/${sessionId}/settings`)
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(responseData => {
                const data = responseData?.data;
                if (data && !responseData.error) {
                    setPrivacyConfig({
                        ghostMode: data.config?.ghostMode || false,
                        antiDelete: data.config?.antiDelete || false,
                        readReceipts: data.config?.readReceipts ?? true
                    });
                }
            })
            .catch(() => { });
    }, [sessionId]);

    const handleSaveBot = async () => {
        if (!sessionId) return;
        setBotLoading(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/bot-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(botConfig)
            });

            if (res.ok) {
                toast.success("Configuração do bot salva com sucesso");
            } else {
                toast.error("Falha ao salvar configuração do bot");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar configuração do bot");
        } finally {
            setBotLoading(false);
        }
    };

    const handleSavePrivacy = async () => {
        if (!sessionId) return;
        setPrivacyLoading(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    config: {
                        ghostMode: privacyConfig.ghostMode,
                        antiDelete: privacyConfig.antiDelete,
                        readReceipts: privacyConfig.readReceipts
                    }
                })
            });

            if (res.ok) {
                toast.success("Configurações de privacidade salvas com sucesso");
            } else {
                toast.error("Falha ao salvar configurações de privacidade");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar configurações de privacidade");
        } finally {
            setPrivacyLoading(false);
        }
    };

    const addJid = (listName: 'botAllowedJids' | 'botBlockedJids' | 'autoReplyAllowedJids' | 'autoReplyBlockedJids') => {
        if (!newJid || !newJid.trim()) return;
        const formatted = formatToBrazilPhoneJid(newJid);

        if (!botConfig[listName].includes(formatted)) {
            setBotConfig(prev => ({
                ...prev,
                [listName]: [...prev[listName], formatted]
            }));
        }
        setNewJid("");
    };

    const removeJid = (listName: 'botAllowedJids' | 'botBlockedJids' | 'autoReplyAllowedJids' | 'autoReplyBlockedJids', jid: string) => {
        setBotConfig(prev => ({
            ...prev,
            [listName]: prev[listName].filter(item => item !== jid)
        }));
    };

    const handleUploadTypebotJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !sessionId) return;

        if (!file.name.endsWith('.json')) {
            toast.error("Por favor, selecione um arquivo .json válido exportado do Typebot");
            return;
        }

        setUploadingJson(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`/api/sessions/${sessionId}/typebot`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message || "Fluxo Typebot importado com sucesso!");
                if (data.summary) setTypebotSummary(data.summary);
            } else {
                toast.error(data.message || "Falha ao importar fluxo Typebot");
            }
        } catch (err: any) {
            toast.error("Erro ao enviar arquivo: " + err.message);
        } finally {
            setUploadingJson(false);
            e.target.value = "";
        }
    };

    const handleSaveTypebotConfig = async () => {
        if (!sessionId) return;
        setTypebotLoading(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/typebot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(typebotConfig)
            });
            const data = await res.json();
            if (data.status) {
                toast.success("Configurações do Typebot salvas com sucesso!");
            } else {
                toast.error(data.message || "Falha ao salvar configurações");
            }
        } catch (err: any) {
            toast.error("Erro ao salvar: " + err.message);
        } finally {
            setTypebotLoading(false);
        }
    };

    const handleDeleteTypebotFlow = async () => {
        if (!sessionId) return;
        if (!confirm("Deseja realmente remover o fluxo do Typebot desta sessão?")) return;
        try {
            const res = await fetch(`/api/sessions/${sessionId}/typebot`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.status) {
                toast.success("Fluxo Typebot removido com sucesso");
                setTypebotSummary({ hasFlow: false });
            }
        } catch (err: any) {
            toast.error("Erro ao remover fluxo");
        }
    };

    const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <SessionGuard>
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Configurações do Bot</h2>
                    <p className="text-muted-foreground text-sm mt-1">Configure os recursos do robô e privacidade da sessão ativa do WhatsApp.</p>
                </div>

                {/* Master Switch: Ativar / Desativar Robô */}
                <Card className={`border-2 transition-all ${botConfig.enabled ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-muted/20'}`}>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Bot className={`h-6 w-6 ${botConfig.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <h3 className="text-lg font-bold">
                                        Status Geral do Robô: {botConfig.enabled ? (
                                            <span className="text-emerald-500 font-semibold">ATIVO</span>
                                        ) : (
                                            <span className="text-muted-foreground font-semibold">DESATIVADO</span>
                                        )}
                                    </h3>
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {botConfig.enabled
                                        ? "O robô está respondendo automaticamente no WhatsApp (Typebot e Autorespostas)."
                                        : "O robô está desligado e não enviará respostas automáticas para nenhum contato."}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Label htmlFor="master-bot-switch" className="text-sm font-semibold cursor-pointer">
                                    {botConfig.enabled ? "Robô Ligado" : "Robô Desligado"}
                                </Label>
                                <Switch
                                    id="master-bot-switch"
                                    checked={botConfig.enabled}
                                    onCheckedChange={async (val) => {
                                        const updated = { ...botConfig, enabled: val };
                                        setBotConfig(updated);
                                        if (sessionId) {
                                            try {
                                                await fetch(`/api/sessions/${sessionId}/bot-config`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify(updated)
                                                });
                                                toast.success(val ? "Robô ativado com sucesso!" : "Robô desativado com sucesso!");
                                            } catch {
                                                toast.error("Erro ao alternar status do robô");
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Typebot Integration Card */}
                <Card className="border-purple-500/30">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-purple-500" />
                                    Automação com Typebot (Fluxo Visual)
                                </CardTitle>
                                <CardDescription>
                                    Importe o arquivo <code>.json</code> exportado do Typebot para atendimento automático completo com suporte a texto e áudio.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="typebot-enable-switch" className="text-xs font-semibold cursor-pointer">
                                    {typebotConfig.enabled ? "Typebot Ativo" : "Typebot Inativo"}
                                </Label>
                                <Switch
                                    id="typebot-enable-switch"
                                    checked={typebotConfig.enabled}
                                    onCheckedChange={v => setTypebotConfig(prev => ({ ...prev, enabled: v }))}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Status / Flow Card */}
                        {typebotSummary?.hasFlow ? (
                            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                                            <FileJson className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                                {typebotSummary.flowName || "Fluxo Typebot Carregado"}
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 font-semibold">Ativo</span>
                                            </h4>
                                            <p className="text-xs text-muted-foreground">
                                                {typebotSummary.groupsCount || 0} Grupos • {typebotSummary.blocksCount || 0} Blocos de Ação e Mensagens
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                                            <Upload className="h-3.5 w-3.5" />
                                            Substituir .json
                                            <input type="file" accept=".json" className="hidden" onChange={handleUploadTypebotJson} disabled={uploadingJson} />
                                        </label>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDeleteTypebotFlow}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Remover
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border-2 border-dashed border-border/80 flex flex-col items-center justify-center text-center space-y-3">
                                <div className="h-12 w-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                    <FileJson className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">Nenhum fluxo do Typebot importado</h4>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                                        Exporte o seu fluxo no Typebot (Settings &gt; Export JSON) e faça o upload aqui para ativar o robô inteligente.
                                    </p>
                                </div>
                                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
                                    <Upload className="h-4 w-4" />
                                    {uploadingJson ? "Importando Fluxo..." : "Carregar Arquivo .json do Typebot"}
                                    <input type="file" accept=".json" className="hidden" onChange={handleUploadTypebotJson} disabled={uploadingJson} />
                                </label>
                            </div>
                        )}

                        {/* Configurações de Áudio e Transbordo */}
                        <div className="grid sm:grid-cols-2 gap-4 pt-2">
                            <div className="p-4 border rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="audio-transcribe" className="flex items-center gap-2 font-medium cursor-pointer">
                                        <Mic className="h-4 w-4 text-purple-500" />
                                        Transcrição de Mensagens de Áudio
                                    </Label>
                                    <Switch
                                        id="audio-transcribe"
                                        checked={typebotConfig.transcribeAudio}
                                        onCheckedChange={v => setTypebotConfig(prev => ({ ...prev, transcribeAudio: v }))}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Converte áudios enviados pelos clientes em texto via Whisper da OpenAI, permitindo que o bot entenda gravações de voz.
                                </p>
                                {typebotConfig.transcribeAudio && (
                                    <div className="space-y-1.5 pt-2">
                                        <Label className="text-xs">Chave OpenAI API Key (Whisper)</Label>
                                        <Input
                                            type="password"
                                            placeholder="sk-..."
                                            value={typebotConfig.openaiApiKey}
                                            onChange={e => setTypebotConfig(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                                        />
                                        <p className="text-[10px] text-muted-foreground">Necessária apenas se a variável OPENAI_API_KEY não estiver configurada no servidor.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border rounded-xl space-y-3">
                                <Label className="flex items-center gap-2 font-medium">
                                    <UserCheck className="h-4 w-4 text-primary" />
                                    Transbordo para Atendente Humano
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Quando o cliente digita uma dessas palavras, o robô pausa o atendimento para permitir que o atendente humano converse.
                                </p>
                                <div className="space-y-1.5 pt-1">
                                    <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
                                    <Input
                                        placeholder="atendente, humano, suporte, sair"
                                        value={typebotConfig.handoverKeywords}
                                        onChange={e => setTypebotConfig(prev => ({ ...prev, handoverKeywords: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button onClick={handleSaveTypebotConfig} disabled={typebotLoading || !sessionId}>
                                {typebotLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar Configurações do Typebot
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Bot Mode & Access Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Modo do Robô & Controle de Acesso
                        </CardTitle>
                        <CardDescription>Configure quem pode interagir com o robô e executar comandos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                            <div className="grid gap-2">
                                <Label>Nome do Robô</Label>
                                <Input
                                    placeholder="NEXUS Bot"
                                    value={botConfig.botName}
                                    onChange={(e) => setBotConfig(prev => ({ ...prev, botName: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">O nome de exibição utilizado pelo robô nas respostas automatizadas.</p>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Prefixo de Comandos</Label>
                                    <Input
                                        className="max-w-[100px]"
                                        placeholder="#"
                                        maxLength={3}
                                        value={botConfig.prefix}
                                        onChange={(e) => setBotConfig(prev => ({ ...prev, prefix: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground">O caractere prefixo para acionar comandos do robô.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Modo de Interação do Robô</Label>
                                    <Select
                                        value={botConfig.botMode}
                                        onValueChange={(v: any) => setBotConfig(prev => ({ ...prev, botMode: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o Modo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Público (Todos)</SelectItem>
                                            <SelectItem value="OWNER">Privado (Apenas Administrador)</SelectItem>
                                            <SelectItem value="SPECIFIC">Lista Permitida (JIDs Selecionados)</SelectItem>
                                            <SelectItem value="BLACKLIST">Lista Bloqueada (Bloquear JIDs)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Controle quem pode disparar os comandos do robô.</p>
                                </div>
                            </div>

                            {(botConfig.botMode === 'SPECIFIC' || botConfig.botMode === 'BLACKLIST') && (
                                <div className="space-y-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <Label className="flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" />
                                        {botConfig.botMode === 'SPECIFIC' ? "Whitelisted Numbers" : "Blacklisted Numbers"}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Ex: (11) 98765-4321 ou 5511987654321"
                                            value={newJid}
                                            onChange={(e) => setNewJid(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addJid(botConfig.botMode === 'SPECIFIC' ? 'botAllowedJids' : 'botBlockedJids')}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => addJid(botConfig.botMode === 'SPECIFIC' ? 'botAllowedJids' : 'botBlockedJids')}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(botConfig.botMode === 'SPECIFIC' ? botConfig.botAllowedJids : botConfig.botBlockedJids).map(jid => (
                                            <div key={jid} className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-medium">
                                                {jid}
                                                <button onClick={() => removeJid(botConfig.botMode === 'SPECIFIC' ? 'botAllowedJids' : 'botBlockedJids', jid)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {(botConfig.botMode === 'SPECIFIC' ? botConfig.botAllowedJids : botConfig.botBlockedJids).length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">No numbers added yet.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="enable-ping" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Ping Command</span>
                                        <span className="font-normal text-[10px] text-muted-foreground">Respond to {botConfig.prefix}ping</span>
                                    </Label>
                                    <Switch id="enable-ping" checked={botConfig.enablePing}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, enablePing: c }))} />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="enable-uptime" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Uptime Command</span>
                                        <span className="font-normal text-[10px] text-muted-foreground">Respond to {botConfig.prefix}uptime</span>
                                    </Label>
                                    <Switch id="enable-uptime" checked={botConfig.enableUptime}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, enableUptime: c }))} />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button className="w-full sm:w-auto" onClick={handleSaveBot} disabled={botLoading || !sessionId}>
                                    {botLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Bot Configuration
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Automation & Presence Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" />
                                Automation & Presence
                            </CardTitle>
                            <CardDescription>Advanced bot automation and presence customization.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="always-online" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Always Online</span>
                                        <span className="font-normal text-[10px] text-muted-foreground">Stay "Online" even when inactive.</span>
                                    </Label>
                                    <Switch id="always-online" checked={botConfig.alwaysOnline}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, alwaysOnline: c }))} />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="auto-read" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Auto Read (Blue Ticks)</span>
                                        <span className="font-normal text-[10px] text-muted-foreground">Automatically mark messages as read.</span>
                                    </Label>
                                    <Switch id="auto-read" checked={botConfig.autoRead}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, autoRead: c }))} />
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-border/50 pt-4">
                                <Label className="flex items-center gap-2">
                                    <MessageSquarePlus className="h-4 w-4 text-primary" />
                                    Mensagem de Boas-vindas (Beta)
                                </Label>
                                <Textarea
                                    placeholder="Olá! Seja bem-vindo ao nosso atendimento. Como podemos te ajudar hoje?"
                                    className="min-h-[100px]"
                                    value={botConfig.welcomeMessage}
                                    onChange={(e) => setBotConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                                />
                                <p className="text-[10px] text-muted-foreground">Enviada automaticamente aos contatos que mandarem mensagem para este número pela primeira vez.</p>
                            </div>

                            <div className="pt-2">
                                <Button className="w-full sm:w-auto" onClick={handleSaveBot} disabled={botLoading || !sessionId}>
                                    {botLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Automação
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Media & Stickers Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Mídias & Figurinhas</CardTitle>
                            <CardDescription>Configure como o robô trata conversão de imagens e vídeos em figurinhas.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="enable-sticker" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Imagem em Figurinha</span>
                                        <span className="font-normal text-xs text-muted-foreground">Converter imagens automaticamente</span>
                                    </Label>
                                    <Switch id="enable-sticker" checked={botConfig.enableSticker}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, enableSticker: c }))} />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                    <Label htmlFor="enable-video-sticker" className="flex flex-col space-y-1 cursor-pointer">
                                        <span className="font-medium">Vídeo em Figurinha</span>
                                        <span className="font-normal text-xs text-muted-foreground">Converter vídeos curtos automaticamente</span>
                                    </Label>
                                    <Switch id="enable-video-sticker" checked={botConfig.enableVideoSticker}
                                        onCheckedChange={c => setBotConfig(prev => ({ ...prev, enableVideoSticker: c }))} />
                                </div>
                            </div>

                            <div className="grid gap-2 border-t border-border/50 pt-4">
                                <Label>Duração Máxima do Vídeo p/ Figurinha: <strong>{botConfig.maxStickerDuration}s</strong></Label>
                                <Slider
                                    value={[botConfig.maxStickerDuration]}
                                    onValueChange={([v]) => setBotConfig(prev => ({ ...prev, maxStickerDuration: v }))}
                                    min={3}
                                    max={30}
                                    step={1}
                                />
                                <p className="text-xs text-muted-foreground">Duração máxima do vídeo (em segundos) permitida para virar figurinha.</p>
                            </div>

                            <div className="grid gap-2 border-t border-border/50 pt-4">
                                <Label>Chave API Remove.bg (Opcional)</Label>
                                <Input
                                    type="password"
                                    placeholder="Digite sua chave API do Remove.bg"
                                    value={botConfig.removeBgApiKey || ""}
                                    onChange={(e) => setBotConfig(prev => ({ ...prev, removeBgApiKey: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">Permite remover o fundo das figurinhas (usando a legenda <code className="bg-muted px-1 rounded">nobg</code>).</p>
                            </div>

                            <div className="pt-2">
                                <Button className="w-full sm:w-auto" onClick={handleSaveBot} disabled={botLoading || !sessionId}>
                                    {botLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Configurações de Mídia
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Anti-Ban Protection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-500" />
                                Proteção Anti-Ban (Beta)
                            </CardTitle>
                            <CardDescription>
                                Evite que seu número do WhatsApp seja detectado como spam ou banido adicionando atrasos aleatórios inteligentes entre as mensagens enviadas. Isso se aplica a <strong>todas</strong> as ações: respostas do bot, auto-respostas, disparos em massa, agendamentos e chamadas via API nesta sessão.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-orange-500/5 border-orange-500/20">
                                <Label htmlFor="anti-spam" className="flex flex-col space-y-1">
                                    <span className="font-semibold text-orange-700 dark:text-orange-400">Ativar Intervalo Anti-Spam</span>
                                    <span className="font-normal text-xs text-muted-foreground">Quando ativado, as mensagens serão enfileiradas e enviadas com um intervalo aleatório se o limite for atingido. As mensagens nunca são descartadas — apenas espaçadas.</span>
                                </Label>
                                <Switch id="anti-spam" checked={botConfig.antiSpamEnabled}
                                    onCheckedChange={c => setBotConfig(prev => ({ ...prev, antiSpamEnabled: c }))} />
                            </div>

                            {botConfig.antiSpamEnabled && (
                                <div className="grid gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {/* How it works */}
                                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">💡 Como funciona</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            O sistema monitora quantas mensagens esta sessão envia em uma janela de tempo.
                                            Se o número de mensagens ultrapassar o <strong>limite</strong> dentro da <strong>janela de tempo</strong>,
                                            cada mensagem subsequente será <strong>espaçada</strong> por um tempo aleatório entre o atraso <strong>Mínimo</strong> e <strong>Máximo</strong>.
                                            Assim que a janela de tempo se renova, o envio retorna à velocidade instantânea normal.
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            <strong>Exemplo:</strong> Com limite = <strong>{botConfig.spamLimit}</strong> e janela = <strong>{botConfig.spamInterval}s</strong> →
                                            as primeiras {botConfig.spamLimit} mensagens dentro de {botConfig.spamInterval} segundos são enviadas de imediato.
                                            A mensagem #{botConfig.spamLimit + 1} em diante aguardará entre {botConfig.spamDelayMin}ms e {botConfig.spamDelayMax}ms cada.
                                        </p>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className="font-semibold">Limite de Mensagens Rápidas</Label>
                                            <Input
                                                type="number"
                                                value={botConfig.spamLimit}
                                                onChange={e => setBotConfig(prev => ({ ...prev, spamLimit: parseInt(e.target.value) || 1 }))}
                                                min={1}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Quantidade de mensagens permitidas em velocidade máxima antes do intervalo entrar em ação.
                                                <span className="text-orange-600 dark:text-orange-400"> Menor = mais seguro contra banimentos.</span>
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-semibold">Janela de Tempo (Segundos)</Label>
                                            <Input
                                                type="number"
                                                value={botConfig.spamInterval}
                                                onChange={e => setBotConfig(prev => ({ ...prev, spamInterval: parseInt(e.target.value) || 1 }))}
                                                min={1}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Janela deslizante para contar mensagens. Após esse tempo, o contador é resetado naturalmente.
                                                <span className="text-orange-600 dark:text-orange-400"> Maior = mais conservador.</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className="font-semibold">Atraso Mínimo (ms)</Label>
                                            <Input
                                                type="number"
                                                value={botConfig.spamDelayMin}
                                                onChange={e => setBotConfig(prev => ({ ...prev, spamDelayMin: parseInt(e.target.value) || 0 }))}
                                                min={0}
                                                step={100}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Atraso aleatório mínimo aplicado. 1000ms = 1 segundo.
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="font-semibold">Atraso Máximo (ms)</Label>
                                            <Input
                                                type="number"
                                                value={botConfig.spamDelayMax}
                                                onChange={e => setBotConfig(prev => ({ ...prev, spamDelayMax: parseInt(e.target.value) || 0 }))}
                                                min={0}
                                                step={100}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Atraso aleatório máximo aplicado. 3000ms = 3 segundos.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                                        <p className="text-xs text-muted-foreground">
                                            ⚠️ <strong>Configurações recomendadas:</strong> Limite <strong>5</strong>, Janela <strong>10s</strong>, Atraso <strong>1000–3000ms</strong>.
                                            Para transmissões e disparos em grande volume, utilize Limite <strong>3</strong> com Atraso de <strong>2000–5000ms</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <Button onClick={handleSaveBot} disabled={botLoading || !sessionId}>
                                    {botLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Configurações de Proteção
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Privacy & Utility */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Privacidade & Utilidades</CardTitle>
                            <CardDescription>Configure modo fantasma e outros recursos para sua sessão ativa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="ghost-mode" className="flex flex-col space-y-1">
                                    <span>Modo Fantasma</span>
                                    <span className="font-normal text-xs text-muted-foreground">Visualize recados, status e mensagens sem enviar confirmação de leitura (sem tiques azuis).</span>
                                </Label>
                                <Switch id="ghost-mode" checked={privacyConfig.ghostMode}
                                    onCheckedChange={c => setPrivacyConfig(prev => ({ ...prev, ghostMode: c }))} />
                            </div>

                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="anti-delete" className="flex flex-col space-y-1">
                                    <span>Anti-Exclusão (Anti-Delete)</span>
                                    <span className="font-normal text-xs text-muted-foreground">Conserva mensagens recebidas mesmo que o remetente apague para todos.</span>
                                </Label>
                                <Switch id="anti-delete" checked={privacyConfig.antiDelete}
                                    onCheckedChange={c => setPrivacyConfig(prev => ({ ...prev, antiDelete: c }))} />
                            </div>

                            <div className="pt-4">
                                <Button onClick={handleSavePrivacy} disabled={privacyLoading || !sessionId}>
                                    {privacyLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Configurações de Privacidade
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SessionGuard>
        );
    }
