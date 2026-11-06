import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getAccessibleSessions } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/modules/whatsapp/attendance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        await AttendanceService.ensureTables();

        const accessibleSessions = await getAccessibleSessions(user.id, user.role);
        if (!accessibleSessions || accessibleSessions.length === 0) {
            return NextResponse.json({ status: true, count: 0, waitingCount: 0 });
        }

        const sessionIds = accessibleSessions.map(s => s.sessionId);

        // Count attendances currently in WAITING queue across accessible sessions
        const placeholders = sessionIds.map(() => "?").join(",");
        const waitingRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as cnt
            FROM \`ChatAttendance\`
            WHERE sessionId IN (${placeholders}) AND status = 'WAITING'
        `, ...sessionIds);

        const waitingCount = Number(waitingRows[0]?.cnt || 0);

        // For non-superadmins, also count their active assigned attendances
        let myInProgressCount = 0;
        if (user.role !== "SUPERADMIN") {
            const myRows = await prisma.$queryRawUnsafe<any[]>(`
                SELECT COUNT(*) as cnt
                FROM \`ChatAttendance\`
                WHERE sessionId IN (${placeholders}) AND assignedUserId = ? AND status = 'IN_PROGRESS'
            `, ...sessionIds, user.id);
            myInProgressCount = Number(myRows[0]?.cnt || 0);
        }

        // Total badge prioritizes waiting queue, or waiting + in progress if relevant
        const totalBadge = waitingCount;

        return NextResponse.json({
            status: true,
            count: totalBadge,
            waitingCount,
            myInProgressCount
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            count: 0,
            message: e.message || "Erro ao consultar badge do chat ao vivo"
        }, { status: 500 });
    }
}

