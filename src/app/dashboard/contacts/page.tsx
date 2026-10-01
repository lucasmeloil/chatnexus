"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/dashboard/session-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from "@/components/ui/pagination";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Search, Loader2, User, UserPlus, MessageSquare, Tag, FileText, CheckCircle2, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { toast } from "sonner";

interface ContactLabel {
    id: string;
    name: string;
    colorHex: string;
}

interface Contact {
    id: string;
    jid: string;
    name?: string;
    notify?: string;
    verifiedName?: string;
    profilePic?: string;
    remoteJidAlt?: string;
    notes?: string | null;
    tag?: string | null;
    labels?: ContactLabel[];
}

export default function ContactListPage() {
    const { sessionId } = useSession();
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState("10");
    const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

    // Create contact modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [newTag, setNewTag] = useState("");

    // Edit contact modal state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editTag, setEditTag] = useState("");
    const [updating, setUpdating] = useState(false);
    const [availableLabels, setAvailableLabels] = useState<ContactLabel[]>([]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchContacts();
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch on page/session/limit change
    useEffect(() => {
        fetchContacts();
        fetchLabels();
    }, [page, sessionId, limit]);

    const fetchLabels = async () => {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/labels/${sessionId}`);
            const data = await res.json();
            if (res.ok && data?.data?.labels) {
                setAvailableLabels(data.data.labels);
            }
        } catch (e) {
            console.error("Error fetching labels:", e);
        }
    };

    const fetchContacts = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit,
                search: search
            });

            const res = await fetch(`/api/contacts/${sessionId}?${params}`);
            const data = await res.json();

            if (res.ok) {
                setContacts(data.data || []);
                setMeta(data.meta || { total: 0, totalPages: 1 });
            } else {
                setContacts([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPhone.trim()) {
            toast.error("Por favor informe o número de telefone.");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch(`/api/contacts/${sessionId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName.trim(),
                    phone: newPhone.trim(),
                    notes: newNotes.trim(),
                    tag: newTag.trim()
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Contato cadastrado com sucesso!");
                setIsCreateOpen(false);
                setNewName("");
                setNewPhone("");
                setNewNotes("");
                setNewTag("");
                fetchContacts();
                fetchLabels();
            } else {
                toast.error(data.message || "Erro ao cadastrar contato");
            }
        } catch (error: any) {
            toast.error(error.message || "Falha na comunicação com o servidor");
        } finally {
            setCreating(false);
        }
    };

    const handleOpenEdit = (contact: Contact) => {
        setEditingContact(contact);
        setEditName(contact.name || contact.notify || "");
        setEditPhone(contact.jid.replace("@s.whatsapp.net", "").replace("@g.us", ""));
        setEditNotes(contact.notes || "");
        const currentTag = contact.tag || (contact.labels && contact.labels.length > 0 ? contact.labels[0].name : "");
        setEditTag(currentTag);
        setIsEditOpen(true);
    };

    const handleUpdateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingContact) return;

        setUpdating(true);
        try {
            const res = await fetch(`/api/contacts/${sessionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingContact.id,
                    jid: editingContact.jid,
                    name: editName.trim(),
                    notes: editNotes.trim(),
                    tag: editTag.trim()
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Contato e tag de direcionamento atualizados com sucesso!");
                setIsEditOpen(false);
                setEditingContact(null);
                fetchContacts();
                fetchLabels();
            } else {
                toast.error(data.message || "Erro ao atualizar contato");
            }
        } catch (error: any) {
            toast.error(error.message || "Falha na comunicação com o servidor");
        } finally {
            setUpdating(false);
        }
    };

    const openChatWith = (jid: string) => {
        router.push(`/dashboard/chat?session=${sessionId}&jid=${encodeURIComponent(jid)}`);
    };

    return (
        <SessionGuard>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Contatos</h2>
                        <p className="text-muted-foreground text-sm">
                            Gerencie sua agenda de clientes, adicione notas e tags para direcionamento.
                        </p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-sm font-medium">
                                <UserPlus className="h-4 w-4" />
                                Criar Contato
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                            <form onSubmit={handleCreateContact}>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <UserPlus className="h-5 w-5 text-primary" />
                                        Novo Contato
                                    </DialogTitle>
                                    <DialogDescription>
                                        Preencha as informações do contato. O número será formatado para o padrão brasileiro (+55).
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="contact-name">Nome do Contato</Label>
                                        <Input
                                            id="contact-name"
                                            placeholder="Ex: Lucas Melo"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="contact-phone">
                                            Número de Telefone <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="contact-phone"
                                            placeholder="Ex: (11) 98765-4321 ou 11987654321"
                                            value={newPhone}
                                            onChange={e => setNewPhone(e.target.value)}
                                            required
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            O código +55 (Brasil) será inserido automaticamente para números com DDD.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="contact-tag">Tag de Direcionamento / Etiqueta</Label>
                                        {availableLabels.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                <span className="text-[11px] text-muted-foreground w-full font-medium">Tags disponíveis na sessão:</span>
                                                {availableLabels.map((lbl) => (
                                                    <button
                                                        key={lbl.id}
                                                        type="button"
                                                        onClick={() => setNewTag(lbl.name)}
                                                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                                            newTag.toLowerCase() === lbl.name.toLowerCase()
                                                                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                                                : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/60"
                                                        }`}
                                                    >
                                                        #{lbl.name}
                                                    </button>
                                                ))}
                                                {newTag && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewTag("")}
                                                        className="text-[11px] px-2 py-1 text-destructive hover:bg-destructive/10 rounded-full"
                                                    >
                                                        Limpar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <Input
                                            id="contact-tag"
                                            placeholder="Ex: Vendas, Suporte, VIP, Atendimento"
                                            value={newTag}
                                            onChange={e => setNewTag(e.target.value)}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Esta tag categoriza e direciona o contato no sistema e no chat.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="contact-notes">Observações</Label>
                                        <Textarea
                                            id="contact-notes"
                                            placeholder="Ex: Cliente interessado no plano corporativo. Entrar em contato após às 14h."
                                            className="resize-none min-h-[80px]"
                                            value={newNotes}
                                            onChange={e => setNewNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCreateOpen(false)}
                                        disabled={creating}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={creating}>
                                        {creating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            "Salvar Contato"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Modal de Edição de Contato */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent className="sm:max-w-[480px]">
                            <form onSubmit={handleUpdateContact}>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Pencil className="h-5 w-5 text-primary" />
                                        Editar Contato
                                    </DialogTitle>
                                    <DialogDescription>
                                        Atualize os dados e a etiqueta (tag) de direcionamento do cliente.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-contact-name">Nome do Contato</Label>
                                        <Input
                                            id="edit-contact-name"
                                            placeholder="Ex: Lucas Melo"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-contact-phone">Telefone / WhatsApp</Label>
                                        <Input
                                            id="edit-contact-phone"
                                            value={editPhone ? `+${editPhone}` : ""}
                                            disabled
                                            className="bg-muted font-mono text-xs"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            O número do contato é o identificador único no WhatsApp.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-contact-tag">Tag de Direcionamento / Etiqueta</Label>
                                        <div className="space-y-2">
                                            {availableLabels.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                    <span className="text-[11px] text-muted-foreground w-full font-medium">Tags disponíveis na sessão:</span>
                                                    {availableLabels.map((lbl) => (
                                                        <button
                                                            key={lbl.id}
                                                            type="button"
                                                            onClick={() => setEditTag(lbl.name)}
                                                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                                                editTag.toLowerCase() === lbl.name.toLowerCase()
                                                                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                                                    : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/60"
                                                            }`}
                                                        >
                                                            #{lbl.name}
                                                        </button>
                                                    ))}
                                                    {editTag && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditTag("")}
                                                            className="text-[11px] px-2 py-1 text-destructive hover:bg-destructive/10 rounded-full"
                                                        >
                                                            Limpar tag
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <Input
                                                id="edit-contact-tag"
                                                placeholder="Ou digite uma nova tag (Ex: Vendas, Suporte, VIP)"
                                                value={editTag}
                                                onChange={e => setEditTag(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                            Quando este contato enviar mensagens, o atendimento será automaticamente categorizado e direcionado por esta etiqueta.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-contact-notes">Observações</Label>
                                        <Textarea
                                            id="edit-contact-notes"
                                            placeholder="Observações internas sobre o cliente..."
                                            className="resize-none min-h-[80px]"
                                            value={editNotes}
                                            onChange={e => setEditNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsEditOpen(false)}
                                        disabled={updating}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={updating}>
                                        {updating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            "Salvar Alterações"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="space-y-1">
                                <CardTitle>Lista de Contatos</CardTitle>
                                <CardDescription>
                                    Total de {meta.total} contatos registrados
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Select value={limit} onValueChange={(val) => { setLimit(val); setPage(1); }}>
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Por pág." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 25, 50, 100].map((l) => (
                                            <SelectItem key={l} value={l.toString()}>
                                                {l} / página
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="all">Ver Todos</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nome ou número..."
                                        className="pl-8"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">Foto</TableHead>
                                        <TableHead>Nome / Contato</TableHead>
                                        <TableHead>Telefone / WhatsApp</TableHead>
                                        <TableHead className="hidden lg:table-cell">Observação</TableHead>
                                        <TableHead>Tag / Direcionamento</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-28 text-center">
                                                <div className="flex justify-center items-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Carregando contatos...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : contacts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                                                Nenhum contato encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        contacts.map((contact) => {
                                            const phoneClean = contact.jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
                                            const activeTag = contact.tag || (contact.labels && contact.labels.length > 0 ? contact.labels[0].name : null);
                                            const tagColor = contact.labels && contact.labels.length > 0 ? contact.labels[0].colorHex : null;

                                            return (
                                                <TableRow key={contact.id} className="hover:bg-muted/40 transition-colors">
                                                    <TableCell>
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={contact.profilePic || ""} />
                                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                                                {(contact.name || contact.notify || "C").charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm">
                                                                {contact.name || contact.notify || phoneClean}
                                                            </span>
                                                            {contact.verifiedName && (
                                                                <span className="text-[11px] text-green-600 flex items-center gap-0.5 font-medium">
                                                                    <CheckCircle2 className="h-3 w-3" /> {contact.verifiedName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        +{phoneClean}
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                                                        {contact.notes ? (
                                                            <span className="flex items-center gap-1.5" title={contact.notes}>
                                                                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                                                <span className="truncate">{contact.notes}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 italic">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {activeTag ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium shadow-xs"
                                                                style={{
                                                                    backgroundColor: tagColor ? `${tagColor}20` : "rgba(37, 211, 102, 0.15)",
                                                                    color: tagColor || "#10B981",
                                                                    border: `1px solid ${tagColor ? `${tagColor}40` : "rgba(37, 211, 102, 0.3)"}`
                                                                }}
                                                            >
                                                                <Tag className="h-3 w-3" />
                                                                {activeTag}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground/40 italic">Sem tag</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 gap-1 text-xs hover:bg-muted text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                                                                onClick={() => handleOpenEdit(contact)}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5 text-primary" />
                                                                Editar
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 gap-1.5 text-xs hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                                                                onClick={() => openChatWith(contact.jid)}
                                                            >
                                                                <MessageSquare className="h-3.5 w-3.5" />
                                                                Conversar
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {meta.totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    Página {page} de {meta.totalPages}
                                </span>
                                <Pagination className="justify-end">
                                    <PaginationContent className="gap-2">
                                        <PaginationItem>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page <= 1}
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                            >
                                                Anterior
                                            </Button>
                                        </PaginationItem>

                                        <PaginationItem>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page >= meta.totalPages}
                                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                            >
                                                Próxima
                                            </Button>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SessionGuard>
    );
}
