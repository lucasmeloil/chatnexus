"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, Send, Palette, Paperclip, X, Type } from "lucide-react";
import { toast } from "sonner";

interface AiStickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    jid: string;
    clientName?: string;
    onSent?: () => void;
}

const AI_STYLES = [
    { id: "caricature", label: "🎭 Caricatura" },
    { id: "pixar3d", label: "🦄 3D Pixar" },
    { id: "meme", label: "🕶️ Meme Óculos" },
    { id: "anime", label: "💥 Anime" },
    { id: "party", label: "🥳 Festa" },
    { id: "cute", label: "🐱 Fofo" }
];

const FUNNY_ACCESSORIES = [
    { id: "thug_glasses", label: "🕶️ Óculos Thug Life" },
    { id: "clown", label: "🤡 Nariz & Festa" },
    { id: "mustache", label: "🥸 Bigode Cômico" },
    { id: "laugh_tears", label: "😭 Chorando de Rir" },
    { id: "laser_eyes", label: "🔥 Olhos Laser" },
    { id: "zueira_full", label: "🚀 Zueira Máxima" },
    { id: "none", label: "🚫 Sem Acessório" }
];

const QUICK_MEMES = [
    "CALMA CALABRESO 😂",
    "PAGOU O BOLETO? 💸",
    "CHAMA NO ZAP 📲",
    "TÁ PAGO! 🚀"
];

export function AiStickerDialog({
    open,
    onOpenChange,
    sessionId,
    jid,
    clientName,
    onSent
}: AiStickerDialogProps) {
    const [prompt, setPrompt] = useState("");
    const [memeText, setMemeText] = useState("");
    const [style, setStyle] = useState("caricature");
    const [accessory, setAccessory] = useState("thug_glasses");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const cleanNumber = jid ? jid.replace("@s.whatsapp.net", "").replace("@g.us", "") : "";
    const displayName = clientName || cleanNumber || "Cliente";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setAttachedFile(f);
            setAttachedPreview(URL.createObjectURL(f));
        }
    };

    const handleRemoveFile = () => {
        setAttachedFile(null);
        setAttachedPreview(null);
    };

    const handleGenerateAndSend = async (sendDirectly: boolean) => {
        if (!prompt.trim() && !attachedFile && !memeText.trim()) {
            toast.warning("Anexe uma foto, digite uma frase de meme ou descreva a figurinha.");
            return;
        }

        setGenerating(true);
        try {
            const formData = new FormData();
            formData.append("prompt", prompt.trim());
            formData.append("memeText", memeText.trim());
            formData.append("style", style);
            formData.append("accessory", accessory);
            formData.append("pack", "Nexus Memes");
            formData.append("author", "Nexus Chat");

            if (attachedFile) {
                formData.append("file", attachedFile);
            }

            if (sendDirectly) {
                formData.append("sessionId", sessionId);
                formData.append("target", jid);
            }

            const res = await fetch("/api/stickers/generate-ai", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.status) {
                setPreviewUrl(data.webpBase64);
                if (data.sent) {
                    toast.success(`🎉 Figurinha enviada para ${displayName}!`);
                    if (onSent) onSent();
                    onOpenChange(false);
                    setPrompt("");
                    setMemeText("");
                    setAttachedFile(null);
                    setAttachedPreview(null);
                    setPreviewUrl(null);
                } else {
                    toast.success("Figurinha gerada! Veja a pré-visualização.");
                }
            } else {
                toast.error(data.message || "Erro ao gerar figurinha.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro na comunicação com a IA.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSendPreview = async () => {
        if (!previewUrl) return;
        setGenerating(true);
        try {
            const fetchRes = await fetch(previewUrl);
            const blob = await fetchRes.blob();
            const file = new File([blob], "sticker.webp", { type: "image/webp" });

            const formData = new FormData();
            formData.append("file", file);
            formData.append("pack", "Nexus Memes");
            formData.append("author", "Nexus Chat");
            formData.append("quality", "75");
            formData.append("type", "full");

            const encodedJid = encodeURIComponent(jid);
            const res = await fetch(`/api/messages/${sessionId}/${encodedJid}/sticker`, {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                toast.success(`Figurinha enviada para ${displayName}!`);
                if (onSent) onSent();
                onOpenChange(false);
                setPrompt("");
                setMemeText("");
                setAttachedFile(null);
                setAttachedPreview(null);
                setPreviewUrl(null);
            } else {
                toast.error("Falha ao enviar figurinha.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao enviar figurinha.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-muted/20">
                    <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-pink-500" /> Figurinha com Foto, Meme & IA
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Envie para {displayName} como figurinha oficial do WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
                    {/* Anexar Foto (Opcional) */}
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Foto / Imagem Anexada (Opcional)</Label>
                        {attachedPreview ? (
                            <div className="flex items-center justify-between p-2 rounded-lg border bg-card gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <img src={attachedPreview} alt="Preview" className="w-10 h-10 rounded-md object-cover border" />
                                    <span className="text-xs font-medium truncate">{attachedFile?.name || "Foto anexada"}</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <label className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-border/70 hover:bg-muted/30 cursor-pointer text-xs text-muted-foreground">
                                <Paperclip className="h-3.5 w-3.5 text-primary" />
                                <span>Anexar foto para transformar em figurinha</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </label>
                        )}
                    </div>

                    {/* Frase de Meme */}
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                            <Type className="h-3 w-3 text-primary" /> Frase do Meme (Legenda na foto)
                        </Label>
                        <Input
                            placeholder="Ex: CALMA CALABRESO ou PAGOU O BOLETO?"
                            value={memeText}
                            onChange={e => setMemeText(e.target.value)}
                            className="h-8 text-xs uppercase font-bold"
                        />
                        <div className="flex gap-1 flex-wrap pt-0.5">
                            {QUICK_MEMES.map((qm, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setMemeText(qm)}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-muted/40 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                >
                                    {qm}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Efeito Engraçado / Acessório Cômico */}
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-pink-500" /> Alteração Engraçada na Imagem:
                        </Label>
                        <div className="grid grid-cols-3 gap-1">
                            {FUNNY_ACCESSORIES.map(acc => (
                                <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => setAccessory(acc.id)}
                                    className={`px-1.5 py-1 rounded border text-center text-[10px] transition-colors cursor-pointer ${
                                        accessory === acc.id
                                            ? "border-pink-500 bg-pink-500/10 text-pink-600 font-semibold"
                                            : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                                    }`}
                                >
                                    {acc.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descrição / Prompt Livre */}
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Ideia / Prompt para a IA (Opcional)</Label>
                        <Textarea
                            placeholder="Ex: Caricatura muito engraçada com óculos escuros..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            className="text-xs min-h-[55px] resize-none"
                        />
                    </div>

                    {/* Estilos Rápidos (quando sem foto anexada) */}
                    {!attachedFile && (
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <Palette className="h-3 w-3 text-primary" /> Estilo:
                            </Label>
                            <div className="grid grid-cols-3 gap-1">
                                {AI_STYLES.map(st => (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => setStyle(st.id)}
                                        className={`px-1.5 py-1 rounded border text-center text-[10px] transition-colors cursor-pointer ${
                                            style === st.id
                                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                                : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview da Figurinha se gerada */}
                    {previewUrl && (
                        <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed bg-muted/20">
                            <img
                                src={previewUrl}
                                alt="Figurinha Gerada"
                                className="w-28 h-28 object-contain drop-shadow-md"
                            />
                            <p className="text-[10px] text-green-600 font-semibold mt-1">Pronta para o WhatsApp!</p>
                        </div>
                    )}

                    {/* Botões */}
                    <div className="pt-1 flex items-center justify-end gap-2 border-t">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="h-8 text-xs cursor-pointer"
                        >
                            Cancelar
                        </Button>

                        {previewUrl ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSendPreview}
                                disabled={generating}
                                className="h-8 text-xs font-bold gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Enviar para {displayName}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleGenerateAndSend(true)}
                                disabled={generating || (!prompt.trim() && !attachedFile && !memeText.trim())}
                                className="h-8 text-xs font-bold gap-1.5 cursor-pointer bg-pink-600 hover:bg-pink-700 text-white"
                            >
                                {generating ? (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Criando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-3.5 w-3.5" /> Criar & Enviar Figurinha
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
