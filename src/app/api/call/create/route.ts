import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { CallFeedbackService } from "@/modules/call/call-feedback.service";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado", error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { sessionId, jid: rawJid, contactName, operatorName } = body || {};

        if (!sessionId || !rawJid) {
            return NextResponse.json({ status: false, message: "Parâmetros sessionId e jid são obrigatórios" }, { status: 400 });
        }

        const jid = decodeURIComponent(rawJid);

        // Check permission to access session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado para esta sessão" }, { status: 403 });
        }

        // Generate a secure unique room ID
        const roomId = `call_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // Determine base public URL
        const proto = request.headers.get("x-forwarded-proto") || "https";
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
        const origin = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
        const callUrl = `${origin}/call/${roomId}`;

        const opName = operatorName || user.name || "Atendente";
        const clientName = contactName || "Cliente";

        // Formulate attractive WhatsApp Invitation message
        const inviteMessage = 
`📞 *NEXUS CHAT • Chamada de Voz com Atendente*

Olá, *${clientName}*! O atendente *${opName}* está convidando você para uma ligação de voz agora.

👉 *Toque no link abaixo para atender a chamada pelo navegador do seu celular (sem precisar instalar nada):*
${callUrl}

_Esta chamada é criptografada e conectada diretamente com nossa equipe._`;

        // Register room metadata for feedback tracking
        await CallFeedbackService.registerRoom({
            roomId,
            sessionId,
            jid,
            operatorName: opName,
            contactName: clientName,
            createdAt: new Date().toISOString()
        });

        // Send invite via WhatsApp
        await ChatService.sendTextMessage(sessionId, jid, { text: inviteMessage });

        return NextResponse.json({
            status: true,
            message: "Chamada iniciada e convite enviado com sucesso",
            data: {
                roomId,
                callUrl,
                operatorName: opName,
                contactName: clientName
            }
        });
    } catch (error: any) {
        console.error("Erro ao criar chamada:", error);
        return NextResponse.json({
            status: false,
            message: error?.message || "Falha ao iniciar chamada",
            error: error?.message
        }, { status: 500 });
    }
}

