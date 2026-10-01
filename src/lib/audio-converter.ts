import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

let cachedFfmpegPath: string | null = null;

export function getFfmpegPath(): string | null {
    if (cachedFfmpegPath && (cachedFfmpegPath === "ffmpeg" || fs.existsSync(cachedFfmpegPath))) {
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

    // 3. Fallback to system command
    cachedFfmpegPath = "ffmpeg";
    return cachedFfmpegPath;
}

/**
 * Checks if buffer is already in OGG format (starts with 'OggS')
 */
export function isOggBuffer(buffer: Buffer): boolean {
    return (
        buffer.length >= 4 &&
        buffer[0] === 0x4f && // O
        buffer[1] === 0x67 && // g
        buffer[2] === 0x67 && // g
        buffer[3] === 0x53    // S
    );
}

/**
 * Converts any audio buffer (e.g. WebM Opus from browser, MP3, WAV, AAC)
 * to WhatsApp-compatible OGG Opus for voice notes (Push-to-Talk / PTT).
 */
export async function convertToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
    if (isOggBuffer(inputBuffer)) {
        return inputBuffer;
    }

    const ffmpegPath = getFfmpegPath();
    if (!ffmpegPath) {
        console.warn("[AudioConverter] ffmpeg not found, using original buffer");
        return inputBuffer;
    }

    const tempId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${tempId}_in.tmp`);
    const outputPath = path.join(tempDir, `${tempId}_out.ogg`);

    try {
        await fsp.writeFile(inputPath, inputBuffer);

        await new Promise<void>((resolve, reject) => {
            const args = [
                "-y",
                "-i", inputPath,
                "-vn",                  // No video
                "-c:a", "libopus",
                "-ac", "1",             // Mono channel (required by WhatsApp PTT)
                "-ar", "48000",         // 48kHz standard Opus sample rate
                "-b:a", "48k",          // Voice note bitrate
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
