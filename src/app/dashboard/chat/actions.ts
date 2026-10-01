"use server";

import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { getAuthenticatedUserForAction } from "@/lib/server-action-auth";
import { canAccessSession } from "@/lib/api-auth";

import { AttendanceService } from "@/modules/whatsapp/attendance.service";

const CHAT_PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

// Fetch chat list with cursor-based pagination & search, enriched with attendance
export async function getChatsStatus(
    sessionId: string,
    limit = CHAT_PAGE_SIZE,
    before?: string,
    search?: string
) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");

    const rawChats = await ChatService.getChatsList(session.id, limit, before, search);
    const attendancesMap = await AttendanceService.getAttendancesMap(sessionId);

    return rawChats.map((chat: any) => {
        const att = attendancesMap.get(chat.jid);
        return {
            ...chat,
            unreadCount: att?.status === "CLOSED" ? 0 : (chat.unreadCount || 0),
            attendance: att ? {
                id: att.id,
                status: att.status,
                assignedUserId: att.assignedUserId,
                assignedUserName: att.assignedUserName,
                departmentTag: att.departmentTag,
                closedAt: att.closedAt
            } : {
                status: "WAITING",
                assignedUserId: null,
                assignedUserName: null,
                departmentTag: null,
                closedAt: null
            }
        };
    });
}

// Fetch messages for a specific chat with cursor pagination
export async function getChatMessages(
    sessionId: string,
    jid: string,
    limit = 50,
    before?: string
) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    // Attendant Isolation Security Check:
    // Any user who is not a SUPERADMIN cannot view another attendant's in-progress conversation
    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(sessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Esta conversa está em atendimento por ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");

    const { messages, hasMore } = await ChatService.getMessages(session.id, jid, limit, before);

    return {
        messages: messages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date
                ? msg.timestamp.toISOString()
                : String(msg.timestamp)
        })),
        hasMore
    };
}

// Send a basic text message
export async function sendChatMessage(sessionId: string, jid: string, text: string, quotedMessageId?: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(sessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Você não tem permissão para enviar mensagens nesta conversa pois ela pertence a ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

    // Auto-accept if conversation is WAITING
    try {
        const attendance = await AttendanceService.getAttendance(sessionId, jid);
        if (!attendance || attendance.status === "WAITING") {
            const updated = await AttendanceService.acceptAttendance(sessionId, jid, user.id, user.name || "Atendente");
            const globalIo = (global as any).io;
            if (globalIo) {
                globalIo.emit("attendance.update", { sessionId, jid, action: "accept", data: updated });
                globalIo.to(sessionId).emit("attendance.update", { sessionId, jid, action: "accept", data: updated });
            }
        }
    } catch (e) {
        // non-fatal
    }

    try {
        await ChatService.sendTextMessage(sessionId, jid, { text }, undefined, quotedMessageId);
        return { success: true };
    } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

// Upload and Send Media
export async function sendMediaMessage(formData: FormData) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const sessionId = formData.get("sessionId") as string;
    const jid = formData.get("jid") as string;
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const caption = formData.get("caption") as string || "";

    if (!sessionId || !jid || !file || !type) {
        throw new Error("Missing required fields");
    }

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(sessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Você não tem permissão para enviar arquivos nesta conversa pois ela pertence a ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

    // Auto-accept if conversation is WAITING
    try {
        const attendance = await AttendanceService.getAttendance(sessionId, jid);
        if (!attendance || attendance.status === "WAITING") {
            const updated = await AttendanceService.acceptAttendance(sessionId, jid, user.id, user.name || "Atendente");
            const globalIo = (global as any).io;
            if (globalIo) {
                globalIo.emit("attendance.update", { sessionId, jid, action: "accept", data: updated });
                globalIo.to(sessionId).emit("attendance.update", { sessionId, jid, action: "accept", data: updated });
            }
        }
    } catch (e) {
        // non-fatal
    }

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await ChatService.sendMediaMessage(
            sessionId,
            jid,
            buffer,
            type,
            file.type,
            file.name,
            caption
        );

        return { success: true };
    } catch (error: any) {
        console.error("Media send error:", error);
        throw new Error(`Failed to send media: ${error.message}`);
    }
}
