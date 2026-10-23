import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { 
    getTypebotConfig, 
    saveTypebotConfig, 
    getTypebotSummary, 
    saveTypebotFlow, 
    deleteTypebotFlow 
} from "@/modules/whatsapp/bot/typebot-engine";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado" }, { status: 403 });
        }

        const config = getTypebotConfig(sessionId);
        const flowSummary = getTypebotSummary(sessionId);

        return NextResponse.json({
            status: true,
            data: {
                config,
                flowSummary
            }
        });
    } catch (e: any) {
        console.error("Erro na API do Typebot (GET):", e);
        return NextResponse.json({ status: false, message: e.message || "Erro interno" }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado" }, { status: 403 });
        }

        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            // Upload do arquivo JSON do Typebot
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            if (!file) {
                return NextResponse.json({ status: false, message: "Nenhum arquivo enviado" }, { status: 400 });
            }

            const text = await file.text();
            let parsedJson: any;
            try {
                parsedJson = JSON.parse(text);
            } catch {
                return NextResponse.json({ status: false, message: "O arquivo selecionado não é um JSON válido do Typebot" }, { status: 400 });
            }

            if (!parsedJson.groups && !parsedJson.events) {
                return NextResponse.json({ status: false, message: "Estrutura do Typebot inválida (grupos e eventos não encontrados)" }, { status: 400 });
            }

            const summary = saveTypebotFlow(sessionId, parsedJson);
            // Ao enviar novo fluxo, ativa automaticamente o Typebot
            saveTypebotConfig(sessionId, { enabled: true });

            return NextResponse.json({
                status: true,
                message: `Fluxo "${summary.name}" importado com sucesso!`,
                data: {
                    flowSummary: summary,
                    config: getTypebotConfig(sessionId)
                }
            });
        } else {
            // Atualização de configurações (JSON)
            const body = await req.json();
            const updatedConfig = saveTypebotConfig(sessionId, body);

            return NextResponse.json({
                status: true,
                message: "Configurações do Typebot salvas com sucesso!",
                data: {
                    config: updatedConfig,
                    flowSummary: getTypebotSummary(sessionId)
                }
            });
        }
    } catch (e: any) {
        console.error("Erro na API do Typebot (POST):", e);
        return NextResponse.json({ status: false, message: e.message || "Erro interno" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado" }, { status: 403 });
        }

        deleteTypebotFlow(sessionId);
        saveTypebotConfig(sessionId, { enabled: false });

        return NextResponse.json({
            status: true,
            message: "Fluxo do Typebot removido com sucesso."
        });
    } catch (e: any) {
        console.error("Erro na API do Typebot (DELETE):", e);
        return NextResponse.json({ status: false, message: e.message || "Erro interno" }, { status: 500 });
    }
}
