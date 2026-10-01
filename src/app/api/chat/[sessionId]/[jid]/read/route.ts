import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/modules/whatsapp/attendance.service";

// PUT: Mark messages as read
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid } = await params;
        let body: any = {};
        try {
            body = await request.json();
        } catch {}
        const { messageIds } = body;

        // Check if user can access this session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        // Decode JID from URL parameter & get all representation candidates
        const decodedJid = decodeURIComponent(jid);
        const candidates = AttendanceService.getJidCandidates(decodedJid);

        // 1. Mark in Database: update all incoming unread messages to READ
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (session) {
            await prisma.message.updateMany({
                where: {
                    sessionId: session.id,
                    remoteJid: { in: candidates },
                    fromMe: false,
                    status: { not: "READ" }
                },
                data: {
                    status: "READ"
                }
            });
        }

        // 2. Mark in WhatsApp / Baileys socket if available
        const instance = waManager.getInstance(sessionId);
        if (instance?.socket) {
            try {
                if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
                    for (const messageId of messageIds) {
                        await instance.socket.readMessages([{
                            remoteJid: decodedJid,
                            id: messageId,
                            participant: undefined
                        }]);
                    }
                } else {
                    await instance.socket.chatModify(
                        { markRead: true, lastMessages: [] },
                        decodedJid
                    );
                }
            } catch (sockErr) {
                // Non-fatal if socket is busy
            }
        }

        return NextResponse.json({ status: true, message: "Messages marked as read" });

    } catch (error) {
        console.error("Mark as read error:", error);
        return NextResponse.json({ status: false, message: "Failed to mark messages as read", error: "Failed to mark messages as read" }, { status: 500 });
    }
}
