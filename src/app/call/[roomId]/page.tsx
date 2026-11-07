"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { io, Socket } from "socket.io-client";
import { 
    Phone, 
    PhoneOff, 
    Mic, 
    MicOff, 
    ShieldCheck, 
    Activity, 
    CheckCircle2, 
    AlertCircle,
    User,
    Sparkles,
    Star,
    Send,
    Heart,
    Check,
    MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ]
};

const RATING_LABELS: Record<number, string> = {
    0: "Toque nas estrelas para avaliar",
    1: "1 estrela • Muito insatisfeito 😞",
    2: "2 estrelas • Insatisfeito 🙁",
    3: "3 estrelas • Regular 😐",
    4: "4 estrelas • Bom atendimento 😊",
    5: "5 estrelas • Excelente atendimento! ⭐"
};

export default function ClientCallPage({ params }: { params: Promise<{ roomId: string }> }) {
    const resolvedParams = use(params);
    const roomId = resolvedParams.roomId;

    const [status, setStatus] = useState<"incoming" | "connecting" | "connected" | "ended">("incoming");
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [peerName, setPeerName] = useState<string>("Atendente Nexus");
    const [endedBy, setEndedBy] = useState<"agent" | "client" | null>(null);
    const [endReason, setEndReason] = useState<string>("Chamada finalizada");

    // Feedback States (Start with 0 - empty stars until client clicks)
    const [rating, setRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [windowClosedPrompt, setWindowClosedPrompt] = useState(false);

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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (peerRef.current) {
                peerRef.current.close();
            }
            if (socketRef.current) {
                socketRef.current.emit("call:end", { roomId });
                socketRef.current.disconnect();
            }
        };
    }, [roomId]);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const handleAnswer = async () => {
        setStatus("connecting");
        setErrorMsg(null);

        try {
            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }, 
                video: false 
            });
            localStreamRef.current = stream;

            // Initialize Socket
            const socket = io({ path: "/api/socket/io" });
            socketRef.current = socket;

            const peer = new RTCPeerConnection(ICE_SERVERS);
            peerRef.current = peer;

            // Add local tracks to peer
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));

            // Remote audio stream received
            peer.ontrack = (event) => {
                if (remoteAudioRef.current && event.streams[0]) {
                    remoteAudioRef.current.srcObject = event.streams[0];
                    remoteAudioRef.current.play().catch(() => {});
                }
            };

            // Send ICE candidates to other peer
            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("call:signal", {
                        roomId,
                        signal: { type: "candidate", candidate: event.candidate }
                    });
                }
            };

            // Peer connection state change
            peer.onconnectionstatechange = () => {
                if (peer.connectionState === "connected") {
                    setStatus("connected");
                } else if (peer.connectionState === "disconnected" || peer.connectionState === "failed") {
                    handleEndCall("Conexão encerrada pelo atendente", "agent", false);
                }
            };

            // Socket connection events
            socket.on("connect", () => {
                socket.emit("call:join", { roomId, role: "client", name: "Cliente" });
            });

            socket.on("call:peer-joined", async (data: { role: string; name?: string }) => {
                if (data.name) setPeerName(data.name);
                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit("call:signal", { roomId, signal: offer });
                } catch (e) {
                    console.error("Erro ao criar oferta:", e);
                }
            });

            socket.on("call:signal", async (data: { signal: any }) => {
                const { signal } = data;
                if (!signal) return;

                try {
                    if (signal.type === "offer") {
                        await peer.setRemoteDescription(new RTCSessionDescription(signal));
                        const answer = await peer.createAnswer();
                        await peer.setLocalDescription(answer);
                        socket.emit("call:signal", { roomId, signal: answer });
                        setStatus("connected");
                    } else if (signal.type === "answer") {
                        await peer.setRemoteDescription(new RTCSessionDescription(signal));
                        setStatus("connected");
                    } else if (signal.candidate) {
                        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    }
                } catch (err) {
                    console.error("Erro ao processar sinal:", err);
                }
            });

            socket.on("call:ended", (data?: { by?: "agent" | "client"; reason?: string }) => {
                const by = data?.by === "agent" ? "agent" : "client";
                const reason = data?.reason || "Atendimento finalizado pelo atendente";
                handleEndCall(reason, by, false);
            });

            socket.on("call:peer-left", () => {
                handleEndCall("Atendimento finalizado pelo atendente", "agent", false);
            });

        } catch (err: any) {
            console.error("Falha ao acessar microfone:", err);
            setErrorMsg("Permissão de microfone negada ou não disponível. Por favor, autorize o microfone para atender.");
            setStatus("incoming");
        }
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

    const handleEndCall = (reason = "Chamada finalizada", by: "agent" | "client" = "client", emitSocket = true) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (socketRef.current) {
            if (emitSocket) {
                socketRef.current.emit("call:end", { roomId, reason, by });
            }
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setEndedBy(by);
        setEndReason(reason);
        setStatus("ended");
    };

    // Close window helper with cross-browser and mobile fallbacks
    const handleCloseWindow = () => {
        setWindowClosedPrompt(true);

        // Try direct window.close
        try {
            window.close();
        } catch {}

        // Try window.open self replacement trick
        try {
            window.open('', '_self', '');
            window.close();
        } catch {}

        // Fallback for browsers that block script closing (e.g. opened from WhatsApp link)
        setTimeout(() => {
            if (!window.closed) {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = "about:blank";
                }
            }
        }, 350);
    };

    // Submit rating and feedback
    const handleSubmitFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingFeedback) return;
        setSubmittingFeedback(true);

        try {
            await fetch("/api/call/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomId,
                    rating,
                    comment: comment.trim() || undefined,
                    contactName: "Cliente"
                })
            });
            setFeedbackSubmitted(true);
        } catch (e) {
            console.error("Erro ao enviar avaliação:", e);
            setFeedbackSubmitted(true);
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const activeRatingDisplay = hoverRating !== null ? hoverRating : rating;

    return (
        <div className="min-h-[100dvh] w-full bg-slate-950 text-white flex flex-col justify-between items-center p-3 sm:p-6 relative overflow-y-auto select-none">
            {/* Ambient Background Lights */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Hidden audio element for remote stream */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* Top Brand Header */}
            <header className="w-full max-w-sm sm:max-w-md flex items-center justify-between z-10 pt-1 pb-2">
                <div className="flex items-center gap-2">
                    <img 
                        src="/nexus-chat-logo-white.png" 
                        alt="NEXUS CHAT" 
                        className="h-6 sm:h-8 w-auto object-contain drop-shadow" 
                    />
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] sm:text-xs font-semibold text-emerald-400 shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Conexão Segura</span>
                </div>
            </header>

            {/* Center Content */}
            <main className="w-full max-w-sm flex flex-col items-center justify-center my-auto z-10 text-center space-y-3 sm:space-y-4 py-1">
                
                {/* End of Call Alert Banner */}
                {status === "ended" && (
                    <div className={`w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-500 text-left ${
                        endedBy === "agent" 
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-100" 
                            : "bg-slate-800/80 border-white/15 text-slate-200"
                    }`}>
                        <div className="flex items-start gap-2.5 sm:gap-3">
                            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${
                                endedBy === "agent" ? "bg-emerald-500/25 text-emerald-400" : "bg-white/10 text-slate-300"
                            }`}>
                                {endedBy === "agent" ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />}
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white">
                                    {endedBy === "agent" ? "Atendimento Finalizado pelo Atendente" : "Chamada Finalizada por Você"}
                                </h3>
                                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                                    {endedBy === "agent" 
                                        ? `O atendente ${peerName} encerrou esta ligação de voz.`
                                        : "Esta chamada de voz foi encerrada por você."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Caller Avatar & Waveform Animation */}
                <div className="relative flex items-center justify-center">
                    {/* Pulsing Audio Waves when Connected */}
                    {status === "connected" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-emerald-500/30 animate-ping opacity-60" />
                            <span className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-teal-500/20 animate-pulse opacity-40" />
                        </div>
                    )}

                    <div className={`rounded-full p-1 flex items-center justify-center shadow-2xl relative transition-all duration-300 ${
                        status === "ended"
                            ? "w-14 h-14 sm:w-20 sm:h-20 " + (endedBy === "agent" ? "bg-gradient-to-br from-emerald-500 to-teal-700" : "bg-gradient-to-br from-slate-700 to-slate-800")
                            : status === "connected"
                                ? "w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-600"
                                : "w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-blue-600 to-indigo-700"
                    }`}>
                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center font-extrabold text-blue-400 border border-white/10 overflow-hidden">
                            {status === "ended" ? (
                                endedBy === "agent" ? (
                                    <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400 animate-in zoom-in-75 duration-300" />
                                ) : (
                                    <PhoneOff className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                                )
                            ) : (
                                <User className="h-9 w-9 sm:h-12 sm:w-12 text-blue-300" />
                            )}
                        </div>

                        {status === "connected" && (
                            <div className="absolute -bottom-1 -right-1 p-1.5 sm:p-2 rounded-full bg-emerald-500 text-white shadow-lg border-2 border-slate-950">
                                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Title & Status */}
                <div className="space-y-1 w-full">
                    <h2 className="text-base sm:text-xl font-bold tracking-tight text-white">
                        {status === "ended" ? (endedBy === "agent" ? "Atendimento Concluído" : "Ligação Encerrada") : peerName}
                    </h2>
                    
                    {status === "incoming" && (
                        <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-slate-300 animate-pulse">
                                Chamando você para ligação de voz...
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-slate-500">
                                Áudio HD criptografado direto no navegador
                            </p>
                        </div>
                    )}

                    {status === "connecting" && (
                        <p className="text-xs sm:text-sm text-blue-400 flex items-center justify-center gap-1.5 font-medium">
                            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> Conectando áudio criptografado...
                        </p>
                    )}

                    {status === "connected" && (
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold tracking-wider shadow-inner">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                {formatTimer(callDuration)}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                <span>Qualidade de Áudio HD (Opus)</span>
                            </div>
                        </div>
                    )}

                    {status === "ended" && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/15 text-[11px] sm:text-xs font-semibold text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span>Duração: <strong className="text-white font-mono">{formatTimer(callDuration)}</strong></span>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="p-2.5 sm:p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 text-left animate-in fade-in">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* 5-STAR RATING & FEEDBACK AREA (When Call Ends) */}
                {status === "ended" && (
                    <div className="w-full rounded-xl sm:rounded-2xl bg-slate-900/90 border border-white/10 p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500 text-left">
                        {!feedbackSubmitted ? (
                            <form onSubmit={handleSubmitFeedback} className="space-y-3">
                                <div className="text-center space-y-0.5">
                                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-1.5">
                                        <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 fill-amber-400" />
                                        Como foi o seu atendimento?
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400">
                                        Avalie com estrelas a qualidade do suporte recebido
                                    </p>
                                </div>

                                {/* Star Rating Buttons */}
                                <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                        {[1, 2, 3, 4, 5].map((starValue) => {
                                            const isFilled = activeRatingDisplay > 0 && starValue <= activeRatingDisplay;
                                            return (
                                                <button
                                                    key={starValue}
                                                    type="button"
                                                    onClick={() => setRating(starValue)}
                                                    onMouseEnter={() => setHoverRating(starValue)}
                                                    onMouseLeave={() => setHoverRating(null)}
                                                    className="p-1 rounded-lg transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                                                    title={`Nota ${starValue}`}
                                                >
                                                    <Star 
                                                        className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors duration-200 ${
                                                            isFilled 
                                                                ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" 
                                                                : "text-slate-600 hover:text-amber-400/60"
                                                        }`} 
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <span className={`text-[11px] sm:text-xs font-semibold transition-all ${
                                        activeRatingDisplay > 0 ? "text-amber-400" : "text-slate-400"
                                    }`}>
                                        {RATING_LABELS[activeRatingDisplay]}
                                    </span>
                                </div>

                                {/* Optional Feedback Textarea */}
                                <div className="space-y-1">
                                    <label className="text-[10px] sm:text-[11px] font-medium text-slate-400 flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        <span>Mensagem ou sugestão (opcional):</span>
                                    </label>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Conte brevemente o que achou..."
                                        maxLength={300}
                                        rows={2}
                                        className="w-full text-xs rounded-xl bg-slate-950/70 border border-white/10 p-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50 resize-none transition-all"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submittingFeedback || rating === 0}
                                    className={`w-full h-9 sm:h-10 rounded-xl font-bold text-xs gap-2 shadow-lg transition-all ${
                                        rating === 0
                                            ? "bg-slate-800 text-slate-400 border border-white/5 opacity-60 cursor-not-allowed"
                                            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-amber-500/20 cursor-pointer hover:scale-[1.01] active:scale-98"
                                    }`}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    <span>
                                        {submittingFeedback 
                                            ? "Enviando..." 
                                            : rating === 0 
                                                ? "Escolha as estrelas acima" 
                                                : "Enviar Avaliação"}
                                    </span>
                                </Button>
                            </form>
                        ) : (
                            <div className="py-2 text-center space-y-1.5 animate-in fade-in zoom-in-95">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                                    <Heart className="h-5 w-5 fill-emerald-400/30" />
                                </div>
                                <h4 className="text-xs sm:text-sm font-bold text-white">
                                    Muito obrigado pelo seu feedback!
                                </h4>
                                <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                                    Sua nota de <strong className="text-amber-400">{rating} estrelas</strong> foi registrada na conversa e no atendimento.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Call Controls */}
            <footer className="w-full max-w-sm flex flex-col items-center z-10 pb-2">
                {status === "incoming" && (
                    <div className="w-full flex items-center justify-center gap-6">
                        <Button
                            onClick={handleAnswer}
                            size="lg"
                            className="h-16 px-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base gap-3 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-bounce"
                        >
                            <Phone className="h-6 w-6" />
                            <span>Atender Chamada</span>
                        </Button>
                    </div>
                )}

                {status === "connected" && (
                    <div className="w-full flex items-center justify-center gap-6">
                        {/* Mute Button with Dynamic Status */}
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                onClick={toggleMute}
                                size="icon"
                                variant="secondary"
                                className={`h-14 w-14 rounded-full border shadow-lg cursor-pointer transition-all ${
                                    isMuted 
                                        ? "bg-amber-500 text-white border-amber-400 hover:bg-amber-600 shadow-amber-500/30" 
                                        : "bg-white/15 text-white border-white/20 hover:bg-white/25"
                                }`}
                                title={isMuted ? "Desmutar microfone" : "Silenciar microfone"}
                            >
                                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                            </Button>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {isMuted ? "Mutado" : "Microfone"}
                            </span>
                        </div>

                        {/* End Call Button */}
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                onClick={() => handleEndCall("Você encerrou a chamada", "client")}
                                size="icon"
                                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                title="Encerrar Chamada"
                            >
                                <PhoneOff className="h-7 w-7" />
                            </Button>
                            <span className="text-[10px] text-red-400 font-semibold">
                                Desligar
                            </span>
                        </div>
                    </div>
                )}

                {status === "ended" && (
                    <div className="w-full space-y-2 text-center pt-2">
                        <Button
                            onClick={handleCloseWindow}
                            size="lg"
                            className="w-full h-12 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold cursor-pointer text-sm gap-2 shadow-lg hover:scale-[1.02] active:scale-98 transition-all"
                        >
                            <Check className="h-4 w-4 text-emerald-400" />
                            <span>Fechar Janela</span>
                        </Button>

                        {windowClosedPrompt && (
                            <p className="text-[11px] text-slate-400 animate-in fade-in">
                                Chamada finalizada com segurança. Você já pode fechar esta aba no seu navegador.
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-4 text-center">
                    <p className="text-[10px] text-slate-500">
                        NEXUS SOFT TECH • Tecnologia de Atendimento Inteligente
                    </p>
                </div>
            </footer>
        </div>
    );
}
