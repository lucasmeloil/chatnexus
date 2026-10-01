import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { AttendanceService } from "@/modules/whatsapp/attendance.service";
import { prisma } from "@/lib/prisma";

export async function GET(
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

        const attendancesMap = await AttendanceService.getAttendancesMap(sessionId);
        const attendantConfig = await AttendanceService.getAttendantConfig(user.id);
        const allowedTags = attendantConfig?.allowedTags || [];

        const attendances = Array.from(attendancesMap.values()).map(att => ({
            id: att.id,
            sessionId: att.sessionId,
            chatJid: att.chatJid,
            assignedUserId: att.assignedUserId,
            assignedUserName: att.assignedUserName,
            departmentTag: att.departmentTag,
            status: att.status,
            createdAt: att.createdAt,
            updatedAt: att.updatedAt,
            closedAt: att.closedAt,
            isMine: att.assignedUserId === user.id
        }));

        return NextResponse.json({
            status: true,
            data: {
                attendances,
                currentUser: {
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    allowedTags
                }
            }
        });
    } catch (error: any) {
        console.error("Attendance GET error:", error);
        return NextResponse.json({ status: false, message: error.message || "Failed to fetch attendance" }, { status: 500 });
    }
}
