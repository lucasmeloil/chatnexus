"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { io, Socket } from "socket.io-client";
import { 
    Phone, 
    PhoneOff, 
    Mic, 
    MicOff, 
    Volume2, 
    VolumeX, 
    ShieldCheck, 
    Activity, 
    CheckCircle2, 
    AlertCircle,
    User,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ]
};

export default function ClientCallPage({ params }: { params: Promise<{ roomId: string }> }) {
    const resolvedParams = use(params);
    const roomId = resolvedParams.roomId;

    const [status, setStatus] = useState<"incoming" | "connecting" | "connected" | "ended">("incoming");
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [peerName, setPeerName] = useState<string>("Atendente Nexus");

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
                    handleEndCall("Conexão encerrada pelo atendente");
                }
            };

            // Socket connection events
            socket.on("connect", () => {
                socket.emit("call:join", { roomId, role: "client", name: "Cliente" });
            });

            socket.on("call:peer-joined", async (data: { role: string; name?: string }) => {
                if (data.name) setPeerName(data.name);
                // As client, if agent is already in or joined, create offer
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

            socket.on("call:ended", () => {
                handleEndCall("Chamada encerrada pelo atendente");
            });

            socket.on("call:peer-left", () => {
                handleEndCall("Atendente desconectou da chamada");
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

    const handleEndCall = (reason = "Chamada finalizada") => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.emit("call:end", { roomId, reason });
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setStatus("ended");
    };

    return (
        <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between items-center p-6 relative overflow-hidden select-none">
            {/* Ambient Background Lights */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Hidden audio element for remote stream */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* Top Brand Header */}
            <header className="w-full max-w-md flex items-center justify-between z-10 pt-2">
                <div className="flex items-center gap-2">
                    <img 
                        src="/nexus-chat-logo-white.png" 
                        alt="NEXUS CHAT" 
                        className="h-8 w-auto object-contain drop-shadow" 
                    />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Conexão Segura</span>
                </div>
            </header>

            {/* Center Content */}
            <main className="w-full max-w-sm flex flex-col items-center justify-center my-auto z-10 text-center space-y-6">
                {/* Caller Avatar */}
                <div className="relative">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 p-1 flex items-center justify-center shadow-2xl relative">
                        {status === "connected" && (
                            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
                        )}
                        {status === "connecting" && (
                            <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-pulse opacity-75" />
                        )}
                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-extrabold text-blue-400 border border-white/10">
                            {peerName ? peerName[0]?.toUpperCase() : "A"}
                        </div>
                    </div>

                    {status === "connected" && (
                        <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-lg border-2 border-slate-950">
                            <Activity className="h-4 w-4 animate-pulse" />
                        </div>
                    )}
                </div>

                {/* Title & Status */}
                <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                        {peerName}
                    </h2>
                    
                    {status === "incoming" && (
                        <p className="text-sm text-slate-400 animate-pulse">
                            Chamando você para ligação de voz...
                        </p>
                    )}

                    {status === "connecting" && (
                        <p className="text-sm text-blue-400 flex items-center justify-center gap-1.5 font-medium">
                            <Sparkles className="h-4 w-4 animate-spin" /> Conectando áudio criptografado...
                        </p>
                    )}

                    {status === "connected" && (
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold tracking-wider">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                {formatTimer(callDuration)}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Áudio ativo em alta fidelidade
                            </p>
                        </div>
                    )}

                    {status === "ended" && (
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-white/10 text-xs font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Chamada Encerrada ({formatTimer(callDuration)})
                            </div>
                            <p className="text-xs text-slate-400">
                                Obrigado pelo contato. Você já pode fechar esta aba.
                            </p>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 text-left animate-in fade-in">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                        <span>{errorMsg}</span>
                    </div>
                )}
            </main>

            {/* Bottom Call Controls */}
            <footer className="w-full max-w-sm flex flex-col items-center z-10 pb-4">
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
                    <div className="w-full flex items-center justify-center gap-5">
                        {/* Mute Button */}
                        <Button
                            onClick={toggleMute}
                            size="icon"
                            variant="secondary"
                            className={`h-14 w-14 rounded-full border border-white/10 shadow-lg cursor-pointer transition-all ${
                                isMuted 
                                    ? "bg-amber-500 text-white hover:bg-amber-600" 
                                    : "bg-white/15 text-white hover:bg-white/25"
                            }`}
                            title={isMuted ? "Ativar Microfone" : "Silenciar Microfone"}
                        >
                            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                        </Button>

                        {/* End Call Button */}
                        <Button
                            onClick={() => handleEndCall("Você encerrou a chamada")}
                            size="icon"
                            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                            title="Encerrar Chamada"
                        >
                            <PhoneOff className="h-7 w-7" />
                        </Button>
                    </div>
                )}

                {status === "ended" && (
                    <Button
                        onClick={() => window.close()}
                        variant="outline"
                        className="rounded-xl border-white/20 text-white hover:bg-white/10 cursor-pointer text-xs"
                    >
                        Fechar Janela
                    </Button>
                )}

                <div className="mt-6 text-center">
                    <p className="text-[10px] text-slate-500">
                        NEXUS SOFT TECH • Tecnologia de Atendimento Inteligente
                    </p>
                </div>
            </footer>
        </div>
    );
}

