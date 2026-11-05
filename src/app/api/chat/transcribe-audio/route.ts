import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getTypebotConfig } from "@/modules/whatsapp/bot/typebot-engine";
import path from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const formData = await req.formData();
        const sessionId = formData.get("sessionId") as string || "";
        const audioUrl = formData.get("audioUrl") as string || "";
        const audioFile = formData.get("file") as File | null;

        let audioBuffer: Buffer | null = null;
        let mimeType = "audio/ogg";

        if (audioFile && audioFile.size > 0) {
            audioBuffer = Buffer.from(await audioFile.arrayBuffer());
            mimeType = audioFile.type || "audio/ogg";
        } else if (audioUrl) {
            // 1. Tentar ler diretamente do sistema de arquivos local (evita problemas de SSL/loopback no servidor)
            const mediaMatch = audioUrl.match(/\/api\/media\/([^?#]+)/);
            const candidateFilename = mediaMatch 
                ? decodeURIComponent(mediaMatch[1]) 
                : (audioUrl.includes("/") ? audioUrl.split("/").pop() || "" : audioUrl);

            if (candidateFilename) {
                const cleanFilename = path.basename(candidateFilename);
                const localPath = path.join(process.cwd(), "data", "media", cleanFilename);
                if (existsSync(localPath)) {
                    audioBuffer = await readFile(localPath);
                    const ext = path.extname(cleanFilename).toLowerCase();
                    if (ext === ".ogg" || ext === ".opus") mimeType = "audio/ogg";
                    else if (ext === ".mp3") mimeType = "audio/mpeg";
                    else if (ext === ".wav") mimeType = "audio/wav";
                    else if (ext === ".m4a") mimeType = "audio/mp4";
                }
            }

            // 2. Se não encontrou no disco local, tentar baixar via fetch HTTP seguro
            if (!audioBuffer) {
                try {
                    let targetUrl = audioUrl;
                    if (!targetUrl.startsWith("http")) {
                        const port = process.env.PORT || "3000";
                        targetUrl = `http://127.0.0.1:${port}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl}`;
                    }
                    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
                    if (res.ok) {
                        audioBuffer = Buffer.from(await res.arrayBuffer());
                        mimeType = res.headers.get("content-type") || mimeType;
                    }
                } catch (fetchErr) {
                    console.warn("Falha no download secundário do áudio:", fetchErr);
                }
            }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return NextResponse.json({ 
                status: false, 
                message: "Não foi possível carregar o arquivo de áudio para transcrição." 
            }, { status: 400 });
        }

        // Buscar chaves disponíveis: Typebot Config, ENV OPENAI, ENV GROQ
        const botConfig = sessionId ? getTypebotConfig(sessionId) : null;
        const openaiKey = botConfig?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
        const groqKey = (botConfig as any)?.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim();

        // 1. Tentar Groq Whisper (ultra veloz, alta precisão e gratuito na GroqCloud)
        if (groqKey) {
            try {
                const groqFormData = new FormData();
                const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
                groqFormData.append("file", blob, "voice.ogg");
                groqFormData.append("model", "whisper-large-v3-turbo");
                groqFormData.append("language", "pt");

                const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${groqKey}` },
                    body: groqFormData,
                    signal: AbortSignal.timeout(30000)
                });

                if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    if (groqData.text?.trim()) {
                        return NextResponse.json({
                            status: true,
                            text: groqData.text.trim(),
                            provider: "Groq Whisper"
                        });
                    }
                } else {
                    const errText = await groqRes.text();
                    console.error("Erro Groq Whisper:", errText);
                }
            } catch (groqErr) {
                console.error("Falha ao usar Groq Whisper:", groqErr);
            }
        }

        // 2. Tentar OpenAI Whisper
        if (openaiKey) {
            try {
                const openaiFormData = new FormData();
                const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
                openaiFormData.append("file", blob, "voice.ogg");
                openaiFormData.append("model", "whisper-1");
                openaiFormData.append("language", "pt");

                const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${openaiKey}` },
                    body: openaiFormData,
                    signal: AbortSignal.timeout(35000)
                });

                if (openaiRes.ok) {
                    const openaiData = await openaiRes.json();
                    if (openaiData.text?.trim()) {
                        return NextResponse.json({
                            status: true,
                            text: openaiData.text.trim(),
                            provider: "OpenAI Whisper"
                        });
                    }
                } else {
                    const errText = await openaiRes.text();
                    console.error("Erro OpenAI Whisper:", errText);
                }
            } catch (openaiErr) {
                console.error("Falha ao usar OpenAI Whisper:", openaiErr);
            }
        }

        return NextResponse.json({
            status: false,
            message: "Para transcrever áudios com inteligência artificial e máxima precisão, adicione a chave GROQ_API_KEY (gratuita na GroqCloud) ou OPENAI_API_KEY no arquivo .env do servidor."
        }, { status: 400 });

    } catch (e: any) {
        console.error("Erro na API de transcrição:", e);
        return NextResponse.json({ 
            status: false, 
            message: e.message || "Erro interno ao processar áudio" 
        }, { status: 500 });
    }
}

