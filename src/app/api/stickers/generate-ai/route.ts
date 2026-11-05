import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { fireSentWebhook } from "@/lib/webhook";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import Sticker from "wa-sticker-formatter";
import sharp from "sharp";

const STYLE_PROMPTS: Record<string, string> = {
    caricature: "exaggerated funny caricature sticker, big head, expressive funny comic face, hilarious laughing expression, clean sticker contour, solid white background",
    pixar3d: "cute 3D animated movie character sticker, vibrant Pixar render style, glossy finish, funny expression, solid white background, white border outline",
    meme: "funny internet meme sticker, hilarious reaction face, cool dark sunglasses, humorous vibe, clean sticker cut-out",
    anime: "chibi anime funny reaction sticker, expressive eyes, cute cartoon shock lines, comic humor, clean vector sticker cut-out, solid white background",
    party: "celebration party sticker, party hat, confetti, funny joyful laughing face, vibrant colorful sticker contour",
    cute: "ultra cute kawaii chibi mascot sticker, big sparkling eyes, joyful blush, clean outline border"
};

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "&": return "&amp;";
            case "'": return "&apos;";
            case '"': return "&quot;";
            default: return c;
        }
    });
}

function createMemeSvgOverlay(text: string, width: number = 512, height: number = 512): Buffer {
    const cleanText = text.trim().toUpperCase();
    const words = cleanText.split(/\s+/);
    
    // Quebrar em 2 linhas se for longo
    let line1 = "";
    let line2 = "";
    if (words.length <= 4) {
        line1 = words.join(" ");
    } else {
        const mid = Math.ceil(words.length / 2);
        line1 = words.slice(0, mid).join(" ");
        line2 = words.slice(mid).join(" ");
    }

    const fontSize = line2 ? 38 : 44;
    const yLine1 = line2 ? height - 65 : height - 45;
    const yLine2 = height - 20;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .meme-text {
          font-family: Impact, "Arial Black", "Segoe UI Black", sans-serif;
          font-weight: 900;
          fill: #ffffff;
          stroke: #000000;
          stroke-width: 6px;
          paint-order: stroke fill;
          text-anchor: middle;
        }
      </style>
      <text x="${width / 2}" y="${yLine1}" font-size="${fontSize}px" class="meme-text">${escapeXml(line1)}</text>
      ${line2 ? `<text x="${width / 2}" y="${yLine2}" font-size="${fontSize}px" class="meme-text">${escapeXml(line2)}</text>` : ""}
    </svg>`;

    return Buffer.from(svg);
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado", error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const userPrompt = (formData.get("prompt") as string || "").trim();
        const memeText = (formData.get("memeText") as string || "").trim();
        const style = (formData.get("style") as string || "caricature");
        const pack = (formData.get("pack") as string || "NEXUS AI");
        const author = (formData.get("author") as string || user.name || "Nexus Chat");
        const sessionId = (formData.get("sessionId") as string || "").trim();
        const targetNumber = (formData.get("target") as string || "").trim();
        const attachedFile = formData.get("file") as File | null;

        let baseImageBuffer: Buffer | null = null;

        // CASO 1: Usuário anexou uma imagem (foto do chefe, produto, cliente, meme)
        if (attachedFile && attachedFile.size > 0) {
            const rawBuffer = Buffer.from(await attachedFile.arrayBuffer());
            
            // Redimensionar para 512x512 no padrão sticker do WhatsApp
            let sharpImg = sharp(rawBuffer).resize(512, 512, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });

            // Se o usuário digitou uma frase de meme, estampar sobre a foto com tipografia meme
            if (memeText) {
                const svgOverlay = createMemeSvgOverlay(memeText, 512, 512);
                sharpImg = sharpImg.composite([{ input: svgOverlay, top: 0, left: 0 }]);
            }

            baseImageBuffer = await sharpImg.png().toBuffer();
        } 
        // CASO 2: Gerar imagem do zero via IA a partir do Prompt
        else {
            if (!userPrompt && !memeText) {
                return NextResponse.json({ 
                    status: false, 
                    message: "Anexe uma foto ou descreva a figurinha desejada.", 
                    error: "Prompt or file required" 
                }, { status: 400 });
            }

            const promptToUse = userPrompt || memeText;
            const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.caricature;
            const finalPrompt = `die-cut sticker of ${promptToUse}, ${styleText}, white background, vibrant colors, expressive funny face, vector illustration, sharp details, sticker style, white border contour, high resolution, no text, no watermark`;

            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(finalPrompt);
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true&model=flux`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 40000);

            const aiResponse = await fetch(pollinationsUrl, {
                signal: controller.signal,
                headers: { "User-Agent": "NexusChat/1.0" }
            });
            clearTimeout(timeout);

            if (!aiResponse.ok) {
                throw new Error(`Falha no provedor de IA gratuito (status: ${aiResponse.status})`);
            }

            const rawAiBuffer = Buffer.from(await aiResponse.arrayBuffer());

            // Se além do prompt houver frase de meme especificada, estampar sobre a imagem da IA
            if (memeText) {
                const svgOverlay = createMemeSvgOverlay(memeText, 512, 512);
                baseImageBuffer = await sharp(rawAiBuffer)
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .composite([{ input: svgOverlay, top: 0, left: 0 }])
                    .png()
                    .toBuffer();
            } else {
                baseImageBuffer = rawAiBuffer;
            }
        }

        // Converter para Figurinha oficial do WhatsApp (.webp)
        const sticker = new Sticker(baseImageBuffer, {
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
            message: sent ? "Figurinha gerada e enviada com sucesso no WhatsApp!" : "Figurinha gerada com sucesso!",
            webpBase64: `data:image/webp;base64,${webpBase64}`,
            sent
        });

    } catch (e: any) {
        console.error("Erro ao gerar figurinha:", e);
        const msg = e.name === "AbortError" 
            ? "A IA demorou para responder. Tente novamente." 
            : (e.message || "Falha ao gerar figurinha");
        return NextResponse.json({ status: false, message: msg, error: msg }, { status: 500 });
    }
}
