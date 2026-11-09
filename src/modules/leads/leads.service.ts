import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface NexusLeadRecord {
    id: string;
    companyName: string;
    ownerName: string;
    phone: string;
    segment: string | null;
    systemOfInterest: string | null;
    currentSystem: string | null;
    posCount: number;
    city: string | null;
    state: string | null;
    status: "NOVO" | "EM_CONTATO" | "VISITA_DEMO" | "PROPOSTA_ENVIADA" | "FECHADO" | "PERDIDO";
    capturedAt: string;
    lastContactAt: string | null;
    nextContactAt: string | null;
    notes: string | null;
    assignedTo: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface NexusLeadActivityRecord {
    id: string;
    leadId: string;
    type: "WHATSAPP" | "LIGACAO" | "VISITA" | "DEMO" | "PROPOSTA" | "NOTA";
    notes: string;
    nextContactAt: string | null;
    newStatus: string | null;
    createdBy: string;
    createdAt: string;
}

export interface CreateLeadDTO {
    companyName: string;
    ownerName: string;
    phone: string;
    segment?: string;
    systemOfInterest?: string;
    currentSystem?: string;
    posCount?: number;
    city?: string;
    state?: string;
    status?: "NOVO" | "EM_CONTATO" | "VISITA_DEMO" | "PROPOSTA_ENVIADA" | "FECHADO" | "PERDIDO";
    capturedAt?: string;
    lastContactAt?: string | null;
    nextContactAt?: string | null;
    notes?: string;
    assignedTo?: string;
}

export interface UpdateLeadDTO {
    companyName?: string;
    ownerName?: string;
    phone?: string;
    segment?: string;
    systemOfInterest?: string;
    currentSystem?: string;
    posCount?: number;
    city?: string;
    state?: string;
    status?: "NOVO" | "EM_CONTATO" | "VISITA_DEMO" | "PROPOSTA_ENVIADA" | "FECHADO" | "PERDIDO";
    capturedAt?: string;
    lastContactAt?: string | null;
    nextContactAt?: string | null;
    notes?: string;
    assignedTo?: string;
}

export interface CreateActivityDTO {
    type: "WHATSAPP" | "LIGACAO" | "VISITA" | "DEMO" | "PROPOSTA" | "NOTA";
    notes: string;
    nextContactAt?: string | null;
    newStatus?: "NOVO" | "EM_CONTATO" | "VISITA_DEMO" | "PROPOSTA_ENVIADA" | "FECHADO" | "PERDIDO";
    createdBy: string;
}

export class LeadsService {
    private static tablesInitialized = false;

    static async ensureTables() {
        if (this.tablesInitialized) return;
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`NexusLead\` (
                    \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
                    \`companyName\` VARCHAR(191) NOT NULL,
                    \`ownerName\` VARCHAR(191) NOT NULL,
                    \`phone\` VARCHAR(50) NOT NULL,
                    \`segment\` VARCHAR(100) NULL,
                    \`systemOfInterest\` VARCHAR(150) NULL,
                    \`currentSystem\` VARCHAR(100) NULL,
                    \`posCount\` INT NOT NULL DEFAULT 1,
                    \`city\` VARCHAR(100) NULL DEFAULT 'Itabaiana',
                    \`state\` VARCHAR(10) NULL DEFAULT 'SE',
                    \`status\` VARCHAR(50) NOT NULL DEFAULT 'NOVO',
                    \`capturedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`lastContactAt\` DATETIME NULL,
                    \`nextContactAt\` DATETIME NULL,
                    \`notes\` TEXT NULL,
                    \`assignedTo\` VARCHAR(191) NULL,
                    \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    KEY \`idx_lead_status\` (\`status\`),
                    KEY \`idx_lead_next_contact\` (\`nextContactAt\`),
                    KEY \`idx_lead_captured\` (\`capturedAt\`),
                    KEY \`idx_lead_phone\` (\`phone\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS \`NexusLeadActivity\` (
                    \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
                    \`leadId\` VARCHAR(191) NOT NULL,
                    \`type\` VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
                    \`notes\` TEXT NOT NULL,
                    \`nextContactAt\` DATETIME NULL,
                    \`newStatus\` VARCHAR(50) NULL,
                    \`createdBy\` VARCHAR(191) NOT NULL,
                    \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    KEY \`idx_activity_lead\` (\`leadId\`, \`createdAt\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.tablesInitialized = true;
        } catch (e) {
            logger.error("LeadsService", "Failed to ensure NexusLead tables", e);
        }
    }

    private static formatDate(d?: string | Date | null): string | null {
        if (!d) return null;
        const date = typeof d === "string" ? new Date(d) : d;
        if (isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 19).replace("T", " ");
    }

    static async listLeads(filters: {
        search?: string;
        status?: string;
        segment?: string;
        filterDate?: "today" | "overdue" | "upcoming" | "all";
    }): Promise<NexusLeadRecord[]> {
        await this.ensureTables();

        let query = `
            SELECT 
                id, companyName, ownerName, phone, segment, systemOfInterest, 
                currentSystem, posCount, city, state, status,
                capturedAt, lastContactAt, nextContactAt, notes, assignedTo,
                createdAt, updatedAt
            FROM \`NexusLead\`
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filters.status && filters.status !== "ALL") {
            query += " AND status = ?";
            params.push(filters.status);
        }

        if (filters.segment && filters.segment !== "ALL") {
            query += " AND segment = ?";
            params.push(filters.segment);
        }

        if (filters.search && filters.search.trim()) {
            const term = `%${filters.search.trim()}%`;
            query += " AND (companyName LIKE ? OR ownerName LIKE ? OR phone LIKE ? OR city LIKE ?)";
            params.push(term, term, term, term);
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        if (filters.filterDate === "today") {
            query += " AND nextContactAt >= ? AND nextContactAt <= ? AND status NOT IN ('FECHADO', 'PERDIDO')";
            params.push(this.formatDate(todayStart), this.formatDate(todayEnd));
        } else if (filters.filterDate === "overdue") {
            query += " AND nextContactAt < ? AND status NOT IN ('FECHADO', 'PERDIDO')";
            params.push(this.formatDate(todayStart));
        } else if (filters.filterDate === "upcoming") {
            query += " AND nextContactAt > ? AND status NOT IN ('FECHADO', 'PERDIDO')";
            params.push(this.formatDate(todayEnd));
        }

        // Ordenação inteligente: Contatos agendados mais urgentes primeiro, depois data de captação
        query += " ORDER BY CASE WHEN nextContactAt IS NOT NULL AND status NOT IN ('FECHADO', 'PERDIDO') THEN 0 ELSE 1 END, nextContactAt ASC, capturedAt DESC";

        const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);
        return rows.map(r => ({
            ...r,
            capturedAt: r.capturedAt ? new Date(r.capturedAt).toISOString() : new Date().toISOString(),
            lastContactAt: r.lastContactAt ? new Date(r.lastContactAt).toISOString() : null,
            nextContactAt: r.nextContactAt ? new Date(r.nextContactAt).toISOString() : null,
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
        }));
    }

    static async getLeadById(id: string): Promise<{ lead: NexusLeadRecord | null; activities: NexusLeadActivityRecord[] }> {
        await this.ensureTables();

        const rows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT 
                id, companyName, ownerName, phone, segment, systemOfInterest, 
                currentSystem, posCount, city, state, status,
                capturedAt, lastContactAt, nextContactAt, notes, assignedTo,
                createdAt, updatedAt
            FROM \`NexusLead\`
            WHERE id = ?
            LIMIT 1
        `, id);

        if (!rows || rows.length === 0) {
            return { lead: null, activities: [] };
        }

        const raw = rows[0];
        const lead: NexusLeadRecord = {
            ...raw,
            capturedAt: raw.capturedAt ? new Date(raw.capturedAt).toISOString() : new Date().toISOString(),
            lastContactAt: raw.lastContactAt ? new Date(raw.lastContactAt).toISOString() : null,
            nextContactAt: raw.nextContactAt ? new Date(raw.nextContactAt).toISOString() : null,
            createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
        };

        const activitiesRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, leadId, type, notes, nextContactAt, newStatus, createdBy, createdAt
            FROM \`NexusLeadActivity\`
            WHERE leadId = ?
            ORDER BY createdAt DESC
        `, id);

        const activities: NexusLeadActivityRecord[] = activitiesRows.map(a => ({
            ...a,
            nextContactAt: a.nextContactAt ? new Date(a.nextContactAt).toISOString() : null,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString()
        }));

        return { lead, activities };
    }

    static async createLead(data: CreateLeadDTO): Promise<NexusLeadRecord> {
        await this.ensureTables();
        const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();
        const capturedAtDate = data.capturedAt ? new Date(data.capturedAt) : now;

        await prisma.$executeRawUnsafe(`
            INSERT INTO \`NexusLead\`
            (id, companyName, ownerName, phone, segment, systemOfInterest, currentSystem, posCount, city, state, status, capturedAt, lastContactAt, nextContactAt, notes, assignedTo, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            id,
            data.companyName.trim(),
            data.ownerName.trim(),
            data.phone.trim(),
            data.segment || null,
            data.systemOfInterest || null,
            data.currentSystem || null,
            data.posCount || 1,
            data.city?.trim() || "Itabaiana",
            data.state?.trim() || "SE",
            data.status || "NOVO",
            this.formatDate(capturedAtDate),
            this.formatDate(data.lastContactAt),
            this.formatDate(data.nextContactAt),
            data.notes || null,
            data.assignedTo || null,
            this.formatDate(now),
            this.formatDate(now)
        );

        const created = await this.getLeadById(id);
        return created.lead!;
    }

    static async importLeadsBatch(leads: CreateLeadDTO[]): Promise<{ imported: number; failed: number }> {
        await this.ensureTables();
        let imported = 0;
        let failed = 0;

        for (const data of leads) {
            try {
                if (!data.companyName?.trim() || !data.phone?.trim()) {
                    failed++;
                    continue;
                }
                const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const now = new Date();
                const capturedAtDate = data.capturedAt ? new Date(data.capturedAt) : now;

                await prisma.$executeRawUnsafe(`
                    INSERT INTO \`NexusLead\`
                    (id, companyName, ownerName, phone, segment, systemOfInterest, currentSystem, posCount, city, state, status, capturedAt, lastContactAt, nextContactAt, notes, assignedTo, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                    id,
                    data.companyName.trim(),
                    (data.ownerName?.trim() || "Responsável"),
                    data.phone.trim(),
                    data.segment || "Varejo em Geral",
                    data.systemOfInterest || "ERP Completo Nexus (Estoque, Financeiro, Fiscal e Vendas)",
                    data.currentSystem || "Nenhum / Anotações no Caderno",
                    Number(data.posCount) || 1,
                    data.city?.trim() || "Itabaiana",
                    data.state?.trim() || "SE",
                    data.status || "NOVO",
                    this.formatDate(capturedAtDate),
                    this.formatDate(data.lastContactAt),
                    this.formatDate(data.nextContactAt),
                    data.notes || "Importado via planilha Excel",
                    data.assignedTo || null,
                    this.formatDate(now),
                    this.formatDate(now)
                );
                imported++;
            } catch (err) {
                logger.error("LeadsService", "Failed to import single lead", err);
                failed++;
            }
        }

        return { imported, failed };
    }

    static async updateLead(id: string, data: UpdateLeadDTO): Promise<NexusLeadRecord | null> {
        await this.ensureTables();

        const updates: string[] = [];
        const values: any[] = [];

        if (data.companyName !== undefined) {
            updates.push("companyName = ?");
            values.push(data.companyName.trim());
        }
        if (data.ownerName !== undefined) {
            updates.push("ownerName = ?");
            values.push(data.ownerName.trim());
        }
        if (data.phone !== undefined) {
            updates.push("phone = ?");
            values.push(data.phone.trim());
        }
        if (data.segment !== undefined) {
            updates.push("segment = ?");
            values.push(data.segment || null);
        }
        if (data.systemOfInterest !== undefined) {
            updates.push("systemOfInterest = ?");
            values.push(data.systemOfInterest || null);
        }
        if (data.currentSystem !== undefined) {
            updates.push("currentSystem = ?");
            values.push(data.currentSystem || null);
        }
        if (data.posCount !== undefined) {
            updates.push("posCount = ?");
            values.push(data.posCount);
        }
        if (data.city !== undefined) {
            updates.push("city = ?");
            values.push(data.city?.trim() || null);
        }
        if (data.state !== undefined) {
            updates.push("state = ?");
            values.push(data.state?.trim() || null);
        }
        if (data.status !== undefined) {
            updates.push("status = ?");
            values.push(data.status);
        }
        if (data.capturedAt !== undefined) {
            updates.push("capturedAt = ?");
            values.push(this.formatDate(data.capturedAt));
        }
        if (data.lastContactAt !== undefined) {
            updates.push("lastContactAt = ?");
            values.push(this.formatDate(data.lastContactAt));
        }
        if (data.nextContactAt !== undefined) {
            updates.push("nextContactAt = ?");
            values.push(this.formatDate(data.nextContactAt));
        }
        if (data.notes !== undefined) {
            updates.push("notes = ?");
            values.push(data.notes || null);
        }
        if (data.assignedTo !== undefined) {
            updates.push("assignedTo = ?");
            values.push(data.assignedTo || null);
        }

        if (updates.length === 0) {
            const current = await this.getLeadById(id);
            return current.lead;
        }

        updates.push("updatedAt = ?");
        values.push(this.formatDate(new Date()));

        values.push(id);

        await prisma.$executeRawUnsafe(`
            UPDATE \`NexusLead\`
            SET ${updates.join(", ")}
            WHERE id = ?
        `, ...values);

        const updated = await this.getLeadById(id);
        return updated.lead;
    }

    static async deleteLead(id: string): Promise<boolean> {
        await this.ensureTables();

        // Limpa atividades
        await prisma.$executeRawUnsafe(`
            DELETE FROM \`NexusLeadActivity\` WHERE leadId = ?
        `, id);

        // Remove lead
        const res = await prisma.$executeRawUnsafe(`
            DELETE FROM \`NexusLead\` WHERE id = ?
        `, id);

        return Number(res) > 0;
    }

    static async deleteLeadsBatch(ids: string[]): Promise<number> {
        await this.ensureTables();
        if (!ids || ids.length === 0) return 0;

        const placeholders = ids.map(() => "?").join(", ");

        await prisma.$executeRawUnsafe(
            `DELETE FROM \`NexusLeadActivity\` WHERE leadId IN (${placeholders})`,
            ...ids
        );

        const res = await prisma.$executeRawUnsafe(
            `DELETE FROM \`NexusLead\` WHERE id IN (${placeholders})`,
            ...ids
        );

        return Number(res) || 0;
    }

    static async deleteAllLeads(): Promise<number> {
        await this.ensureTables();
        await prisma.$executeRawUnsafe(`DELETE FROM \`NexusLeadActivity\``);
        const res = await prisma.$executeRawUnsafe(`DELETE FROM \`NexusLead\``);
        return Number(res) || 0;
    }

    static async addActivity(leadId: string, activity: CreateActivityDTO): Promise<NexusLeadActivityRecord> {
        await this.ensureTables();

        const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();

        await prisma.$executeRawUnsafe(`
            INSERT INTO \`NexusLeadActivity\`
            (id, leadId, type, notes, nextContactAt, newStatus, createdBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
            activityId,
            leadId,
            activity.type,
            activity.notes.trim(),
            this.formatDate(activity.nextContactAt),
            activity.newStatus || null,
            activity.createdBy,
            this.formatDate(now)
        );

        // Atualiza automaticamente o Lead: data de último contato = hoje, data de novo contato e novo status se informado
        const leadUpdates: UpdateLeadDTO = {
            lastContactAt: now.toISOString()
        };

        if (activity.nextContactAt !== undefined) {
            leadUpdates.nextContactAt = activity.nextContactAt;
        }
        if (activity.newStatus) {
            leadUpdates.status = activity.newStatus;
        }

        await this.updateLead(leadId, leadUpdates);

        return {
            id: activityId,
            leadId,
            type: activity.type,
            notes: activity.notes.trim(),
            nextContactAt: activity.nextContactAt ? new Date(activity.nextContactAt).toISOString() : null,
            newStatus: activity.newStatus || null,
            createdBy: activity.createdBy,
            createdAt: now.toISOString()
        };
    }

    static async getMetrics() {
        await this.ensureTables();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const totalRows = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM \`NexusLead\``);
        const total = Number(totalRows[0]?.count || 0);

        const todayRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as count FROM \`NexusLead\`
            WHERE nextContactAt >= ? AND nextContactAt <= ? AND status NOT IN ('FECHADO', 'PERDIDO')
        `, this.formatDate(todayStart), this.formatDate(todayEnd));
        const pendingToday = Number(todayRows[0]?.count || 0);

        const overdueRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as count FROM \`NexusLead\`
            WHERE nextContactAt < ? AND status NOT IN ('FECHADO', 'PERDIDO')
        `, this.formatDate(todayStart));
        const overdue = Number(overdueRows[0]?.count || 0);

        const wonRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as count FROM \`NexusLead\` WHERE status = 'FECHADO'
        `);
        const won = Number(wonRows[0]?.count || 0);

        const inProgressRows = await prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as count FROM \`NexusLead\` 
            WHERE status IN ('NOVO', 'EM_CONTATO', 'VISITA_DEMO', 'PROPOSTA_ENVIADA')
        `);
        const inProgress = Number(inProgressRows[0]?.count || 0);

        const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

        return {
            total,
            pendingToday,
            overdue,
            inProgress,
            won,
            conversionRate
        };
    }
}

