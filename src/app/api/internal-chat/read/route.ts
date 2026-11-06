import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { InternalChatService } from "@/modules/internal-chat/internal-chat.service";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { senderId, channel } = body;

        await InternalChatService.markAsRead({
            currentUserId: user.id,
            senderId,
            channel
        });

        return NextResponse.json({ status: true });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao marcar como lido"
        }, { status: 500 });
    }
}
