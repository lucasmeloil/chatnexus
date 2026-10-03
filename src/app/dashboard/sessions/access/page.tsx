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
    PhoneCall,
    Mail,
    AlertTriangle
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
    isOwner?: boolean;
    allowedTags: string[];
    createdAt: string;
}

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
    const [createRole, setCreateRole] = useState("STAFF");
    const [createTags, setCreateTags] = useState<string[]>(["Comercial"]);
    const [customTagInput, setCustomTagInput] = useState("");
    const [submittingCreate, setSubmittingCreate] = useState(false);

    // Modal Edit Attendant State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingAttendant, setEditingAttendant] = useState<AttendantEntry | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [editRole, setEditRole] = useState("STAFF");
    const [editTags, setEditTags] = useState<string[]>([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Delete / Revoke Confirm State
    const [revokeTarget, setRevokeTarget] = useState<AttendantEntry | null>(null);
    const [deletePermanently, setDeletePermanently] = useState(true);
    const [submittingRevoke, setSubmittingRevoke] = useState(false);

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
                const isMasterAdmin = currentUserRole === "SUPERADMIN" || authSession?.user?.email?.toLowerCase() === "lucasmeloil@pm.me";
                const accessible = isMasterAdmin
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
                    role: createRole,
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
                setCreateRole("STAFF");
                setCreateTags(["Comercial"]);
                await fetchAttendants();
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
        setEditEmail(att.email || "");
        setEditPassword("");
        setEditRole(att.role || "STAFF");
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
                    email: editEmail.trim() || undefined,
                    password: editPassword.trim() || undefined,
                    role: editRole,
                    allowedTags: editTags
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Atendente atualizado com sucesso!");
                setIsEditOpen(false);
                setEditingAttendant(null);
                await fetchAttendants();
            } else {
                toast.error(data.message || "Falha ao atualizar atendente");
            }
        } catch (error) {
            toast.error("Erro ao atualizar atendente");
        } finally {
            setSubmittingEdit(false);
        }
    };

    // Handle Revoke / Delete
    const confirmRevoke = async () => {
        if (!revokeTarget || !selectedSession) return;
        setSubmittingRevoke(true);
        try {
            const res = await fetch(`/api/sessions/${selectedSession}/attendants?userId=${encodeURIComponent(revokeTarget.userId)}&permanent=${deletePermanently ? "true" : "false"}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Acesso removido com sucesso!");
                setRevokeTarget(null);
                await fetchAttendants();
            } else {
                toast.error(data.message || "Erro ao remover atendente");
            }
        } catch {
            toast.error("Erro ao comunicar com o servidor");
        } finally {
            setSubmittingRevoke(false);
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
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
                        <Users className="h-6 w-6 text-primary" /> Atendentes & Acessos da Sessão
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Gerencie os atendentes autorizados a atender clientes neste número de WhatsApp e defina os setores/tags de cada um.
                    </p>
                </div>
                {selectedSession && (
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm font-semibold cursor-pointer">
                        <UserPlus className="h-4 w-4" /> Cadastrar Novo Atendente
                    </Button>
                )}
            </div>

            {/* Session Selector */}
            <Card className="shadow-xs border-border/70">
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
                <Card className="shadow-xs border-border/70">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" /> Atendentes Cadastrados nesta Sessão
                            </CardTitle>
                            <CardDescription>
                                Atendentes que têm acesso a este número e suas respectivas etiquetas de atendimento.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="px-2.5 py-1 text-xs font-semibold">
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
                                <Button onClick={() => setIsCreateOpen(true)} size="sm" className="mt-4 gap-1.5 cursor-pointer">
                                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar Primeiro Atendente
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {attendants.map(att => {
                                    const isMasterOwner = att.isOwner || att.email === "lucasmeloil@pm.me";
                                    return (
                                        <div key={att.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                                                    {(att.name || att.email).slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm text-foreground truncate">{att.name || "Sem nome"}</span>
                                                        <Badge variant={isMasterOwner ? "default" : att.role === "SUPERADMIN" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 font-semibold">
                                                            {isMasterOwner ? "MASTER ADMIN" : att.role === "STAFF" ? "Atendente" : att.role}
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
                                                    className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer hover:border-primary/50"
                                                    title="Editar dados e setores deste atendente"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" /> Editar Setores / Senha
                                                </Button>

                                                {isMasterOwner ? (
                                                    <span 
                                                        className="h-8 px-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 rounded-md border border-slate-200"
                                                        title="O proprietário master da sessão não pode ser removido"
                                                    >
                                                        <Shield className="h-3 w-3 text-slate-400" /> Master
                                                    </span>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setRevokeTarget(att);
                                                            setDeletePermanently(true);
                                                        }}
                                                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                                                        title="Excluir ou revogar acesso deste atendente"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
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
                                placeholder="Ex: Carlos Eduardo"
                                value={createName}
                                onChange={e => setCreateName(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">E-mail Corporativo</Label>
                            <Input
                                type="email"
                                placeholder="atendente@empresa.com"
                                value={createEmail}
                                onChange={e => setCreateEmail(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
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
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Função / Cargo</Label>
                                <Select value={createRole} onValueChange={setCreateRole}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="STAFF">Atendente (Operador)</SelectItem>
                                        <SelectItem value="OWNER">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                                                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
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
                            <div className="flex gap-2 pt-1">
                                <Input
                                    placeholder="Nova etiqueta / setor..."
                                    value={customTagInput}
                                    onChange={e => setCustomTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                                    className="h-8 text-xs"
                                />
                                <Button type="button" variant="outline" size="sm" onClick={addCustomTag} className="h-8 px-2.5 text-xs gap-1 cursor-pointer">
                                    <Plus className="h-3.5 w-3.5" /> Adicionar
                                </Button>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={submittingCreate} className="gap-1.5 cursor-pointer">
                                {submittingCreate ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cadastrando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-3.5 w-3.5" /> Concluir Cadastro
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
                            <Edit2 className="h-5 w-5" /> Editar Atendente & Setores
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Atualize os dados cadastrais, e-mail, senha de acesso e setores de atendimento de <strong>{editingAttendant?.name || editingAttendant?.email}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditAttendant} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Nome Completo</Label>
                            <Input
                                placeholder="Nome do atendente"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">E-mail de Login</Label>
                            <Input
                                type="email"
                                placeholder="email@empresa.com"
                                value={editEmail}
                                onChange={e => setEditEmail(e.target.value)}
                                className="h-9 text-xs"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Nova Senha</Label>
                                <Input
                                    type="password"
                                    placeholder="Em branco p/ manter atual"
                                    value={editPassword}
                                    onChange={e => setEditPassword(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Função / Cargo</Label>
                                <Select value={editRole} onValueChange={setEditRole} disabled={editingAttendant?.isOwner}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="STAFF">Atendente (Operador)</SelectItem>
                                        <SelectItem value="OWNER">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Setores / Tags */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold flex items-center justify-between">
                                <span>Tags / Setores Permitidos</span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                    {editTags.length} selecionada{editTags.length !== 1 ? "s" : ""}
                                </span>
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                Marque os setores que este atendente terá permissão para visualizar na fila.
                            </p>

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
                                                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
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
                            <Button type="submit" size="sm" disabled={submittingEdit} className="gap-1.5 cursor-pointer">
                                {submittingEdit ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
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

            {/* Confirm Delete / Revoke Dialog */}
            <AlertDialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" /> Excluir ou Revogar Atendente
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-xs text-muted-foreground pt-1">
                                <p>
                                    Você está prestes a remover o atendente <strong>{revokeTarget?.name || revokeTarget?.email}</strong> ({revokeTarget?.email}).
                                </p>

                                <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2">
                                    <label className="flex items-start gap-2.5 cursor-pointer text-foreground font-medium">
                                        <input
                                            type="checkbox"
                                            checked={deletePermanently}
                                            onChange={e => setDeletePermanently(e.target.checked)}
                                            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-semibold block">Excluir usuário definitivamente do sistema</span>
                                            <span className="text-[11px] text-muted-foreground block font-normal">
                                                Remove o login, senha e todos os vínculos permanentemente. Se desmarcado, apenas revoga o acesso a esta sessão.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submittingRevoke}>Cancelar</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={confirmRevoke}
                            disabled={submittingRevoke}
                            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                        >
                            {submittingRevoke ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo...
                                </>
                            ) : deletePermanently ? (
                                "Excluir Definitivamente"
                            ) : (
                                "Revogar Apenas Desta Sessão"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
