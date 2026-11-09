import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { LeadsService } from "@/modules/leads/leads.service";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await req.json();
        const { type, notes, nextContactAt, newStatus } = body;

        if (!notes || !notes.trim()) {
            return NextResponse.json({ status: false, message: "Anotação do contato é obrigatória" }, { status: 400 });
        }

        const activity = await LeadsService.addActivity(id, {
            type: type || "WHATSAPP",
            notes: notes.trim(),
            nextContactAt: nextContactAt || null,
            newStatus: newStatus || undefined,
            createdBy: user.name || user.email || "Atendente"
        });

        return NextResponse.json({
            status: true,
            message: "Contato registrado com sucesso",
            data: activity
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao registrar contato"
        }, { status: 500 });
    }
}

