import fs from "fs/promises";
import path from "path";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { logger } from "@/lib/logger";
import crypto from "crypto";

export interface CallRoomMetadata {
    roomId: string;
    sessionId: string;
    jid: string;
    operatorName: string;
    contactName: string;
    createdAt: string;
}

export interface CallFeedbackRecord {
    id: string;
    roomId: string;
    sessionId?: string;
    jid?: string;
    operatorName?: string;
    contactName?: string;
    rating: number; // 1 to 5
    comment?: string;
    createdAt: string;
}

const ROOMS_FILE = path.join(process.cwd(), "data", "call-rooms.json");
const FEEDBACKS_FILE = path.join(process.cwd(), "data", "call-feedbacks.json");

// In-memory cache for fast lookup
const memoryRooms = new Map<string, CallRoomMetadata>();

export class CallFeedbackService {
    /**
     * Save call room metadata so we can map feedback back to the session/chat
     */
    static async registerRoom(data: CallRoomMetadata): Promise<void> {
        try {
            memoryRooms.set(data.roomId, data);
            let rooms: Record<string, CallRoomMetadata> = {};
            try {
                const content = await fs.readFile(ROOMS_FILE, "utf-8");
                rooms = JSON.parse(content);
            } catch {
                rooms = {};
            }
            rooms[data.roomId] = data;

            // Retain latest 500 rooms
            const entries = Object.entries(rooms);
            if (entries.length > 500) {
                const trimmed = Object.fromEntries(entries.slice(-500));
                await fs.writeFile(ROOMS_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
            } else {
                await fs.writeFile(ROOMS_FILE, JSON.stringify(rooms, null, 2), "utf-8");
            }
        } catch (e) {
            console.error("Erro ao registrar metadados da sala de chamada:", e);
        }
    }

    /**
     * Get metadata of a room
     */
    static async getRoom(roomId: string): Promise<CallRoomMetadata | null> {
        if (memoryRooms.has(roomId)) {
            return memoryRooms.get(roomId)!;
        }
        try {
            const content = await fs.readFile(ROOMS_FILE, "utf-8");
            const rooms: Record<string, CallRoomMetadata> = JSON.parse(content);
            if (rooms[roomId]) {
                memoryRooms.set(roomId, rooms[roomId]);
                return rooms[roomId];
            }
        } catch {}
        return null;
    }

    /**
     * Save feedback, send message to chat, and notify admin
     */
    static async saveFeedback(data: {
        roomId: string;
        rating: number;
        comment?: string;
        contactName?: string;
    }): Promise<CallFeedbackRecord> {
        const room = await this.getRoom(data.roomId);
        const record: CallFeedbackRecord = {
            id: `fb_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
            roomId: data.roomId,
            sessionId: room?.sessionId,
            jid: room?.jid,
            operatorName: room?.operatorName || "Atendente",
            contactName: room?.contactName || data.contactName || "Cliente",
            rating: Math.min(5, Math.max(1, data.rating)),
            comment: data.comment?.trim() || undefined,
            createdAt: new Date().toISOString()
        };

        // 1. Persist feedback to file
        try {
            let list: CallFeedbackRecord[] = [];
            try {
                const content = await fs.readFile(FEEDBACKS_FILE, "utf-8");
                list = JSON.parse(content);
            } catch {
                list = [];
            }
            list.unshift(record);
            if (list.length > 1000) list = list.slice(0, 1000);
            await fs.writeFile(FEEDBACKS_FILE, JSON.stringify(list, null, 2), "utf-8");
        } catch (e) {
            console.error("Erro ao salvar arquivo de feedback:", e);
        }

        // 2. Dispatch WhatsApp message directly to conversation if sessionId and jid exist
        if (record.sessionId && record.jid) {
            try {
                const starsVisual = "⭐".repeat(record.rating);
                const ratingLabels: Record<number, string> = {
                    1: "Muito insatisfeito",
                    2: "Insatisfeito",
                    3: "Regular",
                    4: "Bom",
                    5: "Excelente"
                };
                const label = ratingLabels[record.rating] || "Avaliado";

                const feedbackMessage = 
`⭐ *AVALIAÇÃO DO ATENDIMENTO DE VOZ*

• *Classificação:* ${starsVisual} (${record.rating}/5 • ${label})
• *Atendente:* ${record.operatorName}
• *Cliente:* ${record.contactName}
${record.comment ? `• *Comentário:* "${record.comment}"\n` : ""}
_Avaliação registrada com sucesso pelo cliente._`;

                await ChatService.sendTextMessage(record.sessionId, record.jid, { text: feedbackMessage });
                logger.info("CallFeedback", `Feedback enviado no chat do WhatsApp da sessão ${record.sessionId} para ${record.jid}`);
            } catch (err) {
                console.error("Falha ao enviar mensagem de feedback no chat do WhatsApp:", err);
            }
        }

        return record;
    }

    /**
     * Get all feedbacks and summary statistics for admin
     */
    static async getFeedbacksSummary(limit = 100): Promise<{
        feedbacks: CallFeedbackRecord[];
        total: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
        positivePercentage: number;
    }> {
        let list: CallFeedbackRecord[] = [];
        try {
            const content = await fs.readFile(FEEDBACKS_FILE, "utf-8");
            list = JSON.parse(content);
        } catch {
            list = [];
        }

        const total = list.length;
        const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;
        let positiveCount = 0;

        for (const item of list) {
            const r = Math.min(5, Math.max(1, item.rating));
            ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
            sum += r;
            if (r >= 4) positiveCount++;
        }

        const averageRating = total > 0 ? Number((sum / total).toFixed(1)) : 0;
        const positivePercentage = total > 0 ? Math.round((positiveCount / total) * 100) : 0;

        return {
            feedbacks: list.slice(0, limit),
            total,
            averageRating,
            ratingDistribution,
            positivePercentage
        };
    }
}
