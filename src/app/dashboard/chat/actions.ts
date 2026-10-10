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
    if (!sessionId) return [];

    const user = await getAuthenticatedUserForAction();
    if (!user) return [];

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) return [];

    // Resolve session by either sessionId string OR database cuid id
    let session = await prisma.session.findFirst({
        where: {
            OR: [
                { sessionId },
                { id: sessionId }
            ]
        },
        select: { id: true, sessionId: true }
    });

    if (!session) {
        const fallbackSession = await prisma.session.findFirst({
            where: user.role === "SUPERADMIN" ? {} : { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, sessionId: true }
        });
        if (fallbackSession) {
            session = fallbackSession;
        } else {
            return [];
        }
    }

    const effectiveSessionId = session.sessionId;
    const rawChats = await ChatService.getChatsList(session.id, limit, before, search);
    const attendancesMap = await AttendanceService.getAttendancesMap(effectiveSessionId);

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
    if (!sessionId || !jid) return { messages: [], hasMore: false };

    const user = await getAuthenticatedUserForAction();
    if (!user) return { messages: [], hasMore: false };

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) return { messages: [], hasMore: false };

    let session = await prisma.session.findFirst({
        where: {
            OR: [
                { sessionId },
                { id: sessionId }
            ]
        },
        select: { id: true, sessionId: true }
    });

    if (!session) {
        return { messages: [], hasMore: false };
    }

    const effectiveSessionId = session.sessionId;

    // Attendant Isolation Security Check:
    // Any user who is not a SUPERADMIN cannot view another attendant's in-progress conversation
    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(effectiveSessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Esta conversa está em atendimento por ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

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

    const session = await prisma.session.findFirst({
        where: {
            OR: [
                { sessionId },
                { id: sessionId }
            ]
        },
        select: { sessionId: true }
    });
    const effectiveSessionId = session?.sessionId || sessionId;

    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(effectiveSessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Você não tem permissão para enviar mensagens nesta conversa pois ela pertence a ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

    // Auto-accept if conversation is WAITING
    try {
        const attendance = await AttendanceService.getAttendance(effectiveSessionId, jid);
        if (!attendance || attendance.status === "WAITING") {
            const updated = await AttendanceService.acceptAttendance(effectiveSessionId, jid, user.id, user.name || "Atendente");
            const globalIo = (global as any).io;
            if (globalIo) {
                globalIo.emit("attendance.update", { sessionId: effectiveSessionId, jid, action: "accept", data: updated });
                globalIo.to(effectiveSessionId).emit("attendance.update", { sessionId: effectiveSessionId, jid, action: "accept", data: updated });
            }
        }
    } catch (e) {
        // non-fatal
    }

    try {
        await ChatService.sendTextMessage(effectiveSessionId, jid, { text }, undefined, quotedMessageId);
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

    const session = await prisma.session.findFirst({
        where: {
            OR: [
                { sessionId },
                { id: sessionId }
            ]
        },
        select: { sessionId: true }
    });
    const effectiveSessionId = session?.sessionId || sessionId;

    if (user.role !== "SUPERADMIN") {
        const attendance = await AttendanceService.getAttendance(effectiveSessionId, jid);
        if (attendance && attendance.status === "IN_PROGRESS" && attendance.assignedUserId && attendance.assignedUserId !== user.id) {
            throw new Error(`Você não tem permissão para enviar arquivos nesta conversa pois ela pertence a ${attendance.assignedUserName || "outro atendente"}.`);
        }
    }

    // Auto-accept if conversation is WAITING
    try {
        const attendance = await AttendanceService.getAttendance(effectiveSessionId, jid);
        if (!attendance || attendance.status === "WAITING") {
            const updated = await AttendanceService.acceptAttendance(effectiveSessionId, jid, user.id, user.name || "Atendente");
            const globalIo = (global as any).io;
            if (globalIo) {
                globalIo.emit("attendance.update", { sessionId: effectiveSessionId, jid, action: "accept", data: updated });
                globalIo.to(effectiveSessionId).emit("attendance.update", { sessionId: effectiveSessionId, jid, action: "accept", data: updated });
            }
        }
    } catch (e) {
        // non-fatal
    }

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await ChatService.sendMediaMessage(
            effectiveSessionId,
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

// Request past message history for a specific chat directly from the mobile device
export async function syncChatHistoryFromDevice(sessionId: string, jid: string, count = 50) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    return await ChatService.syncHistoryFromDevice(sessionId, jid, count);
}

