import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

let cachedFfmpegPath: string | null = null;

export function getFfmpegPath(): string | null {
    if (cachedFfmpegPath && cachedFfmpegPath !== "ffmpeg" && fs.existsSync(cachedFfmpegPath)) {
        return cachedFfmpegPath;
    }

    const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

    // 1. Check direct disk path from process.cwd() node_modules
    const localPath = path.join(process.cwd(), "node_modules", "ffmpeg-static", exeName);
    if (fs.existsSync(localPath)) {
        cachedFfmpegPath = localPath;
        return cachedFfmpegPath;
    }

    // 2. Try require('ffmpeg-static') and resolve any Next.js /ROOT virtual path prefix
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        let staticPath = require("ffmpeg-static");
        if (typeof staticPath === "string") {
            if (staticPath.startsWith("\\ROOT\\") || staticPath.startsWith("/ROOT/")) {
                staticPath = path.join(process.cwd(), staticPath.replace(/^[\\/]ROOT[\\/]/, ""));
            }
            if (fs.existsSync(staticPath)) {
                cachedFfmpegPath = staticPath;
                return cachedFfmpegPath;
            }
        }
    } catch {
        // Ignore
    }

    // 3. Fallback relative to project root
    const relPath = path.resolve(__dirname, "../../..", "node_modules", "ffmpeg-static", exeName);
    if (fs.existsSync(relPath)) {
        cachedFfmpegPath = relPath;
        return cachedFfmpegPath;
    }

    cachedFfmpegPath = "ffmpeg";
    return cachedFfmpegPath;
}

export { type VoiceProfile, type VoiceProfileConfig, VOICE_PROFILES } from "./voice-profiles";
import { type VoiceProfile, VOICE_PROFILES } from "./voice-profiles";

/**
 * Converts any audio buffer (WebM Opus from browser, MP3, WAV, AAC, raw Ogg)
 * to WhatsApp-native PTT OGG Opus (Mono, 48kHz, VOIP profile) applying SteelSeries Sonar presets.
 */
export async function convertToOggOpus(
    inputBuffer: Buffer,
    profile: VoiceProfile = 'broadcast'
): Promise<Buffer> {
    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
        console.warn("[AudioConverter] ffmpeg not found, using original buffer");
        return inputBuffer;
    }

    const tempId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${tempId}_in.tmp`);
    const outputPath = path.join(tempDir, `${tempId}_out.ogg`);

    const activeProfile = VOICE_PROFILES[profile] || VOICE_PROFILES.broadcast;
    const filterChain = activeProfile.filterChain;

    try {
        await fsp.writeFile(inputPath, inputBuffer);

        await new Promise<void>((resolve, reject) => {
            const args = [
                "-y",
                "-i", inputPath,
                "-vn",                  // No video
                "-af", filterChain,     // SteelSeries Sonar vocal processing & noise reduction
                "-c:a", "libopus",
                "-ac", "1",             // Mono channel (required by WhatsApp PTT)
                "-ar", "48000",         // 48kHz standard Opus sample rate
                "-b:a", "64k",          // Crystal clear 64kbps voice bitrate
                "-vbr", "on",
                "-application", "voip", // Optimized for voice notes
                "-avoid_negative_ts", "make_zero",
                "-f", "ogg",
                outputPath
            ];

            const proc = spawn(ffmpegPath, args);
            let stderr = "";

            proc.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            proc.on("error", (err) => {
                reject(new Error(`FFmpeg spawn error (${ffmpegPath}): ${err.message}`));
            });

            proc.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
                }
            });
        });

        const outputBuffer = await fsp.readFile(outputPath);
        return outputBuffer;
    } catch (err: any) {
        console.error("[AudioConverter] Conversion error:", err.message);
        return inputBuffer;
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }
}
