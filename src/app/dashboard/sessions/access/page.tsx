"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    UserPlus,
    Trash2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    User,
    Users,
    Lock,
    Loader2,
    Tag,
    Edit2,
    Check,
    Plus,
    Key,
    PhoneCall
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface SessionInfo {
    id: string;
    sessionId: string;
    name: string;
    userId: string;
    status: string;
}

interface AttendantEntry {
    id: string;
    userId: string;
    name: string | null;
    email: string;
    role: string;
    allowedTags: string[];
    createdAt: string;
}

const DEFAULT_SECTOR_TAGS = [
    { name: "Comercial", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    { name: "Financeiro", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    { name: "Pessoal", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
    { name: "Suporte", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
];

export default function SessionAccessPage() {
    const { data: authSession } = useSession();
    const searchParams = useSearchParams();
    const sessionFromUrl = searchParams.get("session") || "";

    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>(sessionFromUrl);
    const [attendants, setAttendants] = useState<AttendantEntry[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>(["Comercial", "Financeiro", "Pessoal", "Suporte"]);
    const [loading, setLoading] = useState(true);
    const [attendantsLoading, setAttendantsLoading] = useState(false);

    // Modal Create Attendant State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createEmail, setCreateEmail] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [createTags, setCreateTags] = useState<string[]>(["Comercial"]);
    const [customTagInput, setCustomTagInput] = useState("");
    const [submittingCreate, setSubmittingCreate] = useState(false);

    // Modal Edit Attendant State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingAttendant, setEditingAttendant] = useState<AttendantEntry | null>(null);
    const [editName, setEditName] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [editTags, setEditTags] = useState<string[]>([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Revoke Confirm State
    const [revokeTarget, setRevokeTarget] = useState<AttendantEntry | null>(null);

    // @ts-ignore
    const currentUserId = authSession?.user?.id;
    // @ts-ignore
    const currentUserRole = authSession?.user?.role;

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch("/api/sessions");
            if (res.ok) {
                const data = await res.json();
                const allSessions: SessionInfo[] = data?.data || [];
                const accessible = currentUserRole === "SUPERADMIN"
                    ? allSessions
                    : allSessions.filter((s: SessionInfo) => s.userId === currentUserId || true);
                setSessions(accessible);
                if (accessible.length > 0 && !selectedSession) {
                    setSelectedSession(accessible[0].sessionId);
                }
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
            toast.error("Erro ao carregar sessões");
        } finally {
            setLoading(false);
        }
    }, [currentUserId, currentUserRole, selectedSession]);

    useEffect(() => {
        if (!authSession?.user) return;
        fetchSessions();
    }, [authSession?.user, fetchSessions]);

    // Fetch session labels to add to available tags
    const fetchSessionLabels = useCallback(async () => {
        if (!selectedSession) return;
        try {
            const res = await fetch(`/api/labels/${selectedSession}`);
            if (res.ok) {
                const data = await res.json();
                const labels = data.data?.labels || [];
                const labelNames = labels.map((l: any) => l.name);
                setAvailableTags(prev => Array.from(new Set([...prev, ...labelNames])));
            }
        } catch { }
    }, [selectedSession]);

    // Fetch Attendants for selected session
    const fetchAttendants = useCallback(async () => {
        if (!selectedSession) return;
        setAttendantsLoading(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/attendants`);
            if (res.ok) {
                const data = await res.json();
                setAttendants(data.data || []);
            } else {
                setAttendants([]);
            }
        } catch (error) {
            console.error("Failed to fetch attendants", error);
            toast.error("Erro ao carregar lista de atendentes");
        } finally {
            setAttendantsLoading(false);
        }
    }, [selectedSession]);

    useEffect(() => {
        if (selectedSession) {
            fetchAttendants();
            fetchSessionLabels();
        }
    }, [selectedSession, fetchAttendants, fetchSessionLabels]);

    // Handle Create Attendant
    const handleCreateAttendant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSession || !createEmail.trim()) return;

        setSubmittingCreate(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/attendants`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: createName.trim() || undefined,
                    email: createEmail.trim().toLowerCase(),
                    password: createPassword,
                    allowedTags: createTags
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Atendente cadastrado com sucesso!");
                setIsCreateOpen(false);
                setCreateName("");
                setCreateEmail("");
                setCreatePassword("");
                setCreateTags(["Comercial"]);
                fetchAttendants();
            } else {
                toast.error(data.message || "Falha ao cadastrar atendente");
            }
        } catch (error) {
            toast.error("Erro ao conectar ao servidor");
        } finally {
            setSubmittingCreate(false);
        }
    };

    // Open Edit Attendant
    const openEdit = (att: AttendantEntry) => {
        setEditingAttendant(att);
        setEditName(att.name || "");
        setEditPassword("");
        setEditTags(att.allowedTags || []);
        setIsEditOpen(true);
    };

    // Handle Edit Attendant
    const handleEditAttendant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSession || !editingAttendant) return;

        setSubmittingEdit(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/attendants`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: editingAttendant.userId,
                    name: editName.trim() || undefined,
                    password: editPassword.trim() || undefined,
                    allowedTags: editTags
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Atendente atualizado com sucesso!");
                setIsEditOpen(false);
                setEditingAttendant(null);
                fetchAttendants();
            } else {
                toast.error(data.message || "Falha ao atualizar atendente");
            }
        } catch (error) {
            toast.error("Erro ao atualizar atendente");
        } finally {
            setSubmittingEdit(false);
        }
    };

    // Handle Revoke
    const confirmRevoke = async () => {
        if (!revokeTarget || !selectedSession) return;
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/attendants?userId=${encodeURIComponent(revokeTarget.userId)}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Acesso revogado com sucesso");
                fetchAttendants();
            } else {
                toast.error(data.message || "Erro ao revogar acesso");
            }
        } catch {
            toast.error("Erro ao revogar acesso");
        } finally {
            setRevokeTarget(null);
        }
    };

    // Toggle Tag in Create Form
    const toggleCreateTag = (tag: string) => {
        setCreateTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    // Toggle Tag in Edit Form
    const toggleEditTag = (tag: string) => {
        setEditTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    // Add Custom Tag
    const addCustomTag = () => {
        const trimmed = customTagInput.trim();
        if (!trimmed) return;
        if (!availableTags.includes(trimmed)) {
            setAvailableTags(prev => [...prev, trimmed]);
        }
        if (!createTags.includes(trimmed)) {
            setCreateTags(prev => [...prev, trimmed]);
        }
        setCustomTagInput("");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando sessões e atendentes...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" /> Atendentes & Acessos da Sessão
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie os atendentes autorizados a atender clientes neste número de WhatsApp e defina os setores/tags de cada um.
                    </p>
                </div>
                {selectedSession && (
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm font-semibold">
                        <UserPlus className="h-4 w-4" /> Cadastrar Novo Atendente
                    </Button>
                )}
            </div>

            {/* Session Selector */}
            <Card className="shadow-xs border-border/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-emerald-500" /> Selecionar Número / Sessão WhatsApp
                    </CardTitle>
                    <CardDescription>
                        Escolha a sessão de WhatsApp na qual os atendentes estarão conectados (Multi-atendimento).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Nenhuma sessão ativa encontrada. Crie uma sessão no menu Sessões / QR Code primeiro.
                        </p>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <Select value={selectedSession} onValueChange={setSelectedSession}>
                                <SelectTrigger className="w-full sm:w-[380px]">
                                    <SelectValue placeholder="Selecione uma sessão" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sessions.map(s => (
                                        <SelectItem key={s.sessionId} value={s.sessionId}>
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${s.status === "CONNECTED" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                                <span className="font-medium">{s.name}</span>
                                                <span className="text-xs text-muted-foreground font-mono">({s.sessionId})</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground">
                                Vários atendentes podem operar o mesmo número simultaneamente com isolamento e segurança.
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Attendants List */}
            {selectedSession && (
                <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" /> Atendentes Cadastrados nesta Sessão
                            </CardTitle>
                            <CardDescription>
                                Atendentes que têm acesso a este número e suas respectivas etiquetas de atendimento.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="px-2.5 py-1 text-xs">
                            {attendants.length} atendente{attendants.length !== 1 ? "s" : ""}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        {attendantsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Carregando atendentes...</span>
                            </div>
                        ) : attendants.length === 0 ? (
                            <div className="text-center py-10 px-4 border border-dashed rounded-xl">
                                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                                <h3 className="font-semibold text-sm text-foreground">Nenhum atendente cadastrado nesta sessão</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                    Cadastre atendentes para que múltiplos operadores possam receber chamados e responder clientes com segurança e privacidade.
                                </p>
                                <Button onClick={() => setIsCreateOpen(true)} size="sm" className="mt-4 gap-1.5">
                                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar Primeiro Atendente
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {attendants.map(att => (
                                    <div key={att.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                                {(att.name || att.email).slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-foreground truncate">{att.name || "Sem nome"}</span>
                                                    <Badge variant={att.role === "SUPERADMIN" ? "destructive" : att.role === "OWNER" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                                        {att.role === "STAFF" ? "Atendente" : att.role}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground font-mono truncate">{att.email}</p>
                                                
                                                {/* Assigned Tags */}
                                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                                        <Tag className="h-3 w-3" /> Setores:
                                                    </span>
                                                    {att.allowedTags && att.allowedTags.length > 0 ? (
                                                        att.allowedTags.map(tag => (
                                                            <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                                                {tag}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] italic text-muted-foreground">
                                                            Todos os setores (Geral)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEdit(att)}
                                                className="h-8 px-2.5 text-xs gap-1.5"
                                                title="Editar dados e setores deste atendente"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" /> Editar Setores / Senha
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setRevokeTarget(att)}
                                                className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                                title="Revogar acesso"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modal: Cadastrar Atendente */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base text-primary">
                            <UserPlus className="h-5 w-5" /> Cadastrar Atendente para a Sessão
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Crie o acesso do atendente e defina quais setores/etiquetas ele terá permissão para atender nesta sessão.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateAttendant} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Nome Completo do Atendente</Label>
                            <Input
                                placeholder="Ex: Lucas Melo"
                                value={createName}
                                onChange={e => setCreateName(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Email de Login</Label>
                            <Input
                                type="email"
                                placeholder="atendente@empresa.com"
                                value={createEmail}
                                onChange={e => setCreateEmail(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Senha de Acesso</Label>
                            <Input
                                type="password"
                                placeholder="Mínimo 4 caracteres"
                                value={createPassword}
                                onChange={e => setCreatePassword(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        {/* Setores / Tags */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold flex items-center justify-between">
                                <span>Tags / Setores Permitidos</span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                    {createTags.length} selecionada{createTags.length !== 1 ? "s" : ""}
                                </span>
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                O atendente verá na fila de espera somente clientes que forem designados aos setores marcados abaixo.
                            </p>

                            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/40 border">
                                {availableTags.map(tag => {
                                    const isSelected = createTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleCreateTag(tag)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                                    : "bg-background text-muted-foreground hover:text-foreground border-border/50"
                                            )}
                                        >
                                            {isSelected && <Check className="h-3 w-3" />}
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Add Custom Tag */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nova tag/setor (ex: Suporte VIP)..."
                                    value={customTagInput}
                                    onChange={e => setCustomTagInput(e.target.value)}
                                    className="h-8 text-xs"
                                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
                                />
                                <Button type="button" size="sm" variant="outline" onClick={addCustomTag} className="h-8 text-xs shrink-0">
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Tag
                                </Button>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={submittingCreate} className="gap-1.5">
                                {submittingCreate ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-3.5 w-3.5" /> Salvar e Cadastrar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal: Editar Atendente */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base text-primary">
                            <Edit2 className="h-5 w-5" /> Editar Atendente
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Altere o nome, redefina a senha ou modifique os setores permitidos para <strong>{editingAttendant?.email}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditAttendant} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Nome do Atendente</Label>
                            <Input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Nova Senha (deixe em branco para manter a atual)</Label>
                            <Input
                                type="password"
                                placeholder="Digite apenas se desejar alterar a senha"
                                value={editPassword}
                                onChange={e => setEditPassword(e.target.value)}
                                className="h-9 text-xs"
                            />
                        </div>

                        {/* Setores / Tags */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold flex items-center justify-between">
                                <span>Tags / Setores Permitidos</span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                    {editTags.length} selecionada{editTags.length !== 1 ? "s" : ""}
                                </span>
                            </Label>

                            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/40 border">
                                {availableTags.map(tag => {
                                    const isSelected = editTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleEditTag(tag)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                                    : "bg-background text-muted-foreground hover:text-foreground border-border/50"
                                            )}
                                        >
                                            {isSelected && <Check className="h-3 w-3" />}
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={submittingEdit} className="gap-1.5">
                                {submittingEdit ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-3.5 w-3.5" /> Salvar Alterações
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Revoke Dialog */}
            <AlertDialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revogar Acesso do Atendente</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja revogar o acesso de <strong>{revokeTarget?.name || revokeTarget?.email}</strong> a esta sessão?
                            O atendente não poderá mais visualizar nem responder conversas deste número.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRevoke} className="bg-red-600 hover:bg-red-700 text-white">
                            Confirmar Revogação
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
