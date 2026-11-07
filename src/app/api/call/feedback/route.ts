import { NextResponse, NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomId, rating, comment, contactName } = body || {};

        if (!roomId || !rating || typeof rating !== "number" || rating < 1 || rating > 5) {
            return NextResponse.json({ 
                status: false, 
                message: "Parâmetros inválidos. É necessário informar roomId e uma nota de 1 a 5." 
            }, { status: 400 });
        }

        logger.info("CallFeedback", `Feedback recebido para sala ${roomId}: ${rating} estrelas. Comentário: "${comment || "Sem comentário"}" (Cliente: ${contactName || "Anônimo"})`);

        return NextResponse.json({
            status: true,
            message: "Avaliação registrada com sucesso. Muito obrigado pelo seu feedback!"
        });
    } catch (error: any) {
        console.error("Erro ao registrar avaliação de chamada:", error);
        return NextResponse.json({
            status: false,
            message: "Falha ao registrar feedback",
            error: error?.message
        }, { status: 500 });
    }
}
