import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getTypebotConfig } from "@/modules/whatsapp/bot/typebot-engine";

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

        if (audioFile) {
            audioBuffer = Buffer.from(await audioFile.arrayBuffer());
            mimeType = audioFile.type || "audio/ogg";
        } else if (audioUrl) {
            // Se for URL relativa (/api/media/...), monta URL absoluta local
            const targetUrl = audioUrl.startsWith("http") 
                ? audioUrl 
                : new URL(audioUrl, req.url).toString();
            
            const res = await fetch(targetUrl);
            if (!res.ok) {
                return NextResponse.json({ status: false, message: "Não foi possível baixar o arquivo de áudio" }, { status: 400 });
            }
            audioBuffer = Buffer.from(await res.arrayBuffer());
            mimeType = res.headers.get("content-type") || "audio/ogg";
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return NextResponse.json({ status: false, message: "Nenhum áudio fornecido para transcrição" }, { status: 400 });
        }

        // Buscar chave disponível: Typebot Config, ENV OPENAI, ENV GROQ
        const botConfig = sessionId ? getTypebotConfig(sessionId) : null;
        const openaiKey = botConfig?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
        const groqKey = process.env.GROQ_API_KEY?.trim();

        // 1. Tentar Groq Whisper (ultra veloz e gratuito) se configurado
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
                    body: groqFormData
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
                    body: openaiFormData
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

        // 3. Fallback: Hugging Face Serverless Whisper (Gratuito)
        try {
            const hfRes = await fetch("https://api-inference.huggingface.co/models/openai/whisper-large-v3", {
                method: "POST",
                headers: {
                    "Content-Type": mimeType
                },
                body: new Uint8Array(audioBuffer)
            });

            if (hfRes.ok) {
                const hfData = await hfRes.json();
                if (hfData.text?.trim()) {
                    return NextResponse.json({
                        status: true,
                        text: hfData.text.trim(),
                        provider: "Whisper IA"
                    });
                }
            }
        } catch (hfErr) {
            console.error("Falha no fallback Whisper HuggingFace:", hfErr);
        }

        return NextResponse.json({
            status: false,
            message: "Para transcrever áudios com precisão máxima, configure a chave OpenAI ou Groq nas configurações do sistema ou no arquivo .env."
        }, { status: 400 });

    } catch (e: any) {
        console.error("Erro na API de transcrição:", e);
        return NextResponse.json({ status: false, message: e.message || "Erro interno ao transcrever áudio" }, { status: 500 });
    }
}

