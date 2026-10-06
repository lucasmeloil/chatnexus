import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// DELETE: Delete message for everyone
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string; messageId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid, messageId } = await params;

        // Check if user can access this session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const instance = waManager.getInstance(sessionId);
        if (!instance?.socket) {
            return NextResponse.json({ status: false, message: "Session not ready", error: "Session not ready" }, { status: 503 });
        }

        const decodedJid = decodeURIComponent(jid);

        // Delete message for everyone
        await instance.socket.sendMessage(decodedJid, { delete: {
            remoteJid: decodedJid,
            fromMe: true,
            id: messageId,
            participant: undefined
        }});

        return NextResponse.json({ status: true, message: "Message deleted for everyone" });

    } catch (error: any) {
        console.error("Delete message error:", error);
        
        if (error.message?.includes("too old") || error.message?.includes("time limit")) {
            return NextResponse.json({ status: false, message: "Cannot delete message older than 7 minutes", error: "Cannot delete message older than 7 minutes" }, { status: 400 });
        }
        
        return NextResponse.json({ status: false, message: "Failed to delete message", error: "Failed to delete message" }, { status: 500 });
    }
}

// PATCH: Edit a sent message
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string; messageId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid, messageId } = await params;
        const body = await request.json().catch(() => ({}));
        const { text, mode } = body;

        if (!text || typeof text !== "string" || !text.trim()) {
            return NextResponse.json({ status: false, message: "Text is required to edit message", error: "Bad Request" }, { status: 400 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const instance = waManager.getInstance(sessionId);
        if (!instance?.socket) {
            return NextResponse.json({ status: false, message: "Session not ready", error: "Session not ready" }, { status: 503 });
        }

        const decodedJid = decodeURIComponent(jid);

        // Buscar a sessão no banco para obter o id interno
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        // Buscar mensagem original para validar chave exata, tempo e se foi enviada por mim
        let originalMsg = null;
        if (session) {
            originalMsg = await prisma.message.findUnique({
                where: {
                    sessionId_keyId: {
                        sessionId: session.id,
                        keyId: messageId
                    }
                }
            });
        }

        // Se a mensagem existir e não for nossa (fromMe !== true), não é permitido editar
        if (originalMsg && !originalMsg.fromMe) {
            return NextResponse.json({
                status: false,
                message: "Apenas mensagens enviadas por você podem ser editadas",
                error: "Forbidden"
            }, { status: 400 });
        }

        const targetJid = originalMsg?.remoteJid || decodedJid;

        // Validar tempo limite do protocolo oficial do WhatsApp (15 minutos)
        const msgTimestamp = originalMsg?.timestamp ? new Date(originalMsg.timestamp).getTime() : 0;
        const ageMs = msgTimestamp > 0 ? (Date.now() - msgTimestamp) : 0;
        const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
        const isExpired = msgTimestamp > 0 && ageMs > FIFTEEN_MINUTES_MS;

        // Se o tempo de 15 minutos foi excedido e não solicitou explicitamente o modo de correção
        if (isExpired && mode !== "resend_correction") {
            const ageMinutes = Math.ceil(ageMs / (60 * 1000));
            return NextResponse.json({
                status: false,
                expired: true,
                ageMinutes,
                message: `Esta mensagem foi enviada há ${ageMinutes} minutos. O WhatsApp só permite editar mensagens em até 15 minutos do envio. Deseja enviar como uma mensagem de correção?`,
                error: "TIME_LIMIT_EXCEEDED"
            }, { status: 400 });
        }

        // Modo envio de correção citando a anterior (caso > 15 min ou solicitado explicitamente)
        if (mode === "resend_correction") {
            const correctionText = `*Correção:*\n${text.trim()}`;
            
            const quotedMsgKey: any = {
                remoteJid: targetJid,
                fromMe: originalMsg?.fromMe ?? true,
                id: messageId
            };
            if (targetJid.endsWith("@g.us") && originalMsg?.senderJid) {
                quotedMsgKey.participant = originalMsg.senderJid;
            }

            const quotedMessageContent = originalMsg?.content 
                ? { extendedTextMessage: { text: originalMsg.content } }
                : { extendedTextMessage: { text: "" } };

            await instance.socket.sendMessage(targetJid, {
                text: correctionText
            }, {
                quoted: {
                    key: quotedMsgKey,
                    message: quotedMessageContent
                } as any
            });

            return NextResponse.json({
                status: true,
                mode: "resend_correction",
                message: "Mensagem de correção enviada com sucesso citando a mensagem original!"
            });
        }

        // Envio de edição nativa pelo protocolo WhatsApp Baileys (<= 15 min)
        await instance.socket.sendMessage(targetJid, {
            text: text.trim(),
            edit: {
                remoteJid: targetJid,
                id: messageId,
                fromMe: true
            }
        });

        // Atualizar imediatamente no banco de dados local
        if (session) {
            await prisma.message.updateMany({
                where: { sessionId: session.id, keyId: messageId },
                data: { content: text.trim() }
            });
        }

        // Notificar operadores em tempo real via Socket.IO
        const io = (global as any).io;
        io?.to(sessionId).emit("message.edited", {
            keyId: messageId,
            remoteJid: targetJid,
            newContent: text.trim()
        });

        return NextResponse.json({ status: true, message: "Mensagem editada com sucesso no WhatsApp!" });
    } catch (error: any) {
        console.error("Edit message error:", error);
        return NextResponse.json({ status: false, message: "Falha ao editar mensagem no WhatsApp", error: error.message || "Failed to edit message" }, { status: 500 });
    }
}
