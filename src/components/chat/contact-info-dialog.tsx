"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Phone, 
    Copy, 
    Check, 
    ExternalLink, 
    Tag, 
    UserCheck, 
    Clock, 
    Lock, 
    CheckCircle2, 
    RotateCcw, 
    ArrowRightLeft, 
    ShieldCheck, 
    Share2,
    RefreshCw,
    Camera,
    Pencil,
    Save,
    UserPlus,
    X,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

interface ContactInfoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    jid: string;
    displayName: string;
    startInEditMode?: boolean;
    attendance?: {
        status?: "WAITING" | "IN_PROGRESS" | "CLOSED";
        assignedUserId?: string | null;
        assignedUserName?: string | null;
        departmentTag?: string | null;
    } | null;
    labels?: Array<{ id: string; name: string; colorHex: string }>;
    currentUserId?: string;
    isChatFinalized?: boolean;
    onAcceptAttendance?: () => void;
    onTransferAttendance?: () => void;
    onFinishAttendance?: () => void;
    onReopenAttendance?: () => void;
    onContactUpdated?: (newName: string, newPhotoUrl?: string) => void;
}

export function formatPhoneNumberDisplay(rawJid: string): string {
    const clean = rawJid.replace(/@.*$/, "").replace(/\D/g, "");
    if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
        const ddd = clean.slice(2, 4);
        const rest = clean.slice(4);
        if (rest.length === 9) {
            return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
        } else if (rest.length === 8) {
            return `+55 (${ddd}) 9${rest.slice(0, 4)}-${rest.slice(4)}`;
        }
    }
    if (clean.length > 7) {
        return `+${clean}`;
    }
    return rawJid;
}

export function ContactInfoDialog({
    isOpen,
    onClose,
    sessionId,
    jid,
    displayName: initialDisplayName,
    startInEditMode = false,
    attendance,
    labels = [],
    currentUserId,
    isChatFinalized,
    onAcceptAttendance,
    onTransferAttendance,
    onFinishAttendance,
    onReopenAttendance,
    onContactUpdated
}: ContactInfoDialogProps) {
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [loadingPic, setLoadingPic] = useState(false);
    const [uploadingPic, setUploadingPic] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Name and contact metadata editing state
    const [currentName, setCurrentName] = useState(initialDisplayName);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [notesInput, setNotesInput] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Canonical Brazilian JID
    const canonicalJid = formatToBrazilPhoneJid(jid) || jid;
    const cleanNumber = canonicalJid.replace(/@.*$/, "").replace(/\D/g, "");
    const formattedPhone = formatPhoneNumberDisplay(canonicalJid);
    const waLink = `https://wa.me/${cleanNumber}`;

    // Detect if contact has a custom name already saved
    const isContactSaved = Boolean(
        currentName && 
        currentName !== cleanNumber && 
        currentName !== jid && 
        currentName !== canonicalJid &&
        !currentName.replace(/\D/g, "").startsWith(cleanNumber)
    );

    // Sync initialDisplayName
    useEffect(() => {
        setCurrentName(initialDisplayName);
        setNameInput(initialDisplayName);
    }, [initialDisplayName]);

    // Load Profile Picture on open
    const loadProfilePicture = (showToast = false) => {
        if (!sessionId || !jid) return;
        setLoadingPic(true);

        fetch(`/api/chat/${sessionId}/${encodeURIComponent(jid)}/profile-picture`)
            .then(res => res.json())
            .then(data => {
                if (data?.profilePicUrl) {
                    setProfilePic(data.profilePicUrl);
                    if (showToast) toast.success("Foto do WhatsApp carregada com sucesso!");
                    onContactUpdated?.(currentName, data.profilePicUrl);
                } else if (showToast) {
                    toast.info("Este contato não possui foto pública no WhatsApp.");
                }
            })
            .catch(() => {
                if (showToast) toast.error("Não foi possível buscar a foto do WhatsApp.");
            })
            .finally(() => {
                setLoadingPic(false);
            });
    };

    useEffect(() => {
        if (!isOpen) return;
        loadProfilePicture(false);
        if (startInEditMode || !isContactSaved) {
            setIsEditingName(true);
            setNameInput(isContactSaved ? initialDisplayName : "");
        } else {
            setIsEditingName(false);
            setNameInput(initialDisplayName);
        }
    }, [isOpen, sessionId, jid, startInEditMode]);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        toast.success(`${label} copiado!`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Save Contact Name & Details
    const handleSaveContact = async () => {
        const trimmed = nameInput.trim();
        if (!trimmed) {
            toast.error("Informe um nome para o contato.");
            return;
        }

        setIsSavingName(true);
        try {
            const res = await fetch(`/api/contacts/${sessionId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: jid,
                    name: trimmed,
                    tag: tagInput.trim() || undefined,
                    notes: notesInput.trim() || undefined
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.status) {
                throw new Error(data?.message || "Erro ao salvar contato.");
            }

            setCurrentName(trimmed);
            setIsEditingName(false);
            toast.success("Contato salvo com sucesso!");
            onContactUpdated?.(trimmed, profilePic || undefined);

            // Dispatch global event so chat-list updates contact name instantly
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("nexus:contact-updated", {
                    detail: { jid, name: trimmed, profilePic: profilePic || undefined }
                }));
            }
        } catch (err: any) {
            console.error("Save contact error:", err);
            toast.error(err?.message || "Falha ao salvar contato.");
        } finally {
            setIsSavingName(false);
        }
    };

    // Upload custom photo
    const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Por favor, selecione um arquivo de imagem válido.");
            return;
        }

        setUploadingPic(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            toast.info("Enviando foto do contato...");
            const res = await fetch(`/api/chat/${sessionId}/${encodeURIComponent(jid)}/profile-picture`, {
                method: "POST",
                body: formData
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.status) {
                throw new Error(data?.message || "Falha ao salvar foto do contato.");
            }

            if (data.profilePicUrl) {
                setProfilePic(data.profilePicUrl);
                toast.success("Foto do contato atualizada com sucesso!");
                onContactUpdated?.(currentName, data.profilePicUrl);

                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("nexus:contact-updated", {
                        detail: { jid, profilePic: data.profilePicUrl }
                    }));
                }
            }
        } catch (err: any) {
            console.error("Upload contact photo error:", err);
            toast.error(err?.message || "Erro ao atualizar foto.");
        } finally {
            setUploadingPic(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <>
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleUploadPhoto} 
                className="hidden" 
            />

            <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
                <DialogContent className="max-w-md w-full p-0 overflow-hidden bg-background border shadow-2xl rounded-2xl">
                    {/* Header Banner */}
                    <div className="relative h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 flex items-end px-6 pb-0">
                        <div className="absolute top-3 right-3 flex items-center gap-1">
                            <Badge className="bg-black/30 backdrop-blur-md text-white/90 border-0 text-[10px] font-medium px-2 py-0.5">
                                WhatsApp Conectado
                            </Badge>
                        </div>
                    </div>

                    {/* Profile Avatar Card (Overlapping header) */}
                    <div className="px-6 pt-0 pb-6 -mt-12 space-y-4">
                        <div className="flex items-end justify-between">
                            <div className="relative group">
                                <div 
                                    className="cursor-pointer"
                                    onClick={() => profilePic && setIsImageModalOpen(true)}
                                    title={profilePic ? "Clique para ampliar foto" : undefined}
                                >
                                    <Avatar className="h-24 w-24 rounded-2xl border-4 border-background shadow-xl ring-2 ring-primary/20 bg-muted">
                                        {profilePic && <AvatarImage src={profilePic} alt={currentName} className="object-cover" />}
                                        <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary/20 via-blue-500/10 to-purple-500/20 text-primary">
                                            {currentName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {profilePic && (
                                        <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium pointer-events-none">
                                            Ver Foto
                                        </div>
                                    )}
                                </div>

                                {/* Floating Photo Action Buttons */}
                                <div className="absolute -bottom-1 -right-2 flex items-center gap-1 bg-background/95 backdrop-blur-md p-1 rounded-full border border-border shadow-md">
                                    <button
                                        type="button"
                                        onClick={() => loadProfilePicture(true)}
                                        disabled={loadingPic}
                                        title="Atualizar Foto do WhatsApp"
                                        className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${loadingPic ? "animate-spin text-primary" : ""}`} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingPic}
                                        title="Fazer Upload de Foto do Contato"
                                        className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-muted transition-colors cursor-pointer"
                                    >
                                        {uploadingPic ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                                        ) : (
                                            <Camera className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="mb-2">
                                {attendance?.status === "WAITING" && !isChatFinalized && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shadow-xs">
                                        <Clock className="h-3.5 w-3.5 animate-pulse" /> Em Espera
                                    </span>
                                )}
                                {attendance?.status === "IN_PROGRESS" && !isChatFinalized && (
                                    attendance.assignedUserId === currentUserId ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5 shadow-xs">
                                            <UserCheck className="h-3.5 w-3.5" /> Em Atendimento (Você)
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1.5 shadow-xs">
                                            <Lock className="h-3.5 w-3.5" /> Atendido por {attendance.assignedUserName || "Outro Atendente"}
                                        </span>
                                    )
                                )}
                                {isChatFinalized && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shadow-xs">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Finalizado
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Name & Save / Edit Contact Section */}
                        {isEditingName ? (
                            <div className="space-y-2.5 p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 animate-in fade-in">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-semibold uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                        {isContactSaved ? "Editar Nome do Contato" : "Cadastrar Novo Contato"}
                                    </label>
                                    {!isContactSaved && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            Não Salvo
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Input
                                        value={nameInput}
                                        onChange={e => setNameInput(e.target.value)}
                                        placeholder="Nome ou Empresa (ex: João Silva / RR Autos)"
                                        className="h-9 text-sm bg-background border-border/80"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSaveContact();
                                            }
                                            if (e.key === "Escape") setIsEditingName(false);
                                        }}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            value={tagInput}
                                            onChange={e => setTagInput(e.target.value)}
                                            placeholder="Setor / Tag (ex: Comercial)"
                                            className="h-8 text-xs bg-background border-border/80"
                                        />
                                        <Input
                                            value={notesInput}
                                            onChange={e => setNotesInput(e.target.value)}
                                            placeholder="Observação (opcional)"
                                            className="h-8 text-xs bg-background border-border/80"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setIsEditingName(false)}
                                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveContact}
                                        disabled={isSavingName || !nameInput.trim()}
                                        className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                                    >
                                        {isSavingName ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                        Salvar Contato
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h2 className="text-xl font-bold text-foreground tracking-tight truncate">{currentName}</h2>
                                        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" title="Contato WhatsApp Válido" />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setNameInput(isContactSaved ? currentName : "");
                                            setIsEditingName(true);
                                        }}
                                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        <span>{isContactSaved ? "Editar Nome" : "Salvar Nome"}</span>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                    <span>ID:</span>
                                    <span className="select-all">{canonicalJid}</span>
                                </p>
                            </div>
                        )}

                        {/* If contact is not saved yet, show prominent "Adicionar Contato" helper */}
                        {!isContactSaved && !isEditingName && (
                            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                        <UserPlus className="h-3.5 w-3.5 shrink-0" />
                                        Contato não cadastrado
                                    </p>
                                    <p className="text-[11px] text-muted-foreground leading-tight">
                                        Salve o nome ou empresa para facilitar o atendimento.
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setNameInput("");
                                        setIsEditingName(true);
                                    }}
                                    className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-medium cursor-pointer"
                                >
                                    Adicionar Contato
                                </Button>
                            </div>
                        )}

                        {/* Quick Contact Info Box */}
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-3">
                            {/* Phone with copy */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Número WhatsApp</p>
                                        <p className="text-sm font-semibold text-foreground font-mono">{formattedPhone}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border/80 hover:bg-background shrink-0"
                                    onClick={() => handleCopy(cleanNumber, "Número")}
                                >
                                    {copiedField === "Número" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span>{copiedField === "Número" ? "Copiado" : "Copiar"}</span>
                                </Button>
                            </div>

                            {/* Direct WhatsApp Web Link */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <Share2 className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Link Direto (wa.me)</p>
                                        <p className="text-xs text-muted-foreground truncate">{waLink}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2 text-xs rounded-lg"
                                        onClick={() => handleCopy(waLink, "Link WhatsApp")}
                                        title="Copiar link wa.me"
                                    >
                                        {copiedField === "Link WhatsApp" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs gap-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30"
                                        onClick={() => window.open(waLink, "_blank")}
                                        title="Abrir no WhatsApp Oficial"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>Abrir</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Labels / Setores */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <Tag className="h-3.5 w-3.5 text-primary" />
                                    <span>Etiquetas & Setores</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    {labels.length} {labels.length === 1 ? "etiqueta" : "etiquetas"}
                                </span>
                            </div>

                            {labels.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {labels.map(l => (
                                        <span 
                                            key={l.id} 
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-2xs"
                                            style={{ 
                                                backgroundColor: `${l.colorHex}15`, 
                                                color: l.colorHex, 
                                                borderColor: `${l.colorHex}35` 
                                            }}
                                        >
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.colorHex }} />
                                            {l.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic bg-muted/20 rounded-lg p-2 text-center border border-dashed border-border/60">
                                    Nenhuma etiqueta associada a este contato.
                                </p>
                            )}
                        </div>

                        {/* Attendance Actions */}
                        <div className="pt-2 border-t border-border/60 space-y-2">
                            <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Ações de Atendimento</p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                {attendance?.status === "WAITING" && !isChatFinalized && onAcceptAttendance && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => { onAcceptAttendance(); onClose(); }}
                                        className="col-span-2 h-9 text-xs font-semibold gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Aceitar Atendimento
                                    </Button>
                                )}

                                {!isChatFinalized && onTransferAttendance && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { onTransferAttendance(); onClose(); }}
                                        className="h-9 text-xs font-medium gap-1.5 rounded-xl border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                    >
                                        <ArrowRightLeft className="h-3.5 w-3.5" />
                                        Transferir
                                    </Button>
                                )}

                                {!isChatFinalized && onFinishAttendance && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { onFinishAttendance(); onClose(); }}
                                        className="h-9 text-xs font-medium gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Finalizar
                                    </Button>
                                )}

                                {isChatFinalized && onReopenAttendance && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { onReopenAttendance(); onClose(); }}
                                        className="col-span-2 h-9 text-xs font-semibold gap-1.5 rounded-xl border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Reabrir Atendimento
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Profile Picture Fullscreen Preview */}
            {profilePic && (
                <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
                    <DialogContent className="max-w-md w-auto p-2 bg-black/95 border-neutral-800 rounded-2xl flex flex-col items-center">
                        <img 
                            src={profilePic} 
                            alt={currentName} 
                            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-2xl" 
                        />
                        <div className="py-2 text-center">
                            <p className="text-white text-sm font-semibold">{currentName}</p>
                            <p className="text-neutral-400 text-xs">{formattedPhone}</p>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
