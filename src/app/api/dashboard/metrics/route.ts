import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const requestedSessionId = searchParams.get("sessionId") || "all";
        const period = searchParams.get("period") || "7d";
        const departmentFilter = searchParams.get("department") || "all";

        const data = await getDashboardMetrics({
            userId: user.id,
            userRole: user.role || "OWNER",
            userEmail: user.email,
            requestedSessionId,
            period,
            departmentFilter,
        });

        return NextResponse.json({
            status: true,
            data,
        });
    } catch (error: any) {
        console.error("Dashboard metrics API error:", error);
        return NextResponse.json(
            { status: false, message: error.message || "Failed to calculate metrics" },
            { status: 500 }
        );
    }
}
