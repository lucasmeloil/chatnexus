"use client";

import React, { useState, useEffect } from "react";
import { 
    Star, 
    MessageSquare, 
    ThumbsUp, 
    TrendingUp, 
    RefreshCw, 
    User, 
    Calendar, 
    Search,
    ShieldCheck,
    PhoneCall,
    Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FeedbackItem {
    id: string;
    roomId: string;
    sessionId?: string;
    jid?: string;
    operatorName?: string;
    contactName?: string;
    rating: number;
    comment?: string;
    createdAt: string;
}

interface FeedbackSummary {
    feedbacks: FeedbackItem[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
    positivePercentage: number;
}

export default function FeedbacksDashboardPage() {
    const [data, setData] = useState<FeedbackSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [ratingFilter, setRatingFilter] = useState<number | null>(null);

    const loadFeedbacks = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/call/feedbacks?limit=200");
            const json = await res.json();
            if (json.status && json.data) {
                setData(json.data);
            }
        } catch (e) {
            console.error("Erro ao carregar feedbacks:", e);
            toast.error("Erro ao carregar dados de avaliações");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeedbacks();
    }, []);

    const filteredList = (data?.feedbacks || []).filter((fb) => {
        if (ratingFilter !== null && fb.rating !== ratingFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (fb.operatorName || "").toLowerCase().includes(q) ||
            (fb.contactName || "").toLowerCase().includes(q) ||
            (fb.comment || "").toLowerCase().includes(q)
        );
    });

    const formatDate = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return iso;
        }
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Award className="h-6 w-6 text-amber-500" />
                        Avaliações e Feedbacks dos Clientes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Índice de satisfação (CSAT / NPS), notas de 1 a 5 estrelas e comentários recebidos nos atendimentos de voz.
                    </p>
                </div>
                <Button 
                    onClick={loadFeedbacks} 
                    variant="outline" 
                    size="sm" 
                    disabled={loading}
                    className="gap-2 cursor-pointer shadow-sm shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    <span>Atualizar</span>
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* Average Rating */}
                <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Média de Satisfação
                        </CardTitle>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                            <Star className="h-4 w-4 fill-amber-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold tracking-tight text-foreground">
                                {data?.averageRating || 0}
                            </span>
                            <span className="text-xs text-muted-foreground font-semibold">/ 5.0</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <Star 
                                    key={s} 
                                    className={`h-3.5 w-3.5 ${
                                        s <= Math.round(data?.averageRating || 0)
                                            ? "text-amber-400 fill-amber-400"
                                            : "text-muted-foreground/30"
                                    }`}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Total Reviews */}
                <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total de Avaliações
                        </CardTitle>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                            <MessageSquare className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight text-foreground">
                            {data?.total || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Clientes que avaliaram ao término
                        </p>
                    </CardContent>
                </Card>

                {/* Approval Rate */}
                <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Aprovação (4 & 5 Estrelas)
                        </CardTitle>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                            <ThumbsUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {data?.positivePercentage || 0}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Clientes satisfeitos com o suporte
                        </p>
                    </CardContent>
                </Card>

                {/* Star Distribution Breakdown */}
                <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Distribuição
                        </CardTitle>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {[5, 4, 3, 2, 1].map((s) => {
                            const count = data?.ratingDistribution?.[s] || 0;
                            const total = data?.total || 1;
                            const pct = Math.round((count / total) * 100);
                            return (
                                <div key={s} className="flex items-center gap-1.5 text-[11px]">
                                    <span className="w-5 font-bold text-muted-foreground">{s}★</span>
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${s >= 4 ? "bg-amber-400" : s === 3 ? "bg-blue-400" : "bg-red-400"}`} 
                                            style={{ width: `${pct}%` }} 
                                        />
                                    </div>
                                    <span className="w-6 text-right font-mono text-muted-foreground">{count}</span>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por atendente, cliente ou texto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 text-xs rounded-xl h-9"
                    />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
                    <Button
                        size="sm"
                        variant={ratingFilter === null ? "default" : "outline"}
                        onClick={() => setRatingFilter(null)}
                        className="h-8 text-xs rounded-lg cursor-pointer"
                    >
                        Todas
                    </Button>
                    {[5, 4, 3, 2, 1].map((star) => (
                        <Button
                            key={star}
                            size="sm"
                            variant={ratingFilter === star ? "default" : "outline"}
                            onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                            className="h-8 text-xs rounded-lg gap-1 cursor-pointer"
                        >
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>{star}★</span>
                        </Button>
                    ))}
                </div>
            </div>

            {/* Feedback List */}
            <div className="space-y-3">
                {filteredList.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-border/70 p-8 space-y-2">
                        <Star className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <h4 className="text-sm font-semibold text-foreground">
                            Nenhuma avaliação encontrada
                        </h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Assim que os clientes concluírem as chamadas de voz e enviarem notas com estrelas, elas aparecerão aqui automaticamente.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        {filteredList.map((item) => (
                            <Card key={item.id} className="border border-border/60 shadow-sm hover:shadow transition-shadow bg-card/70 backdrop-blur-sm">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                                {item.contactName ? item.contactName[0]?.toUpperCase() : "C"}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-foreground">
                                                    {item.contactName || "Cliente"}
                                                </h4>
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    Atendente: <strong className="text-foreground">{item.operatorName || "Equipe"}</strong>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <Star 
                                                        key={s} 
                                                        className={`h-3.5 w-3.5 ${
                                                            s <= item.rating 
                                                                ? "text-amber-400 fill-amber-400" 
                                                                : "text-muted-foreground/30"
                                                        }`} 
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {formatDate(item.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {item.comment ? (
                                        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs text-foreground italic">
                                            "{item.comment}"
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-muted-foreground italic">
                                            (Sem comentário adicional)
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

