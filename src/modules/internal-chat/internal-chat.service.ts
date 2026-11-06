import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface InternalMessageRecord {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    receiverId: string | null;
    channel: string;
    content: string;
    customerJid: string | null;
    customerName: string | null;
    isRead: boolean;
    createdAt: string;
}

export class InternalChatService {
    private static tablesInitialized = false;

    static async ensureTables() {
        if (this.tablesInitialized) return;
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`InternalChatMessage\` (
                    \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
                    \`senderId\` VARCHAR(191) NOT NULL,
                    \`senderName\` VARCHAR(191) NOT NULL,
                    \`senderRole\` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
                    \`receiverId\` VARCHAR(191) NULL,
                    \`channel\` VARCHAR(100) NOT NULL DEFAULT 'general',
                    \`content\` TEXT NOT NULL,
                    \`customerJid\` VARCHAR(191) NULL,
                    \`customerName\` VARCHAR(191) NULL,
                    \`isRead\` TINYINT(1) NOT NULL DEFAULT 0,
                    \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY \`idx_channel_created\` (\`channel\`, \`createdAt\`),
                    KEY \`idx_direct_chat\` (\`senderId\`, \`receiverId\`, \`createdAt\`),
                    KEY \`idx_receiver_read\` (\`receiverId\`, \`isRead\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            this.tablesInitialized = true;
        } catch (e) {
            logger.error("InternalChat", "Failed to ensure InternalChatMessage table", e);
        }
    }

    static async sendMessage(params: {
        senderId: string;
        senderName: string;
        senderRole: string;
        receiverId?: string | null;
        channel?: string | null;
        content: string;
        customerJid?: string | null;
        customerName?: string | null;
    }): Promise<InternalMessageRecord> {
        await this.ensureTables();
        const id = `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const channel = params.receiverId ? "" : (params.channel || "general");
        const receiverId = params.receiverId || null;
        const now = new Date();

        await prisma.$executeRawUnsafe(`
            INSERT INTO \`InternalChatMessage\` 
            (id, senderId, senderName, senderRole, receiverId, channel, content, customerJid, customerName, isRead, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `,
            id,
            params.senderId,
            params.senderName,
            params.senderRole,
            receiverId,
            channel,
            params.content,
            params.customerJid || null,
            params.customerName || null,
            now
        );

        return {
            id,
            senderId: params.senderId,
            senderName: params.senderName,
            senderRole: params.senderRole,
            receiverId,
            channel,
            content: params.content,
            customerJid: params.customerJid || null,
            customerName: params.customerName || null,
            isRead: false,
            createdAt: now.toISOString()
        };
    }

    static async getMessages(params: {
        channel?: string;
        currentUserId: string;
        otherUserId?: string;
        limit?: number;
    }): Promise<InternalMessageRecord[]> {
        await this.ensureTables();
        const limit = params.limit || 100;

        try {
            if (params.channel) {
                const rows = await prisma.$queryRawUnsafe<any[]>(`
                    SELECT id, senderId, senderName, senderRole, receiverId, channel, content, customerJid, customerName, isRead, createdAt
                    FROM \`InternalChatMessage\`
                    WHERE channel = ?
                    ORDER BY createdAt ASC
                    LIMIT ?
                `, params.channel, limit);

                return rows.map(r => ({
                    ...r,
                    isRead: Boolean(r.isRead),
                    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt)
                }));
            }

            if (params.otherUserId) {
                const rows = await prisma.$queryRawUnsafe<any[]>(`
                    SELECT id, senderId, senderName, senderRole, receiverId, channel, content, customerJid, customerName, isRead, createdAt
                    FROM \`InternalChatMessage\`
                    WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
                    ORDER BY createdAt ASC
                    LIMIT ?
                `, params.currentUserId, params.otherUserId, params.otherUserId, params.currentUserId, limit);

                return rows.map(r => ({
                    ...r,
                    isRead: Boolean(r.isRead),
                    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt)
                }));
            }

            return [];
        } catch (e) {
            logger.error("InternalChat", "Error getting messages", e);
            return [];
        }
    }

    static async markAsRead(params: {
        currentUserId: string;
        senderId?: string;
        channel?: string;
    }): Promise<void> {
        await this.ensureTables();
        try {
            if (params.senderId) {
                await prisma.$executeRawUnsafe(`
                    UPDATE \`InternalChatMessage\`
                    SET isRead = 1
                    WHERE receiverId = ? AND senderId = ? AND isRead = 0
                `, params.currentUserId, params.senderId);
            }
        } catch (e) {
            logger.error("InternalChat", "Error marking as read", e);
        }
    }

    static async getUnreadCounts(currentUserId: string): Promise<Record<string, number>> {
        await this.ensureTables();
        try {
            const rows = await prisma.$queryRawUnsafe<any[]>(`
                SELECT senderId, COUNT(*) as count
                FROM \`InternalChatMessage\`
                WHERE receiverId = ? AND isRead = 0
                GROUP BY senderId
            `, currentUserId);

            const counts: Record<string, number> = {};
            for (const r of rows) {
                counts[r.senderId] = Number(r.count);
            }
            return counts;
        } catch (e) {
            logger.error("InternalChat", "Error getting unread counts", e);
            return {};
        }
    }

    static async getTeamMembers(currentUserId: string) {
        try {
            const users = await prisma.user.findMany({
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true
                }
            });

            return users;
        } catch (e) {
            logger.error("InternalChat", "Error getting team members", e);
            return [];
        }
    }
}
