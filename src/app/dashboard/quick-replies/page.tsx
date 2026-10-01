"use client";

import { useState, useEffect } from "react";
import { 
    Zap, 
    Plus, 
    Search, 
    Edit, 
    Trash2, 
    Copy, 
    Check, 
    Tag, 
    Folder, 
    MessageSquare, 
    Sparkles, 
    Clock, 
    Layers,
    Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface QuickReply {
    id: string;
    shortcut: string;
    title: string;
    content: string;
    category: string;
    createdAt?: string;
    updatedAt?: string;
}

const CATEGORIES = ["Todos", "Geral", "Atendimento", "Comercial", "Financeiro", "Pessoal"];

export default function QuickRepliesPage() {
    const [replies, setReplies] = useState<QuickReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
    const [formData, setFormData] = useState({
        shortcut: "",
        title: "",
        content: "",
        category: "Geral",
    });
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const fetchReplies = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/quick-replies");
            const data = await res.json();
            if (data.success) {
                setReplies(data.data || []);
            } else {
                toast.error(data.message || "Erro ao carregar respostas rápidas");
            }
        } catch (err: any) {
            toast.error("Erro de conexão ao carregar respostas rápidas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReplies();
    }, []);

    const handleOpenCreate = () => {
        setEditingReply(null);
        setFormData({
            shortcut: "/",
            title: "",
            content: "",
            category: "Geral",
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (reply: QuickReply) => {
        setEditingReply(reply);
        setFormData({
            shortcut: reply.shortcut,
            title: reply.title,
            content: reply.content,
            category: reply.category || "Geral",
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.shortcut.trim() || !formData.content.trim()) {
            toast.warning("Preencha o atalho e a mensagem");
            return;
        }

        try {
            setIsSaving(true);
            const url = editingReply 
                ? `/api/quick-replies/${editingReply.id}`
                : "/api/quick-replies";
            const method = editingReply ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(editingReply ? "Resposta rápida atualizada!" : "Resposta rápida cadastrada com sucesso!");
                setIsModalOpen(false);
                fetchReplies();
            } else {
                toast.error(data.message || "Erro ao salvar resposta rápida");
            }
        } catch (err: any) {
            toast.error("Erro ao salvar dados");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/quick-replies/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                toast.success("Resposta rápida removida");
                setReplies(prev => prev.filter(r => r.id !== id));
            } else {
                toast.error(data.message || "Erro ao excluir");
            }
        } catch (err) {
            toast.error("Falha ao excluir resposta rápida");
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("Texto copiado para a área de transferência!");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredReplies = replies.filter((reply) => {
        const matchesCategory = selectedCategory === "Todos" || reply.category === selectedCategory;
        const matchesSearch = 
            reply.shortcut.toLowerCase().includes(search.toLowerCase()) ||
            reply.title.toLowerCase().includes(search.toLowerCase()) ||
            reply.content.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categoryCounts = replies.reduce((acc: any, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Zap className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Respostas Rápidas
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Cadastre e gerencie mensagens pré-definidas para acelerar o atendimento. Digite <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded font-mono font-semibold text-primary">/</kbd> no chat para utilizá-las instantaneamente.
                    </p>
                </div>
                <Button 
                    onClick={handleOpenCreate} 
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-xl"
                >
                    <Plus className="h-4 w-4" />
                    Nova Resposta Rápida
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Cadastrado</p>
                        <p className="text-xl font-bold text-foreground">{replies.length}</p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Atalho Estratégico</p>
                        <p className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400">/ ou //</p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Setores</p>
                        <p className="text-sm font-semibold text-foreground">Comercial, Financeiro, Pessoal</p>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Produtividade</p>
                        <p className="text-sm font-semibold text-foreground">Agilidade em 1 clique</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/40">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                    {CATEGORIES.map((cat) => {
                        const count = cat === "Todos" ? replies.length : (categoryCounts[cat] || 0);
                        const isSelected = selectedCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    isSelected 
                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                                <span>{cat}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por atalho ou texto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-xs rounded-lg"
                    />
                </div>
            </div>

            {/* Quick Replies Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-7 w-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
            ) : filteredReplies.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border/60 p-8">
                    <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="text-base font-semibold text-foreground">Nenhuma resposta rápida encontrada</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                        {search ? "Tente alterar os termos da busca ou a categoria selecionada." : "Comece cadastrando sua primeira resposta rápida para otimizar o atendimento."}
                    </p>
                    <Button onClick={handleOpenCreate} size="sm" className="gap-2">
                        <Plus className="h-4 w-4" /> Cadastrar Resposta Rápida
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReplies.map((reply) => {
                        const isCopied = copiedId === reply.id;
                        return (
                            <div 
                                key={reply.id}
                                className="group bg-card hover:bg-accent/10 border border-border/50 hover:border-primary/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                                {reply.shortcut}
                                            </span>
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40">
                                                {reply.category || "Geral"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleCopy(reply.content, reply.id)}
                                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                                title="Copiar texto"
                                            >
                                                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(reply)}
                                                className="p-1 rounded text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                                                title="Editar"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(reply.id)}
                                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-semibold text-foreground mb-1">
                                        {reply.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/30">
                                        {reply.content}
                                    </p>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>Atalho: <code className="font-mono text-primary font-semibold">{reply.shortcut}</code></span>
                                    <button 
                                        onClick={() => handleCopy(reply.content, reply.id)}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        {isCopied ? "Copiado!" : "Usar no Chat"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Zap className="h-5 w-5 text-primary" />
                            {editingReply ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Configure o atalho e a mensagem pré-definida. Digitando o atalho na conversa o texto será sugerido automaticamente.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-foreground">
                                    Atalho Estratégico <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    placeholder="/exemplo ou //chave"
                                    value={formData.shortcut}
                                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                                    className="font-mono text-xs"
                                    required
                                />
                                <span className="text-[10px] text-muted-foreground">Ex: /ola, /pix, /horario</span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-foreground">
                                    Categoria / Setor
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="Geral">Geral</option>
                                    <option value="Atendimento">Atendimento</option>
                                    <option value="Comercial">Comercial</option>
                                    <option value="Financeiro">Financeiro</option>
                                    <option value="Pessoal">Pessoal</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                Título / Identificador <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="Ex: Saudação Inicial ou Chave PIX"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                                Mensagem / Conteúdo da Resposta <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                placeholder="Digite a mensagem completa que será inserida ao acionar o atalho..."
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                rows={5}
                                className="text-xs leading-relaxed"
                                required
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsModalOpen(false)}
                                className="text-xs"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving}
                                className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                                {isSaving ? "Salvando..." : (editingReply ? "Atualizar" : "Salvar Resposta")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base text-destructive flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Excluir Resposta Rápida?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Tem certeza de que deseja remover esta resposta rápida? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                        >
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
