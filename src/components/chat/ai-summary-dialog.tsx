"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";

interface AiSummaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    jid: string;
    clientName?: string;
}

export function AiSummaryDialog({
    open,
    onOpenChange,
    sessionId,
    jid,
    clientName
}: AiSummaryDialogProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const displayName = clientName || jid.split("@")[0] || "Cliente";

    const fetchSummary = async () => {
        setLoading(true);
        setSummary(null);
        try {
            const res = await fetch("/api/chat/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, jid, clientName: displayName })
            });

            const data = await res.json();
            if (res.ok && data.status) {
                setSummary(data.summary);
            } else {
                toast.error(data.message || "Erro ao gerar resumo da conversa.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Falha ao comunicar com a IA de resumo.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!summary) return;
        navigator.clipboard.writeText(summary);
        setCopied(true);
        toast.success("Resumo copiado para a área de transferência!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (val && !summary && !loading) {
                fetchSummary();
            }
        }}>
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-muted/20">
                    <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" /> Resumo Inteligente do Atendimento
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Síntese executiva das últimas mensagens trocadas com <strong>{displayName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {loading ? (
                        <div className="py-12 text-center space-y-3">
                            <Sparkles className="h-8 w-8 text-purple-500 animate-spin mx-auto" />
                            <p className="text-xs font-semibold text-foreground">A IA está lendo o histórico e sintetizando o caso...</p>
                            <p className="text-[11px] text-muted-foreground">Identificando o assunto principal, detalhes e próximos passos</p>
                        </div>
                    ) : summary ? (
                        <div className="space-y-3">
                            <div className="p-3.5 rounded-xl border bg-muted/20 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[350px] overflow-y-auto font-sans select-text">
                                {summary}
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchSummary}
                                    className="h-8 text-xs gap-1.5 cursor-pointer"
                                >
                                    <RefreshCw className="h-3 w-3" /> Atualizar Resumo
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-8 text-xs gap-1.5 font-semibold cursor-pointer bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? "Copiado!" : "Copiar Resumo"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground space-y-2">
                            <FileText className="h-8 w-8 mx-auto opacity-40" />
                            <p className="text-xs font-medium">Nenhum resumo gerado.</p>
                            <Button size="sm" onClick={fetchSummary} className="text-xs">Gerar Resumo</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

