import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { waManager } from "@/modules/whatsapp/manager";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid } = await params;
        const decodedJid = decodeURIComponent(jid);

        // Check if user can access this session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado a esta sessão", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        // Resolve database session to get the actual Baileys sessionId (handles cuid vs sessionId)
        const dbSession = await prisma.session.findFirst({
            where: {
                OR: [
                    { id: sessionId },
                    { sessionId: sessionId }
                ]
            }
        });

        if (!dbSession) {
            return NextResponse.json({ 
                status: false, 
                message: "Sessão não encontrada.", 
                error: "Session not found" 
            }, { status: 404 });
        }

        const actualSessionId = dbSession.sessionId;

        // Validate instance connection status
        let instance = waManager.getInstance(actualSessionId) || waManager.getInstance(sessionId);

        // Auto-recovery: if instance not active in memory but credentials exist in DB and not stopped
        if (!instance || !instance.socket) {
            const authCount = await prisma.authState.count({
                where: { sessionId: actualSessionId }
            });
            if (authCount > 0 && dbSession.status !== "STOPPED" && dbSession.status !== "LOGGED_OUT") {
                try {
                    await waManager.startSession(actualSessionId);
                    instance = waManager.getInstance(actualSessionId);
                } catch (err) {
                    console.error("Auto-start session error in media route:", err);
                }
            }
        }

        if (!instance || !instance.socket) {
            const statusDetail = dbSession.status === "CONNECTED" ? "reconectando" : (dbSession.status || "desconectada");
            return NextResponse.json({ 
                status: false, 
                message: `A sessão do WhatsApp está desconectada (${statusDetail}). Verifique o status da conexão em Sessões.`, 
                error: "Session disconnected" 
            }, { status: 400 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const type = (formData.get("type") as string) || "document"; // image, video, audio, document
        const caption = formData.get("caption") as string || "";
        const voiceProfile = (formData.get("voiceProfile") as any) || "broadcast";
        
        if (!file) {
             return NextResponse.json({ status: false, message: "Arquivo obrigatório", error: "file is required" }, { status: 400 });
        }

        // WhatsApp Channel (Newsletter) strictly enforces JPEG format for images
        if (decodedJid.includes('@newsletter') && type === 'image' && file.type !== 'image/jpeg') {
            return NextResponse.json(
                { 
                    status: false, 
                    message: "Canais do WhatsApp aceitam apenas imagens em formato JPG/JPEG.", 
                    error: "Unsupported media format for Newsletter" 
                }, 
                { status: 400 }
            );
        }
        const buffer = Buffer.from(await file.arrayBuffer());

        // Send via ChatService with actual Baileys sessionId & voiceProfile
        const sent = await ChatService.sendMediaMessage(
             actualSessionId, 
             decodedJid, 
             buffer, 
             type, 
             file.type, 
             file.name, 
             caption,
             voiceProfile
        );

        return NextResponse.json({ status: true, message: "Arquivo enviado com sucesso", data: sent });

    } catch (e: any) {
        console.error("Media send error:", e);
        const errorMsg = e?.message || "Falha ao enviar arquivo de mídia";
        return NextResponse.json({ status: false, message: errorMsg, error: errorMsg }, { status: 500 });
    }
}
