"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Send, Palette, Smile, Download } from "lucide-react";
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
    { id: "caricature", label: "🎭 Caricatura Engraçada" },
    { id: "pixar3d", label: "🦄 3D Pixar / Cartoon" },
    { id: "meme", label: "🕶️ Meme Óculos Escuros" },
    { id: "anime", label: "💥 Anime / Chocado" },
    { id: "party", label: "🥳 Festa & Risos" },
    { id: "cute", label: "🐱 Mascote Fofo" }
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
    const [style, setStyle] = useState("caricature");
    const [generating, setGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const cleanNumber = jid ? jid.replace("@s.whatsapp.net", "").replace("@g.us", "") : "";
    const displayName = clientName || cleanNumber || "Cliente";

    const handleGenerateAndSend = async (sendDirectly: boolean) => {
        if (!prompt.trim()) {
            toast.warning("Descreva a figurinha que deseja criar.");
            return;
        }

        setGenerating(true);
        try {
            const formData = new FormData();
            formData.append("prompt", prompt.trim());
            formData.append("style", style);
            formData.append("pack", "Nexus Memes");
            formData.append("author", "Nexus Chat");

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
                        <Sparkles className="h-4 w-4 text-pink-500" /> Figurinha com IA para {displayName}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        A IA gratuita cria uma figurinha recortada e bem-humorada em segundos.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {/* Descrição / Prompt */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Ideia da Figurinha</Label>
                        <Textarea
                            placeholder="Ex: Cara rindo muito com óculos escuros estilo meme com joinha..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            className="text-xs min-h-[70px] resize-none"
                            autoFocus
                        />
                    </div>

                    {/* Estilos Rápidos */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                            <Palette className="h-3 w-3 text-primary" /> Estilo:
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {AI_STYLES.map(st => (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setStyle(st.id)}
                                    className={`px-2 py-1.5 rounded-md border text-left text-[11px] transition-colors cursor-pointer ${
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

                    {/* Preview da Figurinha se gerada */}
                    {previewUrl && (
                        <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed bg-muted/20">
                            <img
                                src={previewUrl}
                                alt="Figurinha Gerada"
                                className="w-32 h-32 object-contain drop-shadow-md"
                            />
                            <p className="text-[11px] text-green-600 font-semibold mt-1">Pronta para envio!</p>
                        </div>
                    )}

                    {/* Botões */}
                    <div className="pt-1 flex items-center justify-end gap-2">
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
                                className="h-8 text-xs font-bold gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700"
                            >
                                {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                Enviar para o Cliente
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleGenerateAndSend(true)}
                                disabled={generating || !prompt.trim()}
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

