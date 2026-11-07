"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { 
    Phone, 
    PhoneOff, 
    Mic, 
    MicOff, 
    Activity, 
    Copy, 
    Check, 
    Loader2, 
    ExternalLink, 
    User,
    Sparkles,
    ShieldCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ]
};

interface CallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    jid: string;
    contactName: string;
    operatorName?: string;
}

export function CallDialog({
    open,
    onOpenChange,
    sessionId,
    jid,
    contactName,
    operatorName
}: CallDialogProps) {
    const [status, setStatus] = useState<"initiating" | "calling" | "connected" | "ended">("initiating");
    const [roomId, setRoomId] = useState<string | null>(null);
    const [callUrl, setCallUrl] = useState<string | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [copied, setCopied] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Call timer
    useEffect(() => {
        if (status === "connected") {
            timerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [status]);

    // Cleanup resources
    const cleanupCall = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (socketRef.current) {
            if (roomId) socketRef.current.emit("call:end", { roomId, reason: "Atendente finalizou" });
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    };

    // When dialog opens, create call room and invite client
    useEffect(() => {
        if (!open) {
            cleanupCall();
            setStatus("initiating");
            setCallDuration(0);
            setRoomId(null);
            setCallUrl(null);
            return;
        }

        let isCancelled = false;

        const startCall = async () => {
            setStatus("initiating");
            try {
                // 1. Get microphone access first
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });
                if (isCancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                localStreamRef.current = stream;

                // 2. Request backend to create call and send WhatsApp invitation
                const res = await fetch("/api/call/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId,
                        jid,
                        contactName,
                        operatorName
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.status) {
                    throw new Error(data.message || "Falha ao gerar link da chamada");
                }

                if (isCancelled) return;

                const generatedRoomId = data.data.roomId;
                const generatedCallUrl = data.data.callUrl;
                setRoomId(generatedRoomId);
                setCallUrl(generatedCallUrl);
                setStatus("calling");
                toast.success("Convite com link de chamada enviado no WhatsApp do cliente!");

                // 3. Connect Socket.IO
                const socket = io({ path: "/api/socket/io" });
                socketRef.current = socket;

                const peer = new RTCPeerConnection(ICE_SERVERS);
                peerRef.current = peer;

                // Add local audio tracks to peer
                stream.getTracks().forEach((track) => peer.addTrack(track, stream));

                // Incoming client audio track
                peer.ontrack = (event) => {
                    if (remoteAudioRef.current && event.streams[0]) {
                        remoteAudioRef.current.srcObject = event.streams[0];
                        remoteAudioRef.current.play().catch(() => {});
                    }
                };

                peer.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit("call:signal", {
                            roomId: generatedRoomId,
                            signal: { type: "candidate", candidate: event.candidate }
                        });
                    }
                };

                peer.onconnectionstatechange = () => {
                    if (peer.connectionState === "connected") {
                        setStatus("connected");
                    } else if (peer.connectionState === "disconnected" || peer.connectionState === "failed") {
                        setStatus("ended");
                    }
                };

                socket.on("connect", () => {
                    socket.emit("call:join", { 
                        roomId: generatedRoomId, 
                        role: "agent", 
                        name: operatorName || "Atendente" 
                    });
                });

                socket.on("call:peer-joined", async () => {
                    try {
                        const offer = await peer.createOffer();
                        await peer.setLocalDescription(offer);
                        socket.emit("call:signal", { roomId: generatedRoomId, signal: offer });
                    } catch (e) {
                        console.error("Erro ao criar oferta:", e);
                    }
                });

                socket.on("call:signal", async (payload: { signal: any }) => {
                    const { signal } = payload;
                    if (!signal) return;

                    try {
                        if (signal.type === "offer") {
                            await peer.setRemoteDescription(new RTCSessionDescription(signal));
                            const answer = await peer.createAnswer();
                            await peer.setLocalDescription(answer);
                            socket.emit("call:signal", { roomId: generatedRoomId, signal: answer });
                            setStatus("connected");
                        } else if (signal.type === "answer") {
                            await peer.setRemoteDescription(new RTCSessionDescription(signal));
                            setStatus("connected");
                        } else if (signal.candidate) {
                            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        }
                    } catch (e) {
                        console.error("Erro ao processar sinalização:", e);
                    }
                });

                socket.on("call:ended", () => {
                    setStatus("ended");
                    toast.info("Cliente encerrou a chamada");
                });

                socket.on("call:peer-left", () => {
                    setStatus("ended");
                    toast.info("Cliente desconectou");
                });

            } catch (err: any) {
                console.error("Erro ao iniciar chamada:", err);
                toast.error(err.message || "Permissão de microfone negada ou erro ao iniciar chamada");
                onOpenChange(false);
            }
        };

        startCall();

        return () => {
            isCancelled = true;
            cleanupCall();
        };
    }, [open, sessionId, jid, contactName, operatorName]);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const handleCopyLink = () => {
        if (!callUrl) return;
        navigator.clipboard.writeText(callUrl);
        setCopied(true);
        toast.success("Link da chamada copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleEndCall = () => {
        cleanupCall();
        setStatus("ended");
        setTimeout(() => {
            onOpenChange(false);
        }, 1200);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-6 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl">
                {/* Audio element for remote sound */}
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

                <DialogHeader className="text-center space-y-1">
                    <DialogTitle className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-500" />
                        Chamada de Voz em Tempo Real
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Ligação de áudio criptografada de ponta a ponta
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
                    {/* Animated Avatar */}
                    <div className="relative">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                            status === "connected"
                                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                : "bg-gradient-to-br from-primary to-blue-600 text-white"
                        }`}>
                            {status === "calling" && (
                                <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75" />
                            )}
                            {status === "connected" && (
                                <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-pulse opacity-75" />
                            )}
                            <User className="h-10 w-10" />
                        </div>
                    </div>

                    {/* Contact Details & Status */}
                    <div className="space-y-1">
                        <h3 className="font-bold text-base text-foreground">{contactName}</h3>
                        
                        {status === "initiating" && (
                            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                Gerando link seguro e acessando microfone...
                            </p>
                        )}

                        {status === "calling" && (
                            <div className="space-y-1">
                                <p className="text-xs text-primary font-semibold animate-pulse">
                                    Chamando cliente no WhatsApp...
                                </p>
                                <p className="text-[11px] text-muted-foreground max-w-xs">
                                    O convite foi enviado na conversa. A chamada iniciará assim que o cliente tocar no link.
                                </p>
                            </div>
                        )}

                        {status === "connected" && (
                            <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold tracking-wider">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {formatTimer(callDuration)}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Chamada em andamento com áudio ativo
                                </p>
                            </div>
                        )}

                        {status === "ended" && (
                            <p className="text-xs text-muted-foreground font-medium">
                                Chamada finalizada • Duração: {formatTimer(callDuration)}
                            </p>
                        )}
                    </div>

                    {/* Copy Link Option */}
                    {callUrl && status === "calling" && (
                        <div className="w-full p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground text-[11px] font-mono select-all">
                                {callUrl}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCopyLink}
                                className="h-7 px-2.5 text-xs gap-1 shrink-0 cursor-pointer"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                <span>{copied ? "Copiado" : "Copiar"}</span>
                            </Button>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4 pt-2">
                        {status === "connected" && (
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={toggleMute}
                                className={`h-12 w-12 rounded-full cursor-pointer transition-all ${
                                    isMuted 
                                        ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400" 
                                        : "hover:bg-muted"
                                }`}
                                title={isMuted ? "Desmutar microfone" : "Silenciar microfone"}
                            >
                                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </Button>
                        )}

                        <Button
                            type="button"
                            size="lg"
                            onClick={handleEndCall}
                            className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 shadow-lg shadow-red-600/30 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        >
                            <PhoneOff className="h-5 w-5" />
                            <span>{status === "connected" ? "Desligar" : "Cancelar Chamada"}</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

