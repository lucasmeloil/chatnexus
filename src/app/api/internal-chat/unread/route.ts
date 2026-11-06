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
        const sinceParam = searchParams.get("since");
        const sinceDate = sinceParam ? new Date(sinceParam) : null;

        const count = await InternalChatService.getUnreadCount(user.id, sinceDate);

        return NextResponse.json({
            status: true,
            unreadCount: count
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao consultar mensagens não lidas"
        }, { status: 500 });
    }
}

