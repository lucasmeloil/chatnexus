import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getTypebotConfig } from "@/modules/whatsapp/bot/typebot-engine";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { sessionId, jid, clientName } = body;

        if (!sessionId || !jid) {
            return NextResponse.json({ status: false, message: "Parâmetros inválidos" }, { status: 400 });
        }

        // Buscar a sessão no banco para obter o id
        const sessionData = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionData) {
            return NextResponse.json({ status: false, message: "Sessão não encontrada" }, { status: 404 });
        }

        // Buscar as últimas 25 mensagens deste chat no banco
        const dbMessages = await prisma.message.findMany({
            where: {
                sessionId: sessionData.id,
                OR: [
                    { remoteJid: jid },
                    { remoteJid: { contains: jid.split("@")[0] } }
                ]
            },
            orderBy: { timestamp: "desc" },
            take: 25,
            select: {
                content: true,
                fromMe: true,
                pushName: true,
                type: true,
                timestamp: true
            }
        });

        const messagesList = [...dbMessages].reverse();

        if (messagesList.length === 0) {
            return NextResponse.json({
                status: true,
                summary: "Ainda não há mensagens suficientes registradas neste chat para gerar um resumo."
            });
        }

        // Montar transcrição em texto da conversa
        const conversationText = messagesList.map(m => {
            const sender = m.fromMe ? "Atendente" : (m.pushName || clientName || "Cliente");
            const text = m.content || `[Arquivo de ${m.type || "mídia"}]`;
            return `${sender}: ${text}`;
        }).join("\n");

        const systemPrompt = `Você é um assistente de IA especialista em CRM e suporte ao cliente do sistema NEXUS Chat.
Analise o diálogo abaixo entre um cliente e o atendente e produza um resumo executivo direto e de leitura rápida em português do Brasil.
Use exatamente a seguinte estrutura:

📌 **Assunto Principal:**
[Resumo em 1 frase do que o cliente precisa ou perguntou]

🔍 **Detalhes Relevantes:**
• [Ponto 1]
• [Ponto 2 se houver]

⚡ **Próximo Passo Recomendado:**
[O que o atendente deve fazer agora para atender ou resolver o caso com eficiência]

Seja breve, profissional e focado na ação. Não invente dados que não estão no texto.`;

        const botConfig = getTypebotConfig(sessionId);
        const openaiKey = botConfig?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
        const groqKey = process.env.GROQ_API_KEY?.trim();

        // 1. Tentar Groq (Llama 3.3 70B - gratuito e instantâneo)
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
                            { role: "system", content: systemPrompt },
                            { role: "user", content: `Aqui está o histórico recente da conversa:\n\n${conversationText}` }
                        ],
                        temperature: 0.3,
                        max_tokens: 500
                    })
                });

                if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    const text = groqData.choices?.[0]?.message?.content;
                    if (text?.trim()) {
                        return NextResponse.json({ status: true, summary: text.trim() });
                    }
                }
            } catch (groqErr) {
                console.error("Erro Groq Summarize:", groqErr);
            }
        }

        // 2. Tentar OpenAI
        if (openaiKey) {
            try {
                const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${openaiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: `Aqui está o histórico recente da conversa:\n\n${conversationText}` }
                        ],
                        temperature: 0.3,
                        max_tokens: 500
                    })
                });

                if (openAiRes.ok) {
                    const openAiData = await openAiRes.json();
                    const text = openAiData.choices?.[0]?.message?.content;
                    if (text?.trim()) {
                        return NextResponse.json({ status: true, summary: text.trim() });
                    }
                }
            } catch (openAiErr) {
                console.error("Erro OpenAI Summarize:", openAiErr);
            }
        }

        // 3. Fallback: Pollinations Text (100% Gratuito sem chave)
        try {
            const promptCombined = `${systemPrompt}\n\nHistórico:\n${conversationText}`;
            const polRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(promptCombined)}`, {
                headers: { "User-Agent": "NexusChat/1.0" }
            });

            if (polRes.ok) {
                const polText = await polRes.text();
                if (polText && polText.trim() && !polText.includes("error")) {
                    return NextResponse.json({ status: true, summary: polText.trim() });
                }
            }
        } catch (polErr) {
            console.error("Erro Pollinations Summarize:", polErr);
        }

        return NextResponse.json({
            status: false,
            message: "Não foi possível gerar o resumo automático com a IA no momento."
        }, { status: 500 });

    } catch (e: any) {
        console.error("Erro na API de resumo:", e);
        return NextResponse.json({ status: false, message: e.message || "Erro interno" }, { status: 500 });
    }
}

