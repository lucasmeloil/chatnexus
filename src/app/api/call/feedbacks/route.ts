import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { CallFeedbackService } from "@/modules/call/call-feedback.service";

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "100", 10);

        const summary = await CallFeedbackService.getFeedbacksSummary(limit);

        return NextResponse.json({
            status: true,
            data: summary
        });
    } catch (error: any) {
        console.error("Erro ao listar feedbacks:", error);
        return NextResponse.json({
            status: false,
            message: "Falha ao buscar avaliações",
            error: error?.message
        }, { status: 500 });
    }
}
