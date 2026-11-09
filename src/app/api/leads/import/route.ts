import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { LeadsService, CreateLeadDTO } from "@/modules/leads/leads.service";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const leads: CreateLeadDTO[] = Array.isArray(body?.leads) ? body.leads : [];

        if (leads.length === 0) {
            return NextResponse.json({ status: false, message: "Nenhum lead fornecido para importação" }, { status: 400 });
        }

        // Adiciona assignedTo padrão se não houver
        const leadsWithAssignee = leads.map(l => ({
            ...l,
            assignedTo: l.assignedTo || user.name || user.email
        }));

        const result = await LeadsService.importLeadsBatch(leadsWithAssignee);

        return NextResponse.json({
            status: true,
            message: `${result.imported} leads importados com sucesso!`,
            data: result
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao importar lote de leads"
        }, { status: 500 });
    }
}

