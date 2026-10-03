import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { ChatService } from "@/modules/whatsapp/chat.service";

export const dynamic = 'force-dynamic';

interface IndividualItem {
    jid: string;
    name?: string;
    pix?: string;
    message: string;
    hasFile: boolean;
    fileIndex: number;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado à sessão", error: "Forbidden" }, { status: 403 });
        }

        const instance = waManager.getInstance(sessionId);
        if (!instance?.socket) {
            return NextResponse.json({ status: false, message: "Sessão do WhatsApp não está pronta ou desconectada", error: "Session not ready" }, { status: 503 });
        }

        const contentType = request.headers.get("content-type") || "";
        let mode: "standard" | "individual" = "standard";
        let delay = 2000;
        let sendPixSeparately = true;

        // --- Standard mode vars ---
        let recipients: string[] = [];
        let message = "";
        let standardFileBuffer: Buffer | null = null;
        let standardFileName = "";
        let standardMimeType = "";
        let standardMediaType: "image" | "document" = "document";

        // --- Individual mode vars ---
        let individualItems: IndividualItem[] = [];
        let fileBuffersMap: Map<number, { buffer: Buffer; name: string; mime: string; mediaType: "image" | "document" }> = new Map();

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const modeRaw = formData.get("mode");
            if (modeRaw === "individual") mode = "individual";

            const delayRaw = formData.get("delay");
            if (delayRaw) delay = Number(delayRaw) || 2000;

            const sendPixSepRaw = formData.get("sendPixSeparately");
            if (sendPixSepRaw !== null) {
                sendPixSeparately = sendPixSepRaw === "true" || sendPixSepRaw === "1";
            }

            if (mode === "individual") {
                const itemsRaw = formData.get("items") as string;
                if (!itemsRaw) {
                    return NextResponse.json({ status: false, message: "Nenhum cliente ou boleto configurado para envio individual", error: "Empty items" }, { status: 400 });
                }
                try {
                    individualItems = JSON.parse(itemsRaw);
                } catch {
                    return NextResponse.json({ status: false, message: "Formato de itens inválido", error: "Invalid JSON" }, { status: 400 });
                }

                // Extract all files into buffer map
                for (let i = 0; i < individualItems.length; i++) {
                    const item = individualItems[i];
                    if (item.hasFile && item.fileIndex >= 0) {
                        const file = formData.get(`file_${item.fileIndex}`) as File | null;
                        if (file && file.size > 0) {
                            const arrayBuf = await file.arrayBuffer();
                            const mime = file.type || "application/pdf";
                            fileBuffersMap.set(item.fileIndex, {
                                buffer: Buffer.from(arrayBuf),
                                name: file.name || "boleto.pdf",
                                mime,
                                mediaType: mime.startsWith("image/") ? "image" : "document"
                            });
                        }
                    }
                }

                recipients = individualItems.map(item => item.jid);
            } else {
                // Standard mode
                const recipientsRaw = formData.get("recipients");
                if (typeof recipientsRaw === "string") {
                    try {
                        recipients = JSON.parse(recipientsRaw);
                    } catch {
                        recipients = recipientsRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                    }
                }
                message = (formData.get("message") as string) || "";

                const file = formData.get("file") as File | null;
                if (file && file.size > 0) {
                    const arrayBuffer = await file.arrayBuffer();
                    standardFileBuffer = Buffer.from(arrayBuffer);
                    standardFileName = file.name || "arquivo";
                    standardMimeType = file.type || "application/octet-stream";
                    standardMediaType = standardMimeType.startsWith("image/") ? "image" : "document";
                }
            }
        } else {
            // JSON body
            const body = await request.json();
            mode = body.mode === "individual" ? "individual" : "standard";
            delay = body.delay || 2000;
            if (body.sendPixSeparately !== undefined) {
                sendPixSeparately = Boolean(body.sendPixSeparately);
            }

            if (mode === "individual") {
                individualItems = body.items || [];
                recipients = individualItems.map((item: any) => item.jid);
            } else {
                recipients = body.recipients || [];
                message = body.message || "";
            }
        }

        if (!Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ status: false, message: "Nenhum destinatário informado", error: "No recipients" }, { status: 400 });
        }

        if (mode === "standard" && !message.trim() && !standardFileBuffer) {
            return NextResponse.json({ status: false, message: "Informe uma mensagem ou anexe um arquivo para iniciar o disparo", error: "Empty message and file" }, { status: 400 });
        }

        // Summary message for the DB log
        const logMessage = mode === "individual"
            ? `📄 [Disparo Individualizado de Boletos / Cobranças] Total: ${recipients.length} destinatários com mensagens e arquivos personalizados.`
            : standardFileBuffer 
                ? `📎 [${standardMediaType === "image" ? "Imagem" : "PDF/Doc"}: ${standardFileName}] ${message}`.trim()
                : message;

        // Save BroadcastLog & recipients to DB
        const log = await prisma.broadcastLog.create({
            data: {
                sessionId,
                message: logMessage,
                total: recipients.length,
                delay: delay || 2000,
                status: "running",
                recipients: {
                    create: recipients.map(jid => ({
                        jid,
                        status: "pending"
                    }))
                }
            },
            include: { recipients: true }
        });

        const io = (global as any).io;
        const broadcastId = log.id;

        // Emit initial state
        if (io) {
            io.to(sessionId).emit("broadcast.progress", {
                broadcastId,
                status: "running",
                total: recipients.length,
                sent: 0,
                failed: 0,
                current: null,
                progress: 0,
                startedAt: log.startedAt.toISOString()
            });
        }

        // Process in background
        (async () => {
            let sent = 0;
            let failed = 0;
            const errors: { jid: string; error: string }[] = [];

            for (let i = 0; i < recipients.length; i++) {
                const jid = recipients[i];
                try {
                    const targetJid = await ChatService.resolveSendingJid(instance.socket!, jid);

                    if (mode === "individual") {
                        const item = individualItems[i];
                        const itemFile = item.hasFile && item.fileIndex >= 0 ? fileBuffersMap.get(item.fileIndex) : null;
                        const itemText = item.message || "";
                        const pixCode = item.pix?.trim();

                        if (itemFile) {
                            await ChatService.sendMediaMessage(
                                sessionId,
                                targetJid,
                                itemFile.buffer,
                                itemFile.mediaType,
                                itemFile.mime,
                                itemFile.name,
                                itemText
                            );
                        } else if (itemText) {
                            await ChatService.sendTextMessage(sessionId, targetJid, { text: itemText });
                        }

                        // Enviar código Pix Copia e Cola em mensagem separada a seguir para facilitar cópia
                        if (sendPixSeparately && pixCode) {
                            // Pausa segura de 1.5s para garantir a ordem (boleto primeiro, pix depois)
                            await new Promise(r => setTimeout(r, 1500));
                            await ChatService.sendTextMessage(sessionId, targetJid, { text: pixCode });
                        }
                    } else {
                        // Standard mode
                        if (standardFileBuffer) {
                            await ChatService.sendMediaMessage(
                                sessionId,
                                targetJid,
                                standardFileBuffer,
                                standardMediaType,
                                standardMimeType,
                                standardFileName,
                                message
                            );
                        } else {
                            await instance.socket!.sendMessage(targetJid, { text: message });
                        }
                    }

                    sent++;

                    // Update recipient status in DB
                    await prisma.broadcastRecipient.updateMany({
                        where: { broadcastLogId: broadcastId, jid },
                        data: { status: "sent", sentAt: new Date() }
                    });
                } catch (e: any) {
                    failed++;
                    errors.push({ jid, error: e.message || "Unknown error" });
                    console.error(`Failed to send broadcast to ${jid}:`, e);

                    // Update recipient error in DB
                    await prisma.broadcastRecipient.updateMany({
                        where: { broadcastLogId: broadcastId, jid },
                        data: { status: "failed", error: e.message || "Unknown error" }
                    });
                }

                const progress = Math.round(((sent + failed) / recipients.length) * 100);

                // Update BroadcastLog progress in DB
                await prisma.broadcastLog.update({
                    where: { id: broadcastId },
                    data: { sent, failed }
                });

                // Socket real-time progress
                if (io) {
                    io.to(sessionId).emit("broadcast.progress", {
                        broadcastId,
                        status: "running",
                        total: recipients.length,
                        sent,
                        failed,
                        current: jid,
                        progress
                    });
                }

                // Delay between sends
                if (i < recipients.length - 1) {
                    const baseDelay = delay || 2000;
                    const randomDelay = baseDelay + Math.floor(Math.random() * (baseDelay * 0.4));
                    await new Promise(r => setTimeout(r, randomDelay));
                }
            }

            // Mark as completed in DB
            await prisma.broadcastLog.update({
                where: { id: broadcastId },
                data: { status: "completed", sent, failed, completedAt: new Date() }
            });

            // Final socket emit
            if (io) {
                io.to(sessionId).emit("broadcast.progress", {
                    broadcastId,
                    status: "completed",
                    total: recipients.length,
                    sent,
                    failed,
                    errors,
                    progress: 100,
                    completedAt: new Date().toISOString()
                });
            }
            console.log(`Broadcast ${broadcastId} completed: ${sent} sent, ${failed} failed out of ${recipients.length}`);
        })();

        return NextResponse.json({
            status: true,
            message: mode === "individual"
                ? `Disparo de ${recipients.length} boletos/mensagens personalizadas iniciado!`
                : "Disparo em massa iniciado com sucesso!",
            data: { broadcastId: log.id, total: recipients.length }
        });

    } catch (e: any) {
        console.error("Broadcast error", e);
        return NextResponse.json({ status: false, message: e.message || "Falha ao iniciar disparo", error: e.message }, { status: 500 });
    }
}
