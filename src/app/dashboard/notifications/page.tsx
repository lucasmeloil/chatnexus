"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Bell,
    Send,
    CheckCircle2,
    Volume2,
    Volume1,
    VolumeX,
    Play,
    Save,
    Music,
    UploadCloud,
    Trash2,
    Sparkles,
    Check
} from "lucide-react";
import { toast } from "sonner";
import {
    getNotificationSoundConfig,
    saveNotificationSoundConfig,
    previewNotificationSound,
    isNotificationSoundEnabled,
    setNotificationSoundEnabled,
    type NotificationSoundType
} from "@/lib/notification-sound";

interface SoundPreset {
    id: NotificationSoundType;
    name: string;
    description: string;
    tag: string;
}

const SOUND_PRESETS: SoundPreset[] = [
    {
        id: "nexus-chime",
        name: "Nexus Chime (Padrão)",
        description: "Duplo toque harmônico acolhedor e clássico do sistema",
        tag: "Harmônico"
    },
    {
        id: "crystal",
        name: "Cristal Moderno",
        description: "Tríade límpida e brilhante com ressonância sofisticada",
        tag: "Cristalino"
    },
    {
        id: "modern-pop",
        name: "Pop Minimalista",
        description: "Bip suave e sutil, ideal para ambientes movimentados",
        tag: "Discreto"
    },
    {
        id: "marimba",
        name: "Marimba Acústica",
        description: "Timbre percussivo orgânico, quente e agradável",
        tag: "Orgânico"
    },
    {
        id: "bell",
        name: "Sino de Recepção",
        description: "Chime metálico puro com eco prolongado",
        tag: "Clássico"
    },
    {
        id: "cyber-alert",
        name: "Alerta Cyber",
        description: "Dois pulsos tecnológicos rápidos e de alta perceptibilidade",
        tag: "Dinâmico"
    },
    {
        id: "custom",
        name: "Áudio Personalizado",
        description: "Envie seu próprio arquivo de som (.mp3, .wav, .ogg)",
        tag: "Custom"
    }
];

export default function NotificationAdminPage() {
    // Sound settings state
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [soundType, setSoundType] = useState<NotificationSoundType>("nexus-chime");
    const [volume, setVolume] = useState(80);
    const [customAudioData, setCustomAudioData] = useState<string | null>(null);
    const [customAudioName, setCustomAudioName] = useState<string | null>(null);
    const [isTestingSound, setIsTestingSound] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Notification Composer state
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [type, setType] = useState("INFO");
    const [broadcast, setBroadcast] = useState(true);
    const [targetUserId, setTargetUserId] = useState("");
    const [href, setHref] = useState("");
    const [loading, setLoading] = useState(false);

    // Load initial sound configuration
    useEffect(() => {
        setSoundEnabled(isNotificationSoundEnabled());
        const config = getNotificationSoundConfig();
        setSoundType(config.type);
        setVolume(config.volume);
        setCustomAudioData(config.customAudioData || null);
        setCustomAudioName(config.customAudioName || null);
    }, []);

    const handleSoundEnabledToggle = (enabled: boolean) => {
        setSoundEnabled(enabled);
        setNotificationSoundEnabled(enabled);
        if (enabled) {
            toast.success("Sons de notificação ativados");
        } else {
            toast.info("Sons de notificação silenciados");
        }
    };

    const handlePreview = (typeToPreview: NotificationSoundType = soundType) => {
        setIsTestingSound(true);
        previewNotificationSound(typeToPreview, volume, customAudioData);
        setTimeout(() => setIsTestingSound(false), 600);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
            toast.error("Por favor, selecione um arquivo de áudio válido (.mp3, .wav, .ogg)");
            return;
        }

        // 2MB limit for localStorage safety
        if (file.size > 2 * 1024 * 1024) {
            toast.error("O arquivo de áudio deve ter no máximo 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setCustomAudioData(result);
            setCustomAudioName(file.name);
            setSoundType("custom");
            toast.success(`Áudio "${file.name}" carregado com sucesso!`);
            previewNotificationSound("custom", volume, result);
        };
        reader.onerror = () => {
            toast.error("Erro ao ler o arquivo de áudio selecionado");
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveCustomAudio = () => {
        setCustomAudioData(null);
        setCustomAudioName(null);
        setSoundType("nexus-chime");
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.info("Áudio personalizado removido. Som padrão restaurado.");
    };

    const handleSaveSound = () => {
        if (soundType === "custom" && !customAudioData) {
            toast.error("Selecione um arquivo de áudio para a opção personalizada antes de salvar.");
            return;
        }

        saveNotificationSoundConfig({
            type: soundType,
            volume,
            customAudioData,
            customAudioName
        });

        // Play feedback
        previewNotificationSound(soundType, volume, customAudioData);
        toast.success("Som de notificação salvo com precisão!", {
            description: `Configurado para ${SOUND_PRESETS.find(p => p.id === soundType)?.name} a ${volume}% de volume.`
        });
    };

    const handleSendNotification = async () => {
        if (!title.trim() || !message.trim()) {
            return toast.error("O Título e a Mensagem são obrigatórios");
        }
        if (!broadcast && !targetUserId.trim()) {
            return toast.error("O ID do Usuário de destino é obrigatório quando a transmissão não for global");
        }

        setLoading(true);
        try {
            const res = await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    type,
                    broadcast,
                    targetUserId: broadcast ? undefined : targetUserId.trim(),
                    href: href.trim() || undefined
                })
            });

            if (res.ok) {
                const responseData = await res.json();
                const data = responseData?.data || {};
                toast.success(`Notificação enviada com sucesso! (${data.count || 1} destinatário(s))`);
                setTitle("");
                setMessage("");
                setHref("");
            } else {
                toast.error("Falha ao enviar a notificação");
            }
        } catch (e) {
            toast.error("Erro ao conectar com o serviço de notificações");
        } finally {
            setLoading(false);
        }
    };

    const VolumeIcon = volume === 0 || !soundEnabled ? VolumeX : volume < 50 ? Volume1 : Volume2;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
                        <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> Gerenciador de Notificações
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Personalize o som de alertas do sistema e emita comunicados diretos aos atendentes.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-card border rounded-xl px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <VolumeIcon className={`h-5 w-5 ${soundEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Sons do Sistema</span>
                    </div>
                    <Switch
                        id="global-sound-switch"
                        checked={soundEnabled}
                        onCheckedChange={handleSoundEnabledToggle}
                    />
                </div>
            </div>

            <Tabs defaultValue="sound" className="w-full">
                <TabsList className="grid w-full sm:w-[420px] grid-cols-2 p-1 bg-muted/60 rounded-xl">
                    <TabsTrigger value="sound" className="rounded-lg text-sm font-medium flex items-center gap-2">
                        <Music className="h-4 w-4" /> Som de Notificação
                    </TabsTrigger>
                    <TabsTrigger value="compose" className="rounded-lg text-sm font-medium flex items-center gap-2">
                        <Send className="h-4 w-4" /> Enviar Comunicado
                    </TabsTrigger>
                </TabsList>

                {/* ABA 1: CONFIGURAÇÃO DO SOM DE NOTIFICAÇÃO */}
                <TabsContent value="sound" className="mt-4 space-y-6">
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                        {/* Coluna 1 & 2: Seleção de Som e Volume */}
                        <Card className="lg:col-span-2 shadow-sm border-border">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Sparkles className="h-5 w-5 text-amber-500" /> Escolha o Som de Alerta
                                        </CardTitle>
                                        <CardDescription>
                                            Selecione o som que tocará ao receber novas mensagens ou avisos no sistema.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePreview(soundType)}
                                        disabled={!soundEnabled || isTestingSound}
                                        className="gap-2 shrink-0 border-primary/20 hover:border-primary/40 text-primary font-medium"
                                    >
                                        <Play className={`h-4 w-4 ${isTestingSound ? 'animate-spin' : 'fill-primary'}`} />
                                        {isTestingSound ? "Reproduzindo..." : "Testar Som"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Grid de Presets */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {SOUND_PRESETS.map((preset) => {
                                        const isSelected = soundType === preset.id;
                                        return (
                                            <div
                                                key={preset.id}
                                                onClick={() => {
                                                    setSoundType(preset.id);
                                                    if (preset.id !== "custom" || customAudioData) {
                                                        handlePreview(preset.id);
                                                    }
                                                }}
                                                className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2 ${
                                                    isSelected
                                                        ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                                                        : 'bg-card border-border hover:border-border/80 hover:bg-muted/30'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`p-2 rounded-lg ${
                                                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            <Music className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {preset.name}
                                                            </p>
                                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                                {preset.tag}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-xs">
                                                            <Check className="h-3 w-3 stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {preset.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Custom Audio File Upload Area */}
                                {soundType === "custom" && (
                                    <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <UploadCloud className="h-5 w-5 text-primary" />
                                                <span className="text-sm font-semibold text-foreground">
                                                    Upload de Som Customizado
                                                </span>
                                            </div>
                                            {customAudioData && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleRemoveCustomAudio}
                                                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Remover
                                                </Button>
                                            )}
                                        </div>

                                        {customAudioName ? (
                                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border text-sm">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Music className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="truncate font-medium">{customAudioName}</span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handlePreview("custom")}
                                                    className="h-7 text-xs gap-1.5 shrink-0"
                                                >
                                                    <Play className="h-3 w-3 fill-current" /> Ouvir
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Nenhum arquivo enviado ainda. Selecione um arquivo de som curto (.mp3, .wav, .ogg) de até 2MB.
                                            </p>
                                        )}

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="sound-file-input"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full gap-2 text-xs"
                                        >
                                            <UploadCloud className="h-4 w-4" />
                                            {customAudioData ? "Substituir Arquivo de Áudio" : "Escolher Arquivo do Computador"}
                                        </Button>
                                    </div>
                                )}

                                {/* Controle de Volume */}
                                <div className="space-y-3 pt-2 border-t">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <VolumeIcon className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-sm font-medium">Volume da Notificação</Label>
                                        </div>
                                        <span className="text-sm font-semibold tabular-nums text-foreground bg-muted/60 px-2 py-0.5 rounded-md border text-xs">
                                            {volume}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[volume]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={(val) => setVolume(val[0])}
                                        className="py-1"
                                    />
                                </div>

                                {/* Salvar Configuração */}
                                <div className="pt-2 flex justify-end">
                                    <Button
                                        onClick={handleSaveSound}
                                        className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-sm"
                                    >
                                        <Save className="h-4 w-4" />
                                        Salvar Som de Notificação
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Coluna 3: Card Resumo & Informações */}
                        <div className="space-y-4">
                            <Card className="shadow-sm border-border bg-slate-50/50 dark:bg-card">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Volume2 className="h-4 w-4 text-primary" /> Configuração Atual
                                    </CardTitle>
                                    <CardDescription>Resumo dos parâmetros que estão ativos para o seu usuário.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                                        <span className="text-muted-foreground">Status do Som</span>
                                        <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                                            soundEnabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                        }`}>
                                            {soundEnabled ? "Ativo" : "Silenciado"}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                                        <span className="text-muted-foreground">Som Selecionado</span>
                                        <span className="font-semibold text-foreground text-xs text-right truncate max-w-[150px]">
                                            {SOUND_PRESETS.find(p => p.id === soundType)?.name}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                                        <span className="text-muted-foreground">Nível de Volume</span>
                                        <span className="font-semibold text-foreground text-xs">
                                            {volume}%
                                        </span>
                                    </div>

                                    <div className="pt-2 text-xs text-muted-foreground leading-relaxed">
                                        💡 <strong>Dica:</strong> Ao clicar em <strong>Salvar Som de Notificação</strong>, as configurações são gravadas imediatamente e passarão a valer para todos os alertas e novas mensagens no WhatsApp.
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ABA 2: ENVIAR COMUNICADOS / NOTIFICAÇÕES */}
                <TabsContent value="compose" className="mt-4">
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        <Card className="shadow-sm border-border">
                            <CardHeader>
                                <CardTitle className="text-lg">Criar Notificação</CardTitle>
                                <CardDescription>Envie comunicados em massa para operadores ou alertas direcionados.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Título</Label>
                                    <Input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="ex: Manutenção Programada às 22h"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Mensagem</Label>
                                    <Textarea
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder="Digite os detalhes da notificação ou aviso..."
                                        rows={4}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo de Aviso</Label>
                                        <Select value={type} onValueChange={setType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INFO">Informativo</SelectItem>
                                                <SelectItem value="WARNING">Aviso / Importante</SelectItem>
                                                <SelectItem value="SUCCESS">Sucesso</SelectItem>
                                                <SelectItem value="SYSTEM">Sistema</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Link de Ação (Opcional)</Label>
                                        <Input
                                            value={href}
                                            onChange={e => setHref(e.target.value)}
                                            placeholder="/dashboard/chat"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 py-2">
                                    <Switch
                                        id="broadcast"
                                        checked={broadcast}
                                        onCheckedChange={setBroadcast}
                                    />
                                    <Label htmlFor="broadcast" className="cursor-pointer">
                                        Transmitir para TODOS os usuários conectados
                                    </Label>
                                </div>

                                {!broadcast && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <Label>ID do Usuário de Destino</Label>
                                        <Input
                                            value={targetUserId}
                                            onChange={e => setTargetUserId(e.target.value)}
                                            placeholder="Identificador único do operador (cuid)"
                                        />
                                    </div>
                                )}

                                <div className="pt-4">
                                    <Button
                                        className="w-full gap-2 font-semibold"
                                        onClick={handleSendNotification}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <CheckCircle2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                        {loading ? "Enviando..." : "Enviar Notificação"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pré-visualização */}
                        <div className="space-y-6">
                            <Card className="bg-slate-50/60 dark:bg-card border-dashed">
                                <CardHeader>
                                    <CardTitle className="text-base text-muted-foreground">Pré-visualização</CardTitle>
                                    <CardDescription>Visualização em tempo real de como o alerta será exibido na tela.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border flex gap-3 items-start">
                                        <div className={`p-2.5 rounded-full shrink-0 ${
                                            type === 'WARNING'
                                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                                                : type === 'SUCCESS'
                                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                                : type === 'SYSTEM'
                                                ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                                                : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                                        }`}>
                                            <Bell className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm text-foreground truncate">
                                                {title || "Título da Notificação"}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                                {message || "O conteúdo detalhado da sua mensagem aparecerá aqui."}
                                            </p>
                                            {href && (
                                                <p className="text-[11px] text-primary font-medium mt-2">
                                                    🔗 Destino: {href}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground/60 mt-2">Agora mesmo</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
