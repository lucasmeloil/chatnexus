import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { fireSentWebhook } from "@/lib/webhook";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import Sticker from "wa-sticker-formatter";
import sharp from "sharp";

const STYLE_PROMPTS: Record<string, string> = {
    caricature: "hilarious exaggerated caricature sticker, giant head, ridiculous laughing face, comical silly expression, funny pop art cartoon, vibrant colors, white sticker outline contour, solid white background",
    pixar3d: "funny 3D animated character sticker, hilarious comedic expression, Pixar cartoon render style, glossy finish, goofy smile, solid white background, white border contour",
    meme: "iconic internet meme reaction sticker, cool thug life sunglasses, hilarious smirk, funny viral meme humor, clean sticker cut-out",
    anime: "chibi funny anime reaction sticker, shocked wide comical eyes, sweat drops, anime comedy humor, vector sticker cut-out, solid white background",
    party: "funny celebration party meme sticker, party hat, confetti explosion, hilarious laughing open mouth, vibrant joyful sticker contour",
    cute: "ultra cute funny kawaii chibi mascot sticker, goofy wink, joyful funny blush, clean outline border"
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

/**
 * Cria sobreposição SVG com acessórios cômicos (Óculos Thug Life, Bigode, Nariz de Palhaço, Lágrimas, Olhos Laser)
 * e tipografia de Meme (Impact ou Faixa no Topo estilo Zap).
 */
function createFunnyMemeSvgOverlay({
    text = "",
    accessory = "thug_glasses",
    layout = "classic", // 'classic' | 'banner'
    width = 512,
    height = 512
}: {
    text?: string;
    accessory?: string;
    layout?: string;
    width?: number;
    height?: number;
}): Buffer {
    let accessoriesSvg = "";

    // 1. Acessórios Cômicos
    switch (accessory) {
        case "thug_glasses":
            accessoriesSvg = `
            <g id="thug-glasses">
              <!-- Óculos Thug Life Pixelado -->
              <rect x="135" y="195" width="105" height="44" fill="#000000" stroke="#111111" stroke-width="2"/>
              <rect x="143" y="202" width="16" height="12" fill="#ffffff"/>
              <rect x="163" y="216" width="12" height="10" fill="#ffffff"/>
              <rect x="240" y="206" width="32" height="12" fill="#000000"/>
              <rect x="272" y="195" width="105" height="44" fill="#000000" stroke="#111111" stroke-width="2"/>
              <rect x="280" y="202" width="16" height="12" fill="#ffffff"/>
              <rect x="300" y="216" width="12" height="10" fill="#ffffff"/>
              <line x1="115" y1="208" x2="135" y2="208" stroke="#000000" stroke-width="8" stroke-linecap="round"/>
              <line x1="377" y1="208" x2="397" y2="208" stroke="#000000" stroke-width="8" stroke-linecap="round"/>
            </g>`;
            break;

        case "mustache":
            accessoriesSvg = `
            <g id="funny-mustache">
              <path d="M 256,290 C 230,260 170,270 145,310 C 175,330 225,325 256,305 C 287,325 337,330 367,310 C 342,270 282,260 256,290 Z" fill="#18181b" stroke="#000000" stroke-width="3"/>
            </g>`;
            break;

        case "clown":
            accessoriesSvg = `
            <g id="clown-kit">
              <!-- Chapeuzinho de Festa / Palhaço -->
              <polygon points="256,30 190,165 322,165" fill="#f43f5e" stroke="#facc15" stroke-width="5"/>
              <polygon points="256,30 220,165 292,165" fill="#06b6d4"/>
              <circle cx="256" cy="25" r="16" fill="#facc15" stroke="#eab308" stroke-width="3"/>
              <!-- Nariz Vermelho Brilhante -->
              <circle cx="256" cy="265" r="30" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
              <circle cx="245" cy="255" r="8" fill="#ffffff"/>
            </g>`;
            break;

        case "laugh_tears":
            accessoriesSvg = `
            <g id="laugh-tears">
              <!-- Jatos Cômicos de Lágrima de Riso -->
              <path d="M 160,205 Q 105,225 90,285 Q 125,300 148,225 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
              <path d="M 138,235 Q 95,265 85,320 Q 115,330 132,255 Z" fill="#0ea5e9"/>
              <path d="M 352,205 Q 407,225 422,285 Q 387,300 364,225 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
              <path d="M 374,235 Q 417,265 427,320 Q 397,330 380,255 Z" fill="#0ea5e9"/>
            </g>`;
            break;

        case "laser_eyes":
            accessoriesSvg = `
            <g id="laser-eyes">
              <!-- Olhos Laser Meme -->
              <circle cx="190" cy="210" r="18" fill="#ef4444" opacity="0.85"/>
              <circle cx="190" cy="210" r="9" fill="#fef08a"/>
              <line x1="190" y1="210" x2="20" y2="290" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/>
              <line x1="190" y1="210" x2="20" y2="290" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
              <circle cx="322" cy="210" r="18" fill="#ef4444" opacity="0.85"/>
              <circle cx="322" cy="210" r="9" fill="#fef08a"/>
              <line x1="322" y1="210" x2="492" y2="290" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/>
              <line x1="322" y1="210" x2="492" y2="290" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
            </g>`;
            break;

        case "zueira_full":
            accessoriesSvg = `
            <g id="zueira-full">
              <!-- Óculos Thug Life -->
              <rect x="135" y="195" width="105" height="44" fill="#000000" stroke="#111111" stroke-width="2"/>
              <rect x="143" y="202" width="16" height="12" fill="#ffffff"/>
              <rect x="163" y="216" width="12" height="10" fill="#ffffff"/>
              <rect x="240" y="206" width="32" height="12" fill="#000000"/>
              <rect x="272" y="195" width="105" height="44" fill="#000000" stroke="#111111" stroke-width="2"/>
              <rect x="280" y="202" width="16" height="12" fill="#ffffff"/>
              <rect x="300" y="216" width="12" height="10" fill="#ffffff"/>
              <!-- Bigodão -->
              <path d="M 256,290 C 230,260 170,270 145,310 C 175,330 225,325 256,305 C 287,325 337,330 367,310 C 342,270 282,260 256,290 Z" fill="#18181b" stroke="#000000" stroke-width="3"/>
            </g>`;
            break;

        case "none":
        default:
            accessoriesSvg = "";
            break;
    }

    // 2. Tipografia do Meme: Banner Superior estilo Zap OU Impact Clássico
    let textSvg = "";
    if (text.trim()) {
        const cleanText = text.trim().toUpperCase();
        const words = cleanText.split(/\s+/);
        
        let line1 = "";
        let line2 = "";
        if (words.length <= 4) {
            line1 = words.join(" ");
        } else {
            const mid = Math.ceil(words.length / 2);
            line1 = words.slice(0, mid).join(" ");
            line2 = words.slice(mid).join(" ");
        }

        if (layout === "banner") {
            // Faixa branca superior estilo meme moderno do Twitter / WhatsApp
            const bannerH = line2 ? 85 : 55;
            textSvg = `
              <rect x="0" y="0" width="${width}" height="${bannerH}" fill="#ffffff" rx="8" />
              <line x1="0" y1="${bannerH}" x2="${width}" y2="${bannerH}" stroke="#000000" stroke-width="3"/>
              <text x="${width / 2}" y="${line2 ? 32 : 36}" font-family="Arial, 'Segoe UI', Impact, sans-serif" font-weight="900" font-size="${line2 ? 24 : 28}px" fill="#000000" text-anchor="middle">${escapeXml(line1)}</text>
              ${line2 ? `<text x="${width / 2}" y="65" font-family="Arial, 'Segoe UI', Impact, sans-serif" font-weight="900" font-size="24px" fill="#000000" text-anchor="middle">${escapeXml(line2)}</text>` : ""}`;
        } else {
            // Clássico Impact Branco com Borda Preta Grossa
            const fontSize = line2 ? 38 : 44;
            const yLine1 = line2 ? height - 68 : height - 42;
            const yLine2 = height - 20;

            textSvg = `
              <text x="${width / 2}" y="${yLine1}" font-size="${fontSize}px" class="meme-text">${escapeXml(line1)}</text>
              ${line2 ? `<text x="${width / 2}" y="${yLine2}" font-size="${fontSize}px" class="meme-text">${escapeXml(line2)}</text>` : ""}`;
        }
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <style>
        .meme-text {
          font-family: Impact, "Arial Black", "Segoe UI Black", sans-serif;
          font-weight: 900;
          fill: #ffffff;
          stroke: #000000;
          stroke-width: 7px;
          paint-order: stroke fill;
          text-anchor: middle;
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.8));
        }
      </style>
      <g filter="url(#shadow)">
        ${accessoriesSvg}
      </g>
      ${textSvg}
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
        const accessory = (formData.get("accessory") as string || "thug_glasses");
        const layout = (formData.get("layout") as string || "classic");
        const pack = (formData.get("pack") as string || "NEXUS AI");
        const author = (formData.get("author") as string || user.name || "Nexus Chat");
        const sessionId = (formData.get("sessionId") as string || "").trim();
        const targetNumber = (formData.get("target") as string || "").trim();
        const attachedFile = formData.get("file") as File | null;

        let baseImageBuffer: Buffer | null = null;

        // CASO 1: Usuário anexou uma imagem (foto do chefe, produto, cliente, meme)
        if (attachedFile && attachedFile.size > 0) {
            const rawBuffer = Buffer.from(await attachedFile.arrayBuffer());
            
            // Tratamento visual para deixar a foto engraçada:
            // Saturação cômica reforçada + nitidez de desenho/caricatura + redimensionamento 512x512
            let sharpImg = sharp(rawBuffer)
                .resize(512, 512, {
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .modulate({ saturation: 1.4, brightness: 1.05 })
                .sharpen();

            // Gerar sobreposição com os acessórios cômicos (Óculos Thug Life, Bigode, etc.) + Frase de Meme
            const svgOverlay = createFunnyMemeSvgOverlay({
                text: memeText,
                accessory: accessory,
                layout: layout,
                width: 512,
                height: 512
            });

            sharpImg = sharpImg.composite([{ input: svgOverlay, top: 0, left: 0 }]);
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
            let finalImagePrompt = promptToUse;

            // Otimizador Cômico via Groq Llama 3.3: Converte qualquer ideia em prompt visual ultra preciso e engraçado
            const groqKey = process.env.GROQ_API_KEY?.trim();
            if (groqKey) {
                try {
                    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${groqKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                {
                                    role: "system",
                                    content: "You are a master Brazilian WhatsApp meme & funny sticker creator. Translate and transform the user's idea into an extremely funny, precise visual English prompt for an AI image generator (Flux). The prompt MUST describe a hilarious, ridiculous, exaggerated 3D cartoon caricature with comical laughing or shocked facial expressions, funny reaction, pop art meme style, bold white die-cut sticker outline, solid pure white background, vibrant colors. Output ONLY the one-line English prompt, no quotes, no markdown."
                                },
                                {
                                    role: "user",
                                    content: promptToUse
                                }
                            ],
                            max_tokens: 120,
                            temperature: 0.85
                        }),
                        signal: AbortSignal.timeout(6000)
                    });

                    if (groqRes.ok) {
                        const groqData = await groqRes.json();
                        const candidate = groqData.choices?.[0]?.message?.content?.trim();
                        if (candidate && candidate.length > 10) {
                            finalImagePrompt = candidate.replace(/^["']|["']$/g, "");
                        }
                    }
                } catch (gErr) {
                    console.warn("Groq prompt optimizer fallback:", gErr);
                }
            }

            const styleText = STYLE_PROMPTS[style] || STYLE_PROMPTS.caricature;
            const fullPrompt = `${finalImagePrompt}, ${styleText}, die-cut sticker, pure white background, sticker contour border, 3D cartoon, 4k render`;

            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(fullPrompt);
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

            // Sobrepor frase de meme e acessório engraçado se especificados
            if (memeText || (accessory && accessory !== "none")) {
                const svgOverlay = createFunnyMemeSvgOverlay({
                    text: memeText,
                    accessory: accessory === "thug_glasses" ? "none" : accessory,
                    layout: layout,
                    width: 512,
                    height: 512
                });

                baseImageBuffer = await sharp(rawAiBuffer)
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .modulate({ saturation: 1.3, brightness: 1.03 })
                    .sharpen()
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
