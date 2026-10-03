import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AttendanceStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";

export interface AttendanceRecord {
    id: string;
    sessionId: string;
    chatJid: string;
    assignedUserId: string | null;
    assignedUserName: string | null;
    departmentTag: string | null;
    status: AttendanceStatus;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
}

export interface AttendantConfigRecord {
    id: string;
    userId: string;
    allowedTags: string[]; // e.g. ["Comercial", "Financeiro"]
}

export class AttendanceService {
    private static tablesInitialized = false;

    /**
     * Ensure MySQL tables exist.
     */
    static async ensureTables() {
        if (this.tablesInitialized) return;
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`ChatAttendance\` (
                    \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
                    \`sessionId\` VARCHAR(191) NOT NULL,
                    \`chatJid\` VARCHAR(191) NOT NULL,
                    \`assignedUserId\` VARCHAR(191) NULL,
                    \`assignedUserName\` VARCHAR(191) NULL,
                    \`departmentTag\` VARCHAR(191) NULL,
                    \`status\` VARCHAR(50) NOT NULL DEFAULT 'WAITING',
                    \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    \`closedAt\` DATETIME NULL,
                    UNIQUE KEY \`uniq_session_chat\` (\`sessionId\`, \`chatJid\`),
                    KEY \`idx_session_status\` (\`sessionId\`, \`status\`),
                    KEY \`idx_assigned\` (\`assignedUserId\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`AttendantConfig\` (
                    \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
                    \`userId\` VARCHAR(191) NOT NULL UNIQUE,
                    \`allowedTags\` TEXT NULL,
                    \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.tablesInitialized = true;
            logger.info("Attendance", "Attendance tables verified / initialized successfully");
        } catch (e) {
            logger.error("Attendance", "Failed to ensure attendance tables", e);
        }
    }

    /**
     * Generate all candidate JID representations for a given chatJid (Brazilian 12/13 digits, @c.us, @s.whatsapp.net).
     */
    static getJidCandidates(chatJid: string): string[] {
        if (!chatJid) return [];
        const set = new Set<string>();
        set.add(chatJid);

        const cleanDigits = chatJid.replace(/@.*$/, "").replace(/\D/g, "");
        if (cleanDigits) {
            set.add(`${cleanDigits}@s.whatsapp.net`);
            set.add(`${cleanDigits}@c.us`);

            // Brazilian format handling
            if (cleanDigits.startsWith("55")) {
                if (cleanDigits.length === 13 && cleanDigits[4] === "9") {
                    const withoutNine = `${cleanDigits.slice(0, 4)}${cleanDigits.slice(5)}`;
                    set.add(`${withoutNine}@s.whatsapp.net`);
                    set.add(`${withoutNine}@c.us`);
                } else if (cleanDigits.length === 12) {
                    const withNine = `${cleanDigits.slice(0, 4)}9${cleanDigits.slice(4)}`;
                    set.add(`${withNine}@s.whatsapp.net`);
                    set.add(`${withNine}@c.us`);
                }
            } else if (cleanDigits.length === 11 && cleanDigits[2] === "9") {
                const with55 = `55${cleanDigits}`;
                const withoutNine = `55${cleanDigits.slice(0, 2)}${cleanDigits.slice(3)}`;
                set.add(`${with55}@s.whatsapp.net`);
                set.add(`${with55}@c.us`);
                set.add(`${withoutNine}@s.whatsapp.net`);
                set.add(`${withoutNine}@c.us`);
            } else if (cleanDigits.length === 10) {
                const with55 = `55${cleanDigits}`;
                const withNine = `55${cleanDigits.slice(0, 2)}9${cleanDigits.slice(2)}`;
                set.add(`${with55}@s.whatsapp.net`);
                set.add(`${with55}@c.us`);
                set.add(`${withNine}@s.whatsapp.net`);
                set.add(`${withNine}@c.us`);
            }
        }
        return Array.from(set);
    }

    /**
     * Get attendance record for a specific chat.
     * Searches all candidate representations and prioritizes IN_PROGRESS over WAITING or CLOSED.
     */
    static async getAttendance(sessionId: string, chatJid: string): Promise<AttendanceRecord | null> {
        await this.ensureTables();
        try {
            const jidList = this.getJidCandidates(chatJid);
            const placeholders = jidList.map(() => "?").join(", ");
            const rows = await prisma.$queryRawUnsafe<AttendanceRecord[]>(
                `SELECT * FROM \`ChatAttendance\` 
                 WHERE sessionId = ? AND chatJid IN (${placeholders}) 
                 ORDER BY 
                    CASE status 
                        WHEN 'IN_PROGRESS' THEN 1 
                        WHEN 'WAITING' THEN 2 
                        WHEN 'CLOSED' THEN 3 
                        ELSE 4 
                    END ASC, 
                    updatedAt DESC 
                 LIMIT 1`,
                sessionId,
                ...jidList
            );
            return rows[0] || null;
        } catch (e) {
            logger.error("Attendance", `Error fetching attendance for ${chatJid}`, e);
            return null;
        }
    }

    /**
     * Get all attendances for a session as a map keyed by chatJid.
     * Also indexes all candidate JID representations and guarantees IN_PROGRESS takes absolute priority.
     */
    static async getAttendancesMap(sessionId: string): Promise<Map<string, AttendanceRecord>> {
        await this.ensureTables();
        const map = new Map<string, AttendanceRecord>();
        try {
            const rows = await prisma.$queryRawUnsafe<AttendanceRecord[]>(
                `SELECT * FROM \`ChatAttendance\` 
                 WHERE sessionId = ? 
                 ORDER BY 
                    CASE status 
                        WHEN 'CLOSED' THEN 1 
                        WHEN 'WAITING' THEN 2 
                        WHEN 'IN_PROGRESS' THEN 3 
                        ELSE 0 
                    END ASC, 
                    updatedAt ASC`,
                sessionId
            );
            for (const r of rows) {
                const candidates = this.getJidCandidates(r.chatJid);
                for (const c of candidates) {
                    const existing = map.get(c);
                    // IN_PROGRESS always takes precedence over WAITING or CLOSED
                    if (!existing || existing.status !== "IN_PROGRESS" || r.status === "IN_PROGRESS") {
                        map.set(c, r);
                    }
                }
            }
        } catch (e) {
            logger.error("Attendance", `Error fetching attendance map for ${sessionId}`, e);
        }
        return map;
    }

    /**
     * Called when an incoming customer message arrives.
     * If the attendance is already IN_PROGRESS, it returns the record immediately without modifying status.
     * If the attendance was CLOSED, or doesn't exist, it puts the chat into WAITING (Atendimento em Espera).
     */
    static async handleIncomingMessage(sessionId: string, chatJid: string): Promise<AttendanceRecord | null> {
        // Ignore broadcast status stories and newsletters
        if (chatJid.includes("status@broadcast") || chatJid.includes("@broadcast") || chatJid.includes("@newsletter")) {
            return null;
        }

        await this.ensureTables();
        try {
            const existing = await this.getAttendance(sessionId, chatJid);
            const now = new Date();

            // CRITICAL: If attendance is ALREADY IN_PROGRESS with an attendant, NEVER RESET!
            if (existing && existing.status === "IN_PROGRESS") {
                return existing;
            }

            // If already WAITING, keep waiting
            if (existing && existing.status === "WAITING") {
                return existing;
            }

            // Check if this chat has the "Finalizado" label
            const finLabels = await prisma.label.findMany({
                where: { sessionId, name: { equals: "Finalizado" } },
                select: { id: true }
            });
            let hasFinalizadoLabel = false;
            if (finLabels.length > 0) {
                const candidates = this.getJidCandidates(chatJid);
                const count = await prisma.chatLabel.count({
                    where: {
                        labelId: { in: finLabels.map(l => l.id) },
                        chatJid: { in: candidates }
                    }
                });
                hasFinalizadoLabel = count > 0;
            }

            if (!existing) {
                // Create new attendance in WAITING status (Fila de espera)
                const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await prisma.$executeRawUnsafe(
                    `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, status, createdAt, updatedAt)
                     VALUES (?, ?, ?, 'WAITING', ?, ?)`,
                    id,
                    sessionId,
                    chatJid,
                    now,
                    now
                );
                return await this.getAttendance(sessionId, chatJid);
            }

            // If the chat was CLOSED or marked as Finalizado, reopening into WAITING state
            if (existing.status === "CLOSED" || hasFinalizadoLabel) {
                const candidates = this.getJidCandidates(chatJid);
                const placeholders = candidates.map(() => "?").join(", ");
                await prisma.$executeRawUnsafe(
                    `UPDATE \`ChatAttendance\` 
                     SET status = 'WAITING', assignedUserId = NULL, assignedUserName = NULL, closedAt = NULL, updatedAt = ?
                     WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                    now,
                    sessionId,
                    existing.id,
                    ...candidates
                );

                // Remove "Finalizado" label from prisma if present
                if (finLabels.length > 0) {
                    await prisma.chatLabel.deleteMany({
                        where: {
                            labelId: { in: finLabels.map(l => l.id) },
                            chatJid: { in: candidates }
                        }
                    });
                }

                return await this.getAttendance(sessionId, chatJid);
            }

            return existing;
        } catch (e) {
            logger.error("Attendance", `Error handling incoming message for ${chatJid}`, e);
            return null;
        }
    }

    /**
     * An attendant accepts a conversation from "Em Espera".
     */
    static async acceptAttendance(
        sessionId: string,
        chatJid: string,
        userId: string,
        userName: string
    ): Promise<AttendanceRecord | null> {
        await this.ensureTables();
        const now = new Date();
        const existing = await this.getAttendance(sessionId, chatJid);
        const candidates = this.getJidCandidates(chatJid);
        const placeholders = candidates.map(() => "?").join(", ");

        if (!existing) {
            const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await prisma.$executeRawUnsafe(
                `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, assignedUserId, assignedUserName, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)`,
                id,
                sessionId,
                chatJid,
                userId,
                userName,
                now,
                now
            );
        } else {
            await prisma.$executeRawUnsafe(
                `UPDATE \`ChatAttendance\`
                 SET status = 'IN_PROGRESS', assignedUserId = ?, assignedUserName = ?, closedAt = NULL, updatedAt = ?
                 WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                userId,
                userName,
                now,
                sessionId,
                existing.id,
                ...candidates
            );
        }

        // Clean up Finalizado label if present across all candidates
        try {
            const finLabels = await prisma.label.findMany({
                where: { sessionId, name: { equals: "Finalizado" } },
                select: { id: true }
            });
            if (finLabels.length > 0) {
                await prisma.chatLabel.deleteMany({
                    where: {
                        labelId: { in: finLabels.map(l => l.id) },
                        chatJid: { in: candidates }
                    }
                });
            }
        } catch {
            // ignore
        }

        return await this.getAttendance(sessionId, chatJid);
    }

    /**
     * Close / finalize attendance.
     */
    static async closeAttendance(sessionId: string, chatJid: string): Promise<boolean> {
        await this.ensureTables();
        const now = new Date();
        const existing = await this.getAttendance(sessionId, chatJid);
        const candidates = this.getJidCandidates(chatJid);
        const placeholders = candidates.map(() => "?").join(", ");

        if (!existing) {
            const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await prisma.$executeRawUnsafe(
                `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, status, closedAt, createdAt, updatedAt)
                 VALUES (?, ?, ?, 'CLOSED', ?, ?, ?)`,
                id,
                sessionId,
                chatJid,
                now,
                now,
                now
            );
        } else {
            await prisma.$executeRawUnsafe(
                `UPDATE \`ChatAttendance\`
                 SET status = 'CLOSED', closedAt = ?, updatedAt = ?
                 WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                now,
                now,
                sessionId,
                existing.id,
                ...candidates
            );
        }

        // Ensure "Finalizado" label exists and is attached to the chat
        try {
            let label = await prisma.label.findUnique({
                where: { sessionId_name: { sessionId, name: "Finalizado" } }
            });
            if (!label) {
                label = await prisma.label.create({
                    data: { sessionId, name: "Finalizado", colorHex: "#10B981" }
                });
            }
            await prisma.chatLabel.upsert({
                where: { labelId_chatJid: { labelId: label.id, chatJid } },
                create: { labelId: label.id, chatJid },
                update: {}
            });
        } catch (e) {
            logger.debug("Attendance", "Error syncing Finalizado label on close", e);
        }

        return true;
    }

    /**
     * An attendant rejects a conversation from "Em Espera".
     * Marks the attendance as CLOSED (with closedAt), removes it from queue,
     * and optionally removes the messages from the system to completely delete it.
     */
    static async rejectAttendance(sessionId: string, chatJid: string, deleteMessages = true): Promise<boolean> {
        await this.ensureTables();
        try {
            const now = new Date();
            const existing = await this.getAttendance(sessionId, chatJid);
            const candidates = this.getJidCandidates(chatJid);
            const placeholders = candidates.map(() => "?").join(", ");

            if (existing) {
                await prisma.$executeRawUnsafe(
                    `UPDATE \`ChatAttendance\`
                     SET status = 'CLOSED', assignedUserId = NULL, assignedUserName = NULL, closedAt = ?, updatedAt = ?
                     WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                    now,
                    now,
                    sessionId,
                    existing.id,
                    ...candidates
                );
            } else {
                const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await prisma.$executeRawUnsafe(
                    `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, status, closedAt, createdAt, updatedAt)
                     VALUES (?, ?, ?, 'CLOSED', ?, ?, ?)`,
                    id,
                    sessionId,
                    chatJid,
                    now,
                    now,
                    now
                );
            }

            // Clean up from database messages if requested
            if (deleteMessages) {
                const session = await prisma.session.findUnique({
                    where: { sessionId },
                    select: { id: true }
                });
                if (session) {
                    await prisma.message.deleteMany({
                        where: {
                            sessionId: session.id,
                            remoteJid: { in: candidates }
                        }
                    });
                }
            }

            return true;
        } catch (e) {
            logger.error("Attendance", `Error rejecting attendance for ${chatJid}`, e);
            return false;
        }
    }

    /**
     * Reopen attendance. Moves back to WAITING or assigns to the attendant reopening it.
     */
    static async reopenAttendance(
        sessionId: string,
        chatJid: string,
        userId?: string,
        userName?: string
    ): Promise<AttendanceRecord | null> {
        await this.ensureTables();
        const now = new Date();
        const existing = await this.getAttendance(sessionId, chatJid);
        const candidates = this.getJidCandidates(chatJid);
        const placeholders = candidates.map(() => "?").join(", ");

        const newStatus = userId ? "IN_PROGRESS" : "WAITING";
        const assignedId = userId || null;
        const assignedName = userName || null;

        if (!existing) {
            const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await prisma.$executeRawUnsafe(
                `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, assignedUserId, assignedUserName, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                id,
                sessionId,
                chatJid,
                assignedId,
                assignedName,
                newStatus,
                now,
                now
            );
        } else {
            await prisma.$executeRawUnsafe(
                `UPDATE \`ChatAttendance\`
                 SET status = ?, assignedUserId = ?, assignedUserName = ?, closedAt = NULL, updatedAt = ?
                 WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                newStatus,
                assignedId,
                assignedName,
                now,
                sessionId,
                existing.id,
                ...candidates
            );
        }

        // Remove Finalizado label
        try {
            const finLabels = await prisma.label.findMany({
                where: { sessionId, name: { equals: "Finalizado" } },
                select: { id: true }
            });
            if (finLabels.length > 0) {
                await prisma.chatLabel.deleteMany({
                    where: {
                        labelId: { in: finLabels.map(l => l.id) },
                        chatJid: { in: candidates }
                    }
                });
            }
        } catch {
            // ignore
        }

        return await this.getAttendance(sessionId, chatJid);
    }

    /**
     * Transfer attendance to another attendant or department.
     */
    static async transferAttendance(
        sessionId: string,
        chatJid: string,
        targetUserId?: string | null,
        targetUserName?: string | null,
        departmentTag?: string | null
    ): Promise<AttendanceRecord | null> {
        await this.ensureTables();
        const now = new Date();
        const existing = await this.getAttendance(sessionId, chatJid);
        const candidates = this.getJidCandidates(chatJid);
        const placeholders = candidates.map(() => "?").join(", ");

        const newStatus = targetUserId ? "IN_PROGRESS" : "WAITING";
        const assignedId = targetUserId || null;
        const assignedName = targetUserName || null;

        if (!existing) {
            const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await prisma.$executeRawUnsafe(
                `INSERT INTO \`ChatAttendance\` (id, sessionId, chatJid, assignedUserId, assignedUserName, departmentTag, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                id,
                sessionId,
                chatJid,
                assignedId,
                assignedName,
                departmentTag || null,
                newStatus,
                now,
                now
            );
        } else {
            await prisma.$executeRawUnsafe(
                `UPDATE \`ChatAttendance\`
                 SET status = ?, assignedUserId = ?, assignedUserName = ?, departmentTag = COALESCE(?, departmentTag), closedAt = NULL, updatedAt = ?
                 WHERE sessionId = ? AND (id = ? OR chatJid IN (${placeholders}))`,
                newStatus,
                assignedId,
                assignedName,
                departmentTag || null,
                now,
                sessionId,
                existing.id,
                ...candidates
            );
        }

        return await this.getAttendance(sessionId, chatJid);
    }

    /**
     * Get attendant configuration (allowed tags).
     */
    static async getAttendantConfig(userId: string): Promise<AttendantConfigRecord | null> {
        await this.ensureTables();
        try {
            const rows = await prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM \`AttendantConfig\` WHERE userId = ? LIMIT 1`,
                userId
            );
            if (!rows || rows.length === 0) return null;
            const r = rows[0];
            let tags: string[] = [];
            try {
                tags = JSON.parse(r.allowedTags || "[]");
            } catch {
                tags = [];
            }
            return {
                id: r.id,
                userId: r.userId,
                allowedTags: tags
            };
        } catch (e) {
            logger.error("Attendance", `Error fetching attendant config for ${userId}`, e);
            return null;
        }
    }

    /**
     * Save attendant configuration (allowed tags).
     */
    static async setAttendantConfig(userId: string, allowedTags: string[]): Promise<boolean> {
        await this.ensureTables();
        try {
            const jsonTags = JSON.stringify(allowedTags);
            const now = new Date();
            const existing = await this.getAttendantConfig(userId);

            if (!existing) {
                const id = `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await prisma.$executeRawUnsafe(
                    `INSERT INTO \`AttendantConfig\` (id, userId, allowedTags, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?)`,
                    id,
                    userId,
                    jsonTags,
                    now,
                    now
                );
            } else {
                await prisma.$executeRawUnsafe(
                    `UPDATE \`AttendantConfig\`
                     SET allowedTags = ?, updatedAt = ?
                     WHERE userId = ?`,
                    jsonTags,
                    now,
                    userId
                );
            }
            return true;
        } catch (e) {
            logger.error("Attendance", `Error saving attendant config for ${userId}`, e);
            return false;
        }
    }

    /**
     * Delete attendant configuration.
     */
    static async deleteAttendantConfig(userId: string): Promise<boolean> {
        await this.ensureTables();
        try {
            await prisma.$executeRawUnsafe(
                `DELETE FROM \`AttendantConfig\` WHERE userId = ?`,
                userId
            );
            return true;
        } catch (e) {
            logger.error("Attendance", `Error deleting attendant config for ${userId}`, e);
            return false;
        }
    }
}
