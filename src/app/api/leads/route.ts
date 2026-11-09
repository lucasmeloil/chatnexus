import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { LeadsService } from "@/modules/leads/leads.service";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;
        const segment = searchParams.get("segment") || undefined;
        const filterDate = searchParams.get("filterDate") as any || undefined;

        const [leads, metrics] = await Promise.all([
            LeadsService.listLeads({ search, status, segment, filterDate }),
            LeadsService.getMetrics()
        ]);

        return NextResponse.json({
            status: true,
            data: {
                leads,
                metrics
            }
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao listar leads"
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { companyName, ownerName, phone } = body;

        if (!companyName || !companyName.trim()) {
            return NextResponse.json({ status: false, message: "Nome da empresa é obrigatório" }, { status: 400 });
        }
        if (!ownerName || !ownerName.trim()) {
            return NextResponse.json({ status: false, message: "Nome do dono ou responsável é obrigatório" }, { status: 400 });
        }
        if (!phone || !phone.trim()) {
            return NextResponse.json({ status: false, message: "Telefone ou WhatsApp é obrigatório" }, { status: 400 });
        }

        const lead = await LeadsService.createLead({
            ...body,
            assignedTo: body.assignedTo || user.name || user.email
        });

        return NextResponse.json({
            status: true,
            message: "Lead cadastrado com sucesso",
            data: lead
        });
    } catch (e: any) {
        return NextResponse.json({
            status: false,
            message: e.message || "Erro ao criar lead"
        }, { status: 500 });
    }
}

