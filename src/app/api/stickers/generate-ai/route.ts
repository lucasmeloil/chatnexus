import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { fireSentWebhook } from "@/lib/webhook";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import Sticker from "wa-sticker-formatter";

const STYLE_PROMPTS: Record<string, string> = {
    caricature: "exaggerated funny caricature sticker, big head, expressive funny comic face, hilarious laughing expression, clean sticker contour, solid white background",
    pixar3d: "cute 3D animated movie character sticker, vibrant Pixar render style, glossy finish, funny expression, solid white background, white border outline",
    meme: "funny internet meme sticker, hilarious reaction face, cool dark sunglasses, humorous vibe, clean sticker cut-out",
    anime: "chibi anime funny reaction sticker, expressive eyes, cute cartoon shock lines, comic humor, clean vector sticker cut-out, solid white background",
    party: "celebration party sticker, party hat, confetti, funny joyful laughing face, vibrant colorful sticker contour",
    cute: "ultra cute kawaii chibi mascot sticker, big sparkling eyes, joyful blush, clean outline border"
};

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado", error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const userPrompt = (formData.get("prompt") as string || "").trim();
        const style = (formData.get("style") as string || "caricature");
        const pack = (formData.get("pack") as string || "NEXUS AI");
        const author = (formData.get("author") as string || user.name || "Nexus Chat");
        const sessionId = (formData.get("sessionId") as string || "").trim();
        const targetNumber = (formData.get("target") as string || "").trim();

        if (!userPrompt) {
            return NextResponse.json({ status: false, message: "Informe a descrição da figurinha", error: "Prompt is required" }, { status: 400 });
        }

        // Montar prompt otimizado para sticker engraçado do WhatsApp
        const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.caricature;
        const finalPrompt = `die-cut sticker of ${userPrompt}, ${styleText}, white background, vibrant colors, expressive funny face, vector illustration, sharp details, sticker style, white border contour, high resolution, no text, no watermark`;

        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true&model=flux`;

        // Buscar imagem gerada pela IA gratuita
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 40000);

        const aiResponse = await fetch(pollinationsUrl, {
            signal: controller.signal,
            headers: {
                "User-Agent": "NexusChat/1.0"
            }
        });
        clearTimeout(timeout);

        if (!aiResponse.ok) {
            throw new Error(`Falha no provedor de IA gratuito (status: ${aiResponse.status})`);
        }

        const imageArrayBuffer = await aiResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);

        // Converter para Figurinha oficial do WhatsApp (.webp)
        const sticker = new Sticker(imageBuffer, {
            pack,
            author,
            type: "full" as any,
            categories: ["😂", "🎉", "🔥"] as any,
            quality: 75,
            background: "transparent"
        });

        const webpBuffer = await sticker.toBuffer();
        const webpBase64 = webpBuffer.toString("base64");

        let sent = false;

        // Se sessionId e número de destino foram informados, enviar direto para o WhatsApp
        if (sessionId && targetNumber) {
            const canAccess = await canAccessSession(user.id, user.role, sessionId);
            if (canAccess) {
                const instance = waManager.getInstance(sessionId);
                if (instance?.socket) {
                    const formattedJid = formatToBrazilPhoneJid(targetNumber);
                    const sendResult = await instance.socket.sendMessage(formattedJid, { sticker: webpBuffer });
                    fireSentWebhook(sessionId, formattedJid, { type: "sticker" }, sendResult).catch(() => {});
                    sent = true;
                }
            }
        }

        return NextResponse.json({
            status: true,
            message: sent ? "Figurinha gerada e enviada com sucesso!" : "Figurinha gerada com sucesso!",
            webpBase64: `data:image/webp;base64,${webpBase64}`,
            sent
        });

    } catch (e: any) {
        console.error("Erro ao gerar figurinha com IA:", e);
        const msg = e.name === "AbortError" 
            ? "A IA demorou para responder. Tente novamente." 
            : (e.message || "Falha ao gerar figurinha com IA");
        return NextResponse.json({ status: false, message: msg, error: msg }, { status: 500 });
    }
}

