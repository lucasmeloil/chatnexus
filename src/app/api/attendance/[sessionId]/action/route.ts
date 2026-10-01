import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { AttendanceService } from "@/modules/whatsapp/attendance.service";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { action, jid, targetUserId, targetUserName, departmentTag } = body;

        if (!jid) {
            return NextResponse.json({ status: false, message: "JID is required" }, { status: 400 });
        }

        let result: any = null;

        if (action === "accept") {
            const userName = user.name || "Atendente";
            result = await AttendanceService.acceptAttendance(sessionId, jid, user.id, userName);
        } else if (action === "close") {
            result = await AttendanceService.closeAttendance(sessionId, jid);
        } else if (action === "reject") {
            const deleteChat = body.deleteChat !== false;
            result = await AttendanceService.rejectAttendance(sessionId, jid, deleteChat);
        } else if (action === "reopen") {
            const userName = user.name || "Atendente";
            result = await AttendanceService.reopenAttendance(sessionId, jid, user.id, userName);
        } else if (action === "transfer") {
            result = await AttendanceService.transferAttendance(
                sessionId,
                jid,
                targetUserId || null,
                targetUserName || null,
                departmentTag || null
            );
        } else {
            return NextResponse.json({ status: false, message: "Invalid action" }, { status: 400 });
        }

        const globalIo = (global as any).io;
        if (globalIo) {
            globalIo.emit("attendance.update", { sessionId, jid, action, status: action === "reject" ? "CLOSED" : undefined, data: result });
            globalIo.to(sessionId).emit("attendance.update", { sessionId, jid, action, status: action === "reject" ? "CLOSED" : undefined, data: result });
            if (action === "reject") {
                globalIo.emit("chat.deleted", { sessionId, jid });
                globalIo.to(sessionId).emit("chat.deleted", { sessionId, jid });
            }
        }

        return NextResponse.json({
            status: true,
            message: `Attendance ${action}ed successfully`,
            data: result
        });
    } catch (error: any) {
        console.error("Attendance action error:", error);
        return NextResponse.json({ status: false, message: error.message || "Failed to process attendance action" }, { status: 500 });
    }
}
