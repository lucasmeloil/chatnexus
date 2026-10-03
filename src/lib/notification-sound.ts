// Notification Sound and Browser Notification Utility for NEXUS CHAT

let audioContext: AudioContext | null = null;
let cachedBlobAudioUrl: string | null = null;
let preloadedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

function getChimeBlobUrl(): string | null {
    if (typeof window === "undefined") return null;
    if (cachedBlobAudioUrl) return cachedBlobAudioUrl;

    try {
        const sampleRate = 22050;
        const duration = 0.45;
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(0, "RIFF");
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, numSamples * 2, true);

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let sample = 0;
            // Tone 1: 587.33 Hz (D5) - warm bell
            if (t < 0.35) {
                sample += 0.45 * Math.sin(2 * Math.PI * 587.33 * t) * Math.exp(-t * 9);
            }
            // Tone 2: 880 Hz (A5) - clear high chime
            if (t >= 0.1) {
                const t2 = t - 0.1;
                sample += 0.55 * Math.sin(2 * Math.PI * 880 * t2) * Math.exp(-t2 * 8);
            }
            const clamped = Math.max(-1, Math.min(1, sample));
            view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        }

        const blob = new Blob([buffer], { type: "audio/wav" });
        cachedBlobAudioUrl = URL.createObjectURL(blob);
        preloadedAudio = new Audio(cachedBlobAudioUrl);
        preloadedAudio.volume = 0.85;
        return cachedBlobAudioUrl;
    } catch (e) {
        console.warn("Failed to generate chime blob", e);
        return null;
    }
}

function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioContext = new AudioContextClass();
            }
        }
        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    } catch (e) {
        console.warn("AudioContext initialization failed", e);
        return null;
    }
}

/**
 * Proactively unlock audio playback on any operator user interaction
 */
export function unlockAudioSystem(): void {
    if (typeof window === "undefined" || audioUnlocked) return;
    audioUnlocked = true;

    try {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
    } catch {}

    try {
        const url = getChimeBlobUrl();
        if (url && preloadedAudio) {
            // Warm up audio element with muted short play
            preloadedAudio.volume = 0.001;
            const p = preloadedAudio.play();
            if (p && typeof p.then === "function") {
                p.then(() => {
                    preloadedAudio?.pause();
                    if (preloadedAudio) {
                        preloadedAudio.currentTime = 0;
                        preloadedAudio.volume = 0.85;
                    }
                }).catch(() => {
                    if (preloadedAudio) preloadedAudio.volume = 0.85;
                });
            }
        }
    } catch {}
}

if (typeof window !== "undefined") {
    const handleGesture = () => {
        unlockAudioSystem();
        window.removeEventListener("pointerdown", handleGesture);
        window.removeEventListener("mousedown", handleGesture);
        window.removeEventListener("touchstart", handleGesture);
        window.removeEventListener("keydown", handleGesture);
        window.removeEventListener("click", handleGesture);
    };

    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("mousedown", handleGesture, { passive: true });
    window.addEventListener("touchstart", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });
    window.addEventListener("click", handleGesture, { passive: true });
}

export function isNotificationSoundEnabled(): boolean {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nexus_sound_enabled") !== "false";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("nexus_sound_enabled", enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("nexus:sound-enabled-changed", { detail: { enabled } }));
}

/**
 * Check if notifications for the currently active/open conversation should be muted.
 * Enabled by default (always true unless explicitly toggled).
 */
export function isMuteActiveChatEnabled(): boolean {
    if (typeof window === "undefined") return true;
    const v2 = localStorage.getItem("nexus_mute_active_chat_v2");
    if (v2 === null) {
        // Enforce active chat silence by default for current user
        localStorage.setItem("nexus_mute_active_chat_v2", "true");
        localStorage.setItem("nexus_mute_active_chat", "true");
        return true;
    }
    return v2 !== "false";
}

/**
 * Check if floating notification popups on the screen are enabled.
 * Enabled by default (returns true unless explicitly disabled).
 */
export function isFloatingNotificationEnabled(): boolean {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nexus_floating_notifications") !== "false";
}

/**
 * Configure whether to display floating notification cards on the screen.
 */
export function setFloatingNotificationEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("nexus_floating_notifications", enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("nexus:floating-notification-changed", { detail: { enabled } }));
}

/**
 * Configure whether to mute notifications for the currently open conversation.
 */
export function setMuteActiveChatEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("nexus_mute_active_chat_v2", enabled ? "true" : "false");
    localStorage.setItem("nexus_mute_active_chat", enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("nexus:mute-active-chat-changed", { detail: { enabled } }));
}

/**
 * Get the currently open / active conversation JID.
 */
export function getActiveOpenChatJid(): string | null {
    if (typeof window === "undefined") return null;
    return (window as any).__NEXUS_ACTIVE_CHAT_JID__ || null;
}

/**
 * Set the currently open / active conversation JID.
 */
export function setActiveOpenChatJid(jid: string | null): void {
    if (typeof window === "undefined") return;
    (window as any).__NEXUS_ACTIVE_CHAT_JID__ = jid || null;
    window.dispatchEvent(new CustomEvent("nexus:active-chat-changed", { detail: { jid: jid || null } }));
}

export type NotificationSoundType = 
    | "nexus-chime" 
    | "crystal" 
    | "modern-pop" 
    | "marimba" 
    | "bell" 
    | "cyber-alert"
    | "custom";

export interface NotificationSoundConfig {
    type: NotificationSoundType;
    volume: number; // 0 to 100
    customAudioData?: string | null;
    customAudioName?: string | null;
}

export function getNotificationSoundConfig(): NotificationSoundConfig {
    if (typeof window === "undefined") {
        return { type: "nexus-chime", volume: 80 };
    }
    const type = (localStorage.getItem("nexus_sound_type") as NotificationSoundType) || "nexus-chime";
    const volStr = localStorage.getItem("nexus_sound_volume");
    const volume = volStr !== null ? Math.max(0, Math.min(100, parseInt(volStr, 10) || 80)) : 80;
    const customAudioData = localStorage.getItem("nexus_sound_custom_data") || null;
    const customAudioName = localStorage.getItem("nexus_sound_custom_name") || null;

    return { type, volume, customAudioData, customAudioName };
}

export function saveNotificationSoundConfig(config: {
    type: NotificationSoundType;
    volume: number;
    customAudioData?: string | null;
    customAudioName?: string | null;
}): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("nexus_sound_type", config.type);
    localStorage.setItem("nexus_sound_volume", String(config.volume));
    if (config.customAudioData !== undefined) {
        if (config.customAudioData) {
            localStorage.setItem("nexus_sound_custom_data", config.customAudioData);
        } else {
            localStorage.removeItem("nexus_sound_custom_data");
        }
    }
    if (config.customAudioName !== undefined) {
        if (config.customAudioName) {
            localStorage.setItem("nexus_sound_custom_name", config.customAudioName);
        } else {
            localStorage.removeItem("nexus_sound_custom_name");
        }
    }

    window.dispatchEvent(new CustomEvent("nexus:sound-setting-changed", { detail: config }));
}

/**
 * Preview or play a specific notification sound preset or custom audio
 */
export function previewNotificationSound(
    soundType: NotificationSoundType = "nexus-chime",
    volumePercent: number = 80,
    customAudio?: string | null
): void {
    if (typeof window === "undefined") return;

    const normalizedVol = Math.max(0.01, Math.min(1, volumePercent / 100));

    // Custom audio playback
    if (soundType === "custom") {
        const audioSrc = customAudio || localStorage.getItem("nexus_sound_custom_data");
        if (audioSrc) {
            try {
                const audio = new Audio(audioSrc);
                audio.volume = normalizedVol;
                audio.play().catch(err => {
                    console.debug("Custom audio play blocked, falling back to Web Audio", err);
                    playSynthesizedSound("nexus-chime", normalizedVol);
                });
                return;
            } catch (e) {
                console.debug("Custom audio failed", e);
            }
        }
    }

    playSynthesizedSound(soundType, normalizedVol);
}

function playSynthesizedSound(preset: NotificationSoundType, vol: number): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        if (preset === "crystal") {
            const notes = [659.25, 830.61, 987.77];
            notes.forEach((freq, idx) => {
                const start = now + idx * 0.065;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.28 * vol, start);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.45);
            });
        } else if (preset === "modern-pop") {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(850, now);
            osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
            gain.gain.setValueAtTime(0.38 * vol, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.14);
        } else if (preset === "marimba") {
            [440, 659.25].forEach((freq, idx) => {
                const start = now + idx * 0.08;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.42 * vol, start);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.28);
            });
        } else if (preset === "bell") {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = "sine";
            osc2.type = "sine";
            osc1.frequency.setValueAtTime(1046.5, now);
            osc2.frequency.setValueAtTime(2093, now);
            gain.gain.setValueAtTime(0.32 * vol, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.65);
            osc2.stop(now + 0.65);
        } else if (preset === "cyber-alert") {
            [880, 1174.66].forEach((freq, idx) => {
                const start = now + idx * 0.09;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.32 * vol, start);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.22);
            });
        } else {
            // nexus-chime (default)
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.28 * vol, now);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            osc2.type = "sine";
            osc2.frequency.setValueAtTime(880, now + 0.11);
            gain2.gain.setValueAtTime(0.32 * vol, now + 0.11);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.11);
            osc2.stop(now + 0.48);
        }
    } catch (e) {
        console.debug("Web Audio API oscillator playback failed", e);
    }
}

/**
 * Plays a notification sound chime using the user-configured sound preset and volume
 */
export function playNotificationSound(): void {
    if (!isNotificationSoundEnabled()) return;
    if (typeof window === "undefined") return;

    const config = getNotificationSoundConfig();
    previewNotificationSound(config.type, config.volume, config.customAudioData);
}


export async function requestNotificationPermission(): Promise<boolean> {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    try {
        const perm = await Notification.requestPermission();
        return perm === "granted";
    } catch {
        return false;
    }
}

export function sendBrowserNotification(
    title: string,
    options?: { body?: string; tag?: string; icon?: string },
    onClick?: () => void
): void {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
        const notif = new Notification(title, {
            body: options?.body || "",
            tag: options?.tag,
            icon: options?.icon || "/favicon.ico",
        });

        if (onClick) {
            notif.onclick = () => {
                window.focus();
                onClick();
                notif.close();
            };
        }
    } catch (e) {
        console.warn("Error showing browser notification", e);
    }
}
