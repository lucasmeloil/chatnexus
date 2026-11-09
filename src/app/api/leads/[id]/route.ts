import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { LeadsService } from "@/modules/leads/leads.service";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { id } = await context.params;
        const result = await LeadsService.getLeadById(id);

        if (!result.lead) {
            return NextResponse.json({ status: false, message: "Lead não encontrado" }, { status: 404 });
        }

        return NextResponse.json({
            status: true,
            data: result
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao buscar lead"
        }, { status: 500 });
    }
}

export async function PUT(
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

        const updated = await LeadsService.updateLead(id, body);

        if (!updated) {
            return NextResponse.json({ status: false, message: "Lead não encontrado para atualização" }, { status: 404 });
        }

        return NextResponse.json({
            status: true,
            message: "Lead atualizado com sucesso",
            data: updated
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao atualizar lead"
        }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { id } = await context.params;
        const success = await LeadsService.deleteLead(id);

        if (!success) {
            return NextResponse.json({ status: false, message: "Lead não encontrado para exclusão" }, { status: 404 });
        }

        return NextResponse.json({
            status: true,
            message: "Lead removido com sucesso"
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao excluir lead"
        }, { status: 500 });
    }
}

