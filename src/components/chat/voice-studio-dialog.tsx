"use client";

import { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Sliders, 
    Mic, 
    Square, 
    Play, 
    Pause, 
    RotateCcw, 
    Check, 
    Sparkles, 
    Radio, 
    Shield, 
    Volume2, 
    Headphones,
    Loader2,
    Wand2
} from "lucide-react";
import { toast } from "sonner";
import { VoiceProfile, VOICE_PROFILES, VoiceProfileConfig } from "@/lib/voice-profiles";

const PROFILE_ICONS: Record<VoiceProfile, any> = {
    broadcast: Mic,
    clarity: Sparkles,
    warm: Radio,
    denoise: Shield,
    natural: Volume2
};

interface VoiceStudioDialogProps {
    currentProfile: VoiceProfile;
    onSelectProfile: (profile: VoiceProfile) => void;
    triggerButton?: React.ReactNode;
}

export function VoiceStudioDialog({
    currentProfile,
    onSelectProfile,
    triggerButton
}: VoiceStudioDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<VoiceProfile>(currentProfile);

    // Test Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [rawTestBlob, setRawTestBlob] = useState<Blob | null>(null);
    const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        setSelectedProfile(currentProfile);
    }, [currentProfile]);

    // Clean up URLs and tracks on unmount / close
    useEffect(() => {
        if (!open) {
            cancelRecording();
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                setIsPlaying(false);
            }
        }
    }, [open]);

    const startTestRecording = async () => {
        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                toast.error("Microfone não suportado no navegador.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));

            mediaStreamRef.current = stream;

            let mimeType = "audio/webm;codecs=opus";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "audio/ogg;codecs=opus";
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = "";
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const recordedBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                setRawTestBlob(recordedBlob);
                await processPreview(recordedBlob, selectedProfile);
            };

            recorder.start(200);
            setIsRecording(true);
            setRecordingDuration(0);

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => {
                    if (prev >= 15) {
                        stopTestRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

            toast.info("Gravando teste... Fale normalmente por alguns segundos.");
        } catch (err: any) {
            console.error("Test mic access error:", err);
            toast.error("Não foi possível acessar o microfone para o teste.");
        }
    };

    const stopTestRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        setIsRecording(false);
    };

    const cancelRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setRecordingDuration(0);
    };

    const processPreview = async (blob: Blob, profileToProcess: VoiceProfile) => {
        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append("file", blob, "test_audio.webm");
            formData.append("profile", profileToProcess);

            const res = await fetch("/api/media/voice-preview", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                throw new Error("Falha ao processar prévia do áudio");
            }

            const processedBlob = await res.blob();
            if (processedAudioUrl) {
                URL.revokeObjectURL(processedAudioUrl);
            }
            const newUrl = URL.createObjectURL(processedBlob);
            setProcessedAudioUrl(newUrl);

            // Reset player
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current.src = newUrl;
                audioPlayerRef.current.load();
            }
            setIsPlaying(false);
            setPlaybackTime(0);
            toast.success("Áudio processado com sucesso! Clique em Play para ouvir.");
        } catch (err: any) {
            console.error("Preview processing error:", err);
            toast.error(err.message || "Erro ao processar filtro de voz");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProfileChange = (profile: VoiceProfile) => {
        setSelectedProfile(profile);
        // If there's an existing test recording, automatically re-process it with new profile!
        if (rawTestBlob) {
            processPreview(rawTestBlob, profile);
        }
    };

    const togglePlayback = () => {
        if (!audioPlayerRef.current || !processedAudioUrl) return;

        if (isPlaying) {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
        } else {
            audioPlayerRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                setIsPlaying(false);
            });
        }
    };

    const handleSave = () => {
        onSelectProfile(selectedProfile);
        try {
            localStorage.setItem("nexus_voice_profile", selectedProfile);
        } catch (e) {
            // ignore
        }
        toast.success(`Perfil ${VOICE_PROFILES[selectedProfile].name} ativado com sucesso!`);
        setOpen(false);
    };

    const formatSeconds = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="SteelSeries Sonar Voice Studio"
                    >
                        <Sliders className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl bg-background border border-border/60 shadow-2xl">
                {/* Header */}
                <div className="relative p-6 border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-background">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shadow-inner border border-primary/30">
                            <Headphones className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                                    Sonar Voice Studio
                                </DialogTitle>
                                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/20">
                                    DSP Engine
                                </Badge>
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Personalize o timbre, clareza e redução de ruído dos seus áudios com perfis de estúdio broadcast.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Profiles Grid */}
                <div className="p-6 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                Escolha o Perfil de Voz
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Perfil ativo: <strong className="text-primary">{VOICE_PROFILES[selectedProfile].name}</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(Object.keys(VOICE_PROFILES) as VoiceProfile[]).map((key) => {
                                const config = VOICE_PROFILES[key];
                                const Icon = PROFILE_ICONS[key];
                                const isSelected = selectedProfile === key;

                                return (
                                    <div
                                        key={key}
                                        onClick={() => handleProfileChange(key)}
                                        className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                                            isSelected
                                                ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/30"
                                                : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                                                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
                                                    }`}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="font-semibold text-sm text-foreground">
                                                        {config.name}
                                                    </span>
                                                </div>
                                                <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                                                    {config.badge}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] font-medium text-primary/80 mb-1">
                                                {config.tagline}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                {config.description}
                                            </p>
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between text-[10px]">
                                            <span className={isSelected ? "text-primary font-medium" : "text-muted-foreground"}>
                                                {isSelected ? "Selecionado" : "Clique para aplicar"}
                                            </span>
                                            {isSelected && (
                                                <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Test Audio & Live Preview Section */}
                    <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wand2 className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                    Teste de Áudio e Pré-Escuta
                                </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                Grave 5 segundos para testar como o cliente ouvirá
                            </span>
                        </div>

                        {/* Recording / Processing controls */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            {!isRecording ? (
                                <Button
                                    type="button"
                                    onClick={startTestRecording}
                                    variant="outline"
                                    className="w-full sm:w-auto h-9 px-4 rounded-xl border-dashed border-primary/40 hover:border-primary hover:bg-primary/10 text-xs font-semibold gap-2 transition-all cursor-pointer"
                                >
                                    <Mic className="h-3.5 w-3.5 text-primary" />
                                    {rawTestBlob ? "Gravar Novo Teste" : "Gravar Áudio de Teste"}
                                </Button>
                            ) : (
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 animate-pulse">
                                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                                        <span className="font-mono text-xs font-bold">{formatSeconds(recordingDuration)} / 00:15</span>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={stopTestRecording}
                                        size="sm"
                                        variant="destructive"
                                        className="h-9 px-3 rounded-xl text-xs gap-1.5 cursor-pointer"
                                    >
                                        <Square className="h-3 w-3 fill-current" />
                                        Parar e Processar
                                    </Button>
                                </div>
                            )}

                            {isProcessing && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                    <span>Processando filtros com FFmpeg...</span>
                                </div>
                            )}

                            {rawTestBlob && !isRecording && !isProcessing && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => processPreview(rawTestBlob, selectedProfile)}
                                    className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                                    title="Reaplicar perfil atual no mesmo áudio gravado"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Reaplicar Perfil
                                </Button>
                            )}
                        </div>

                        {/* Audio Player if preview is ready */}
                        {processedAudioUrl && (
                            <div className="p-3 rounded-xl border border-primary/20 bg-background/80 flex items-center gap-3 shadow-inner">
                                <audio
                                    ref={audioPlayerRef}
                                    src={processedAudioUrl}
                                    onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                                    onLoadedMetadata={(e) => setPlaybackDuration(e.currentTarget.duration)}
                                    onEnded={() => {
                                        setIsPlaying(false);
                                        setPlaybackTime(0);
                                    }}
                                />

                                <Button
                                    type="button"
                                    size="icon"
                                    onClick={togglePlayback}
                                    className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow shrink-0 cursor-pointer"
                                >
                                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
                                </Button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                        <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                            Prévia: {VOICE_PROFILES[selectedProfile].name}
                                        </span>
                                        <span className="font-mono text-muted-foreground text-[10px]">
                                            {formatSeconds(playbackTime)} / {formatSeconds(playbackDuration || 0)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-primary h-full transition-all duration-100"
                                            style={{
                                                width: `${playbackDuration ? (playbackTime / playbackDuration) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 px-6 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProfile("broadcast")}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Restaurar Padrão
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                            className="rounded-xl text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSave}
                            className="rounded-xl text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md cursor-pointer"
                        >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            Salvar Perfil de Voz
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
