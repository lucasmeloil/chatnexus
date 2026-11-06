import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { InternalChatService } from "@/modules/internal-chat/internal-chat.service";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const [members, unreadCounts] = await Promise.all([
            InternalChatService.getTeamMembers(user.id),
            InternalChatService.getUnreadCounts(user.id)
        ]);

        return NextResponse.json({
            status: true,
            data: {
                members,
                unreadCounts,
                currentUser: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao listar membros da equipe"
        }, { status: 500 });
    }
}

