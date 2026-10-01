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

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ success: false, message: "Não autorizado" }, { status: 401 });
        }

        const list = getQuickReplies();
        return NextResponse.json({ success: true, data: list });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ success: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        let { shortcut, title, content, category } = body;

        if (!shortcut || !content) {
            return NextResponse.json({ success: false, message: "Atalho e mensagem são obrigatórios" }, { status: 400 });
        }

        // Clean shortcut to ensure starting with /
        shortcut = shortcut.trim();
        if (!shortcut.startsWith("/")) {
            shortcut = "/" + shortcut;
        }
        shortcut = shortcut.toLowerCase().replace(/\s+/g, "");

        const list = getQuickReplies();

        // Check duplicate shortcut
        const existing = list.find((item: any) => item.shortcut.toLowerCase() === shortcut);
        if (existing) {
            return NextResponse.json({ success: false, message: `O atalho ${shortcut} já está cadastrado.` }, { status: 400 });
        }

        const newReply = {
            id: `qr-${Date.now()}`,
            shortcut,
            title: (title || shortcut).trim(),
            content: content.trim(),
            category: (category || "Geral").trim(),
            createdAt: new Date().toISOString(),
        };

        list.push(newReply);
        saveQuickReplies(list);

        return NextResponse.json({ success: true, data: newReply }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
