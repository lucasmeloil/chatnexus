import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "quick-replies.json");

function getQuickReplies() {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function saveQuickReplies(data: any[]) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ success: false, message: "Não autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        let { shortcut, title, content, category } = body;

        const list = getQuickReplies();
        const index = list.findIndex((item: any) => item.id === id);

        if (index === -1) {
            return NextResponse.json({ success: false, message: "Resposta rápida não encontrada" }, { status: 404 });
        }

        if (shortcut) {
            shortcut = shortcut.trim();
            if (!shortcut.startsWith("/")) shortcut = "/" + shortcut;
            shortcut = shortcut.toLowerCase().replace(/\s+/g, "");

            // Verify no other item has same shortcut
            const conflict = list.find((item: any) => item.id !== id && item.shortcut.toLowerCase() === shortcut);
            if (conflict) {
                return NextResponse.json({ success: false, message: `O atalho ${shortcut} já está em uso.` }, { status: 400 });
            }
            list[index].shortcut = shortcut;
        }

        if (title !== undefined) list[index].title = title.trim();
        if (content !== undefined) list[index].content = content.trim();
        if (category !== undefined) list[index].category = category.trim();
        list[index].updatedAt = new Date().toISOString();

        saveQuickReplies(list);
        return NextResponse.json({ success: true, data: list[index] });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ success: false, message: "Não autorizado" }, { status: 401 });
        }

        const { id } = await params;
        let list = getQuickReplies();
        const initialLen = list.length;
        list = list.filter((item: any) => item.id !== id);

        if (list.length === initialLen) {
            return NextResponse.json({ success: false, message: "Resposta rápida não encontrada" }, { status: 404 });
        }

        saveQuickReplies(list);
        return NextResponse.json({ success: true, message: "Resposta rápida removida com sucesso" });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
