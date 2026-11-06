import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { InternalChatService } from "@/modules/internal-chat/internal-chat.service";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const channel = searchParams.get("channel") || undefined;
        const otherUserId = searchParams.get("userId") || undefined;

        const messages = await InternalChatService.getMessages({
            channel,
            currentUserId: user.id,
            otherUserId,
            limit: 100
        });

        return NextResponse.json({
            status: true,
            data: messages
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao buscar mensagens internas"
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { receiverId, channel, content, customerJid, customerName } = body;

        if (!content || !content.trim()) {
            return NextResponse.json({ status: false, message: "Mensagem vazia" }, { status: 400 });
        }

        const message = await InternalChatService.sendMessage({
            senderId: user.id,
            senderName: user.name || user.email,
            senderRole: user.role,
            receiverId: receiverId || null,
            channel: receiverId ? null : (channel || "general"),
            content: content.trim(),
            customerJid: customerJid || null,
            customerName: customerName || null
        });

        // Broadcast real-time message via Socket.IO
        const globalIo = (global as any).io;
        if (globalIo) {
            globalIo.emit("internal_chat.message", message);
            if (receiverId) {
                globalIo.to(`user:${receiverId}`).emit("internal_chat.message", message);
                globalIo.to(`user:${user.id}`).emit("internal_chat.message", message);
            }
        }

        return NextResponse.json({
            status: true,
            data: message
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao enviar mensagem interna"
        }, { status: 500 });
    }
}

