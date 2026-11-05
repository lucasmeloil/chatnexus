"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
    RefreshCw, 
    Send, 
    Image as ImageIcon, 
    Sparkles, 
    Download, 
    Wand2, 
    Smile, 
    Layers, 
    CheckCircle2,
    Palette,
    Paperclip,
    X,
    Type
} from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

const AI_STYLES = [
    { id: "caricature", label: "🎭 Caricatura Engraçada", desc: "Cabeça grande, expressão cômica e traços exagerados" },
    { id: "pixar3d", label: "🦄 3D Pixar / Cartoon", desc: "Estilo animação 3D brilhante, expressivo e colorido" },
    { id: "meme", label: "🕶️ Meme / Óculos Escuros", desc: "Expressão clássica de meme com óculos escuros e humor" },
    { id: "anime", label: "💥 Anime / Chocado", desc: "Chibi japonês com expressões hilárias de surpresa" },
    { id: "party", label: "🥳 Festa & Comemoração", desc: "Chapéu de festa, confetes e sorriso contagiante" },
    { id: "cute", label: "🐱 Mascote Fofo", desc: "Adesivo fofo estilo kawaii com bochechas rosadas" }
];

const MEME_PHRASES = [
    "CALMA CALABRESO 😂",
    "PAGOU O BOLETO? 💸",
    "SÓ ACREDITO VENDO 👀",
    "CHAMA NO ZAP 📲",
    "SEGUNDOU COM S DE SOFRIMENTO ☕",
    "TÔ SÓ DE OLHO 🧐",
    "RIR PRA NÃO CHORAR 😭",
    "TÁ PAGO! 🚀"
];

export default function StickerPage() {
    const { sessionId } = useSession();

    // Estado da Aba IA & Meme
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiMemeText, setAiMemeText] = useState("");
    const [aiAttachedFile, setAiAttachedFile] = useState<File | null>(null);
    const [aiAttachedPreview, setAiAttachedPreview] = useState<string | null>(null);
    const [aiStyle, setAiStyle] = useState("caricature");
    const [aiTarget, setAiTarget] = useState("");
    const [aiPack, setAiPack] = useState("Nexus Memes");
    const [aiAuthor, setAiAuthor] = useState("Nexus AI");
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiSending, setAiSending] = useState(false);
    const [generatedStickerUrl, setGeneratedStickerUrl] = useState<string | null>(null);

    // Estado da Aba Tradicional
    const [traditionalTarget, setTraditionalTarget] = useState("");
    const [traditionalFile, setTraditionalFile] = useState<File | null>(null);
    const [traditionalPreview, setTraditionalPreview] = useState<string | null>(null);
    const [traditionalLoading, setTraditionalLoading] = useState(false);
    const [traditionalPack, setTraditionalPack] = useState("Nexus Pack");
    const [traditionalAuthor, setTraditionalAuthor] = useState("Atendente");
    const [traditionalQuality, setTraditionalQuality] = useState(70);
    const [traditionalType, setTraditionalType] = useState("full");
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Manipulação de Arquivo na Aba IA
    const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setAiAttachedFile(f);
            setAiAttachedPreview(URL.createObjectURL(f));
        }
    };

    const handleRemoveAiFile = () => {
        setAiAttachedFile(null);
        setAiAttachedPreview(null);
    };

    // Manipulação de Arquivo Tradicional
    const handleTraditionalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setTraditionalFile(f);
            setTraditionalPreview(URL.createObjectURL(f));
        }
    };

    // Gerar Figurinha com IA ou Imagem Anexada + Frase de Meme
    const handleGenerateAiSticker = async (sendImmediately: boolean = false) => {
        if (!aiPrompt.trim() && !aiAttachedFile && !aiMemeText.trim()) {
            toast.warning("Anexe uma foto, digite uma frase de meme ou descreva a figurinha.");
            return;
        }

        if (sendImmediately && (!sessionId || !aiTarget.trim())) {
            toast.warning("Para enviar direto, informe o número de WhatsApp do destinatário.");
            return;
        }

        setAiGenerating(true);
        try {
            const formData = new FormData();
            formData.append("prompt", aiPrompt.trim());
            formData.append("memeText", aiMemeText.trim());
            formData.append("style", aiStyle);
            formData.append("pack", aiPack.trim() || "Nexus Memes");
            formData.append("author", aiAuthor.trim() || "Nexus AI");

            if (aiAttachedFile) {
                formData.append("file", aiAttachedFile);
            }

            if (sendImmediately && sessionId && aiTarget.trim()) {
                formData.append("sessionId", sessionId);
                formData.append("target", aiTarget.trim());
            }

            const res = await fetch("/api/stickers/generate-ai", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.status) {
                setGeneratedStickerUrl(data.webpBase64);
                if (data.sent) {
                    toast.success("🎉 Figurinha gerada e enviada com sucesso no WhatsApp!");
                } else {
                    toast.success("✨ Figurinha de meme gerada com sucesso!");
                }
            } else {
                toast.error(data.message || "Erro ao gerar figurinha.");
            }
        } catch (e: any) {
            console.error(e);
            toast.error("Erro na comunicação ao gerar figurinha.");
        } finally {
            setAiGenerating(false);
        }
    };

    // Enviar Figurinha já gerada para o WhatsApp
    const handleSendGeneratedAiSticker = async () => {
        if (!sessionId || !aiTarget.trim() || !generatedStickerUrl) {
            toast.warning("Informe o número do destinatário e certifique-se de que a figurinha foi gerada.");
            return;
        }

        setAiSending(true);
        try {
            const fetchRes = await fetch(generatedStickerUrl);
            const blob = await fetchRes.blob();
            const file = new File([blob], "nexus_ai_sticker.webp", { type: "image/webp" });

            let jid = formatToBrazilPhoneJid(aiTarget);
            const encodedJid = encodeURIComponent(jid);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("pack", aiPack || "Nexus Memes");
            formData.append("author", aiAuthor || "Nexus AI");
            formData.append("quality", "75");
            formData.append("type", "full");

            const res = await fetch(`/api/messages/${sessionId}/${encodedJid}/sticker`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                toast.success("Figurinha enviada com sucesso para o WhatsApp!");
            } else {
                const err = await res.json();
                toast.error(err.error || "Falha ao enviar figurinha.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar figurinha para o WhatsApp.");
        } finally {
            setAiSending(false);
        }
    };

    // Baixar figurinha gerada
    const handleDownloadSticker = () => {
        if (!generatedStickerUrl) return;
        const a = document.createElement("a");
        a.href = generatedStickerUrl;
        a.download = `figurinha_meme_${Date.now()}.webp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Download da figurinha (.webp) iniciado!");
    };

    // Enviar Figurinha Tradicional (Arquivo)
    const handleSendTraditional = async () => {
        if (!sessionId || !traditionalTarget || !traditionalFile) {
            toast.error("Preencha o número de destino e escolha uma imagem.");
            return;
        }

        let jid = formatToBrazilPhoneJid(traditionalTarget);
        const encodedJid = encodeURIComponent(jid);

        setTraditionalLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", traditionalFile);
            formData.append("pack", traditionalPack);
            formData.append("author", traditionalAuthor);
            formData.append("quality", traditionalQuality.toString());
            formData.append("type", traditionalType);

            const res = await fetch(`/api/messages/${sessionId}/${encodedJid}/sticker`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                toast.success("Figurinha criada e enviada com sucesso!");
                setTraditionalFile(null);
                setTraditionalPreview(null);
                setTraditionalTarget("");
            } else {
                const err = await res.json();
                toast.error(err.error || "Falha ao enviar figurinha");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar figurinha");
        } finally {
            setTraditionalLoading(false);
        }
    };

    return (
        <SessionGuard>
            <div className="space-y-6 max-w-6xl mx-auto pb-10">
                {/* Cabeçalho */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Smile className="h-6 w-6 text-primary" /> Estúdio de Figurinhas & Memes
                            </h2>
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 gap-1 font-semibold">
                                <Sparkles className="h-3 w-3" /> Foto + Frase de Meme + IA
                            </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Anexe qualquer foto para transformar em figurinha com frase de meme ou crie caricaturas divertidas com IA.
                        </p>
                    </div>
                </div>

                {/* Abas */}
                <Tabs defaultValue="ai" className="w-full">
                    <TabsList className="grid w-full sm:w-[480px] grid-cols-2 p-1 bg-muted/60">
                        <TabsTrigger value="ai" className="text-xs gap-2 font-semibold">
                            <Wand2 className="h-3.5 w-3.5 text-primary" /> Foto + Frase de Meme & IA
                        </TabsTrigger>
                        <TabsTrigger value="traditional" className="text-xs gap-2 font-semibold">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Envio Tradicional (Simples)
                        </TabsTrigger>
                    </TabsList>

                    {/* ABA 1: FOTO + FRASE DE MEME & IA */}
                    <TabsContent value="ai" className="mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Formulário (7 colunas) */}
                            <div className="lg:col-span-7 space-y-4">
                                <Card className="shadow-xs border-border/70">
                                    <CardHeader className="pb-3 border-b bg-muted/15">
                                        <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-primary" /> Criar Figurinha com Foto, Frase & Meme
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Anexe uma imagem do seu computador e digite uma frase engraçada, ou use a IA para gerar do zero!
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-5 space-y-4">
                                        {/* Anexo de Imagem (Opcional ou Principal) */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold flex items-center justify-between">
                                                <span>1. Imagem / Foto Anexada (Opcional)</span>
                                                <span className="text-[11px] text-muted-foreground font-normal">Foto de alguém, print ou meme</span>
                                            </Label>

                                            {aiAttachedPreview ? (
                                                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <img src={aiAttachedPreview} alt="Anexo" className="w-12 h-12 rounded-lg object-cover border" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold truncate">{aiAttachedFile?.name || "Foto anexada"}</p>
                                                            <p className="text-[10px] text-green-600 font-medium">Pronta para estampar o meme!</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleRemoveAiFile}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 cursor-pointer"
                                                        title="Remover anexo"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer bg-muted/15 hover:bg-muted/30 transition-colors border-border/70 text-center px-4">
                                                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                                                        <Paperclip className="h-4 w-4 text-primary" />
                                                        <span>Clique para anexar uma foto ou arraste até aqui</span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground mt-1">Se não anexar nada, a IA criará a imagem do zero!</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleAiFileChange} />
                                                </label>
                                            )}
                                        </div>

                                        {/* Frase Engraçada do Meme */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                                                <Type className="h-3.5 w-3.5 text-primary" />
                                                <span>2. Frase Engraçada / Legenda do Meme</span>
                                            </Label>
                                            <Input
                                                placeholder="Ex: CALMA CALABRESO ou PAGOU O BOLETO?"
                                                value={aiMemeText}
                                                onChange={e => setAiMemeText(e.target.value)}
                                                className="h-9 text-xs font-bold uppercase"
                                            />
                                            {/* Sugestões de Frases Rápidas */}
                                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                <span className="text-[10px] text-muted-foreground font-semibold">Sugestões rápidas:</span>
                                                {MEME_PHRASES.map((ph, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => setAiMemeText(ph)}
                                                        className="px-2 py-0.5 rounded-full border border-border/60 hover:border-primary/50 text-[10px] bg-muted/30 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all cursor-pointer font-medium"
                                                    >
                                                        {ph}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Descrição / Prompt Livre para a IA */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold flex items-center justify-between">
                                                <span>3. Ideia / Prompt para a IA (Se quiser gerar ou transformar)</span>
                                                <span className="text-[11px] text-muted-foreground font-normal">Ex: "Caricatura rindo com fogos"</span>
                                            </Label>
                                            <Textarea
                                                placeholder="Ex: Caricatura muito engraçada rindo, com óculos escuros estilo meme e chapéu de festa..."
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                className="text-xs min-h-[70px] resize-none"
                                            />
                                        </div>

                                        {/* Estilos em 1 Clique (se for gerar imagem com IA) */}
                                        {!aiAttachedFile && (
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold flex items-center gap-1.5">
                                                    <Palette className="h-3.5 w-3.5 text-primary" /> Estilo Visual da IA:
                                                </Label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {AI_STYLES.map(st => {
                                                        const isSelected = aiStyle === st.id;
                                                        return (
                                                            <button
                                                                key={st.id}
                                                                type="button"
                                                                onClick={() => setAiStyle(st.id)}
                                                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                                                    isSelected 
                                                                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-xs font-semibold" 
                                                                        : "border-border/60 hover:bg-muted/40 text-foreground"
                                                                }`}
                                                            >
                                                                <div className="text-xs">{st.label}</div>
                                                                <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{st.desc}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Número de Destino */}
                                        <div className="space-y-1.5 pt-1">
                                            <Label className="text-xs font-semibold">WhatsApp de Destino (Opcional para envio direto)</Label>
                                            <Input
                                                placeholder="Ex: (79) 99876-5432 ou 5579998765432"
                                                value={aiTarget}
                                                onChange={e => setAiTarget(e.target.value)}
                                                className="h-9 text-xs font-mono"
                                            />
                                        </div>

                                        {/* Metadados */}
                                        <div className="grid grid-cols-2 gap-3 pt-1 border-t">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Pacote</Label>
                                                <Input value={aiPack} onChange={e => setAiPack(e.target.value)} className="h-8 text-xs" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Autor</Label>
                                                <Input value={aiAuthor} onChange={e => setAiAuthor(e.target.value)} className="h-8 text-xs" />
                                            </div>
                                        </div>

                                        {/* Botões de Ação */}
                                        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                                            <Button
                                                type="button"
                                                className="w-full sm:flex-1 h-10 text-xs font-bold gap-2 cursor-pointer bg-primary hover:bg-primary/90 shadow-xs"
                                                onClick={() => handleGenerateAiSticker(false)}
                                                disabled={aiGenerating || (!aiPrompt.trim() && !aiAttachedFile && !aiMemeText.trim())}
                                            >
                                                {aiGenerating ? (
                                                    <>
                                                        <RefreshCw className="h-4 w-4 animate-spin" /> Criando Figurinha...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-4 w-4" /> Criar Figurinha com Meme & IA
                                                    </>
                                                )}
                                            </Button>

                                            {aiTarget.trim() && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    className="w-full sm:w-auto h-10 text-xs font-semibold gap-1.5 cursor-pointer"
                                                    onClick={() => handleGenerateAiSticker(true)}
                                                    disabled={aiGenerating || !sessionId || (!aiPrompt.trim() && !aiAttachedFile && !aiMemeText.trim())}
                                                    title="Gera a figurinha com a imagem/frase e já envia diretamente"
                                                >
                                                    <Send className="h-3.5 w-3.5" /> Criar & Enviar Já
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Preview da Figurinha (5 colunas) */}
                            <div className="lg:col-span-5 space-y-4">
                                <Card className="shadow-xs border-border/70 h-full flex flex-col">
                                    <CardHeader className="pb-3 border-b bg-muted/15">
                                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                                            <span>Figurinha Final (.webp)</span>
                                            {generatedStickerUrl && (
                                                <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/20 border-green-200">
                                                    Padrão WhatsApp 512x512
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Formato oficial de figurinha com recorte e legenda em alta definição.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="p-5 flex-1 flex flex-col items-center justify-center">
                                        <div className="w-full aspect-square max-w-[280px] rounded-xl border border-dashed border-border/80 flex items-center justify-center bg-radial from-slate-50 to-slate-200 dark:from-slate-900/60 dark:to-slate-950/80 p-4 relative overflow-hidden shadow-inner">
                                            {aiGenerating ? (
                                                <div className="text-center space-y-3 p-4">
                                                    <Sparkles className="h-10 w-10 text-primary animate-bounce mx-auto" />
                                                    <p className="text-xs font-semibold text-foreground">Gerando sua figurinha com meme...</p>
                                                    <p className="text-[11px] text-muted-foreground">Estilizando, aplicando legenda e formato WhatsApp</p>
                                                </div>
                                            ) : generatedStickerUrl ? (
                                                <div className="relative flex flex-col items-center group">
                                                    <img
                                                        src={generatedStickerUrl}
                                                        alt="Figurinha de Meme Gerada"
                                                        className="w-56 h-56 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 duration-200"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="text-center text-muted-foreground space-y-2 p-4">
                                                    <ImageIcon className="w-10 h-10 mx-auto opacity-40 text-muted-foreground" />
                                                    <p className="text-xs font-medium">Nenhuma figurinha criada ainda</p>
                                                    <p className="text-[11px] text-muted-foreground max-w-[200px]">
                                                        Anexe uma foto ou digite uma frase de meme ao lado e clique em Criar!
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Ações após geração */}
                                        {generatedStickerUrl && (
                                            <div className="w-full max-w-[280px] pt-4 space-y-2">
                                                <Button
                                                    type="button"
                                                    onClick={handleSendGeneratedAiSticker}
                                                    disabled={aiSending || !aiTarget.trim() || !sessionId}
                                                    className="w-full h-9 text-xs font-bold gap-2 cursor-pointer shadow-xs"
                                                >
                                                    {aiSending ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="h-3.5 w-3.5" />
                                                    )}
                                                    {aiTarget.trim() ? "Enviar para o Destinatário" : "Informe o Número Acima para Enviar"}
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleDownloadSticker}
                                                    className="w-full h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                                                >
                                                    <Download className="h-3.5 w-3.5" /> Baixar Figurinha (.webp)
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ABA 2: ENVIO TRADICIONAL (SIMPLES) */}
                    <TabsContent value="traditional" className="mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="shadow-xs border-border/70">
                                <CardHeader className="pb-3 border-b bg-muted/15">
                                    <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" /> Converter Imagem em Figurinha
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Envie qualquer foto ou imagem do seu computador para transformar em figurinha.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-5 space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Número de Destino (Ex: (79) 99876-5432 ou 5579...)</Label>
                                        <Input
                                            placeholder="(79) 99876-5432 ou 5579998765432"
                                            value={traditionalTarget}
                                            onChange={e => setTraditionalTarget(e.target.value)}
                                            className="h-9 text-xs font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Arquivo de Imagem</Label>
                                        <div className="flex items-center justify-center w-full">
                                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors border-border/80">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                                    <ImageIcon className="w-8 h-8 mb-2 text-muted-foreground" />
                                                    <p className="text-xs text-foreground font-medium">Clique para escolher uma imagem ou arraste até aqui</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, JPEG ou WebP</p>
                                                </div>
                                                <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleTraditionalFileChange} />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full text-xs h-8 cursor-pointer">
                                            {showAdvanced ? "Ocultar Opções Avançadas" : "Opções Avançadas (Pacote, Autor, Recorte)"}
                                        </Button>
                                    </div>

                                    {showAdvanced && (
                                        <div className="space-y-3 border p-3 rounded-lg bg-muted/20 text-xs">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px]">Nome do Pacote</Label>
                                                    <Input value={traditionalPack} onChange={e => setTraditionalPack(e.target.value)} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px]">Autor</Label>
                                                    <Input value={traditionalAuthor} onChange={e => setTraditionalAuthor(e.target.value)} className="h-8 text-xs" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[11px]">Qualidade (1-100)</Label>
                                                    <Input type="number" min={1} max={100} value={traditionalQuality} onChange={e => setTraditionalQuality(parseInt(e.target.value) || 70)} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[11px]">Tipo de Recorte</Label>
                                                    <select
                                                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background"
                                                        value={traditionalType}
                                                        onChange={e => setTraditionalType(e.target.value)}
                                                    >
                                                        <option value="full">Completo (Full)</option>
                                                        <option value="crop">Cortado Quadrado (Crop)</option>
                                                        <option value="circle">Circular (Circle)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <Button 
                                            className="w-full h-10 text-xs font-bold gap-2 cursor-pointer shadow-xs" 
                                            onClick={handleSendTraditional} 
                                            disabled={traditionalLoading || !sessionId || !traditionalFile || !traditionalTarget}
                                        >
                                            {traditionalLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                            Converter & Enviar Figurinha
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xs border-border/70">
                                <CardHeader className="pb-3 border-b bg-muted/15">
                                    <CardTitle className="text-sm font-bold">Pré-visualização</CardTitle>
                                    <CardDescription className="text-xs">Veja como a imagem selecionada ficará.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-6">
                                    {traditionalPreview ? (
                                        <div className="w-60 h-60 flex items-center justify-center p-3 rounded-xl border border-dashed bg-muted/10">
                                            <img 
                                                src={traditionalPreview} 
                                                alt="Pré-visualização" 
                                                className={`max-w-full max-h-full object-contain drop-shadow-md ${traditionalType === 'circle' ? 'rounded-full' : 'rounded-lg'}`} 
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground p-6">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40 text-muted-foreground" />
                                            <p className="text-xs font-medium">Nenhuma imagem selecionada</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SessionGuard>
    );
}
