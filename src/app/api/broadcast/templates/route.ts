import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const backupFilePath = path.join(dataDir, "broadcast-templates.json");

const DEFAULT_TEMPLATES = [
    {
        templateKey: "fatura_atraso",
        title: "Aviso de Fatura em Atraso",
        category: "billing",
        content: `⚠️ *AVISO DE FATURA EM ATRASO* ⚠️\n\nOlá *[NOME]*, tudo bem?\n\nIdentificamos em nosso sistema que a fatura referente aos serviços contratados encontra-se em atraso.\n\n📌 *Dados da Cobrança:*\n• Cliente: *[NOME]*\n• Valor em Aberto: *[VALOR]*\n• Data de Vencimento: *[DATA]*\n\nPara evitar a suspensão temporária dos seus acessos e serviços, solicitamos a regularização o mais breve possível.\n\n🔑 *Chave PIX Copia e Cola:*\n[PIX]\n\n_Caso o pagamento já tenha sido efetuado nas últimas horas, por favor desconsidere este aviso ou nos envie o comprovante de pagamento por aqui._\n\nAgradecemos pela compreensão e parceria!\n*Equipe Financeira Nexus*`
    },
    {
        templateKey: "vencimento_proximo",
        title: "Vencimento se Aproxima",
        category: "billing",
        content: `📅 *LEMBRETE: SUA FATURA VENCE EM BREVE* 🔔\n\nOlá *[NOME]*, tudo bem?\n\nPassando para lembrar que a sua fatura mensal referente aos serviços Nexus vencerá em breve.\n\n📌 *Informações da Fatura:*\n• Cliente: *[NOME]*\n• Valor: *[VALOR]*\n• Vencimento: *[DATA]*\n\nVocê pode antecipar seu pagamento de forma rápida e prática utilizando a chave PIX Copia e Cola:\n\n🔑 *Chave PIX:*\n[PIX]\n\nAgradecemos pela pontualidade e preferência!\n*Equipe Financeira Nexus*`
    },
    {
        templateKey: "vencimento_hoje",
        title: "Vencimento Hoje",
        category: "billing",
        content: `⏰ *ATENÇÃO: SUA FATURA VENCE HOJE* ⏰\n\nOlá *[NOME]*, esperamos que esteja tudo bem!\n\nLembramos que a sua fatura mensal referente aos serviços contratados vence no dia de hoje: *[DATA]*.\n\n📌 *Resumo para Pagamento:*\n• Cliente: *[NOME]*\n• Valor: *[VALOR]*\n• Vencimento: *Hoje (*[DATA]*)*\n\nPara manter seus serviços operando normalmente sem interrupções, realize o pagamento com rapidez pelo PIX Copia e Cola:\n\n🔑 *Chave PIX:*\n[PIX]\n\n_Se você já realizou o pagamento hoje, desconsidere este lembrete._\n\nMuito obrigado pela parceria de sempre!\n*Equipe Financeira Nexus*`
    }
];

function readBackupTemplates(): any[] {
    try {
        if (fs.existsSync(backupFilePath)) {
            const raw = fs.readFileSync(backupFilePath, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Error reading backup templates:", e);
    }
    return DEFAULT_TEMPLATES;
}

function writeBackupTemplates(templates: any[]) {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(backupFilePath, JSON.stringify(templates, null, 2), "utf-8");
    } catch (e) {
        console.error("Error writing backup templates:", e);
    }
}

async function ensureTableExists() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS broadcast_templates (
                id VARCHAR(191) PRIMARY KEY,
                templateKey VARCHAR(100) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(100) DEFAULT 'billing',
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    } catch (err) {
        console.error("Error ensuring broadcast_templates table exists in DB:", err);
    }
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        await ensureTableExists();

        let dbTemplates: any[] = [];
        try {
            dbTemplates = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, templateKey, title, content, category, updatedAt FROM broadcast_templates ORDER BY templateKey ASC`
            );
        } catch (dbErr) {
            console.warn("Could not query DB broadcast_templates, falling back to JSON backup:", dbErr);
        }

        if (!dbTemplates || dbTemplates.length === 0) {
            // Seed defaults
            const backup = readBackupTemplates();
            for (const item of backup) {
                try {
                    await prisma.$executeRawUnsafe(
                        `INSERT INTO broadcast_templates (id, templateKey, title, content, category, updatedAt) 
                         VALUES (?, ?, ?, ?, ?, NOW()) 
                         ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), updatedAt = NOW()`,
                        `tmpl_${item.templateKey}`,
                        item.templateKey,
                        item.title,
                        item.content,
                        item.category || "billing"
                    );
                } catch {}
            }
            dbTemplates = backup;
            writeBackupTemplates(backup);
        }

        return NextResponse.json({ status: true, data: dbTemplates });
    } catch (error: any) {
        console.error("Error fetching broadcast templates:", error);
        return NextResponse.json({ status: false, message: error.message || "Erro ao buscar modelos" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { templateKey, title, content, category = "billing" } = body;

        if (!templateKey || !content) {
            return NextResponse.json({ status: false, message: "Chave e conteúdo do modelo são obrigatórios" }, { status: 400 });
        }

        await ensureTableExists();

        const id = `tmpl_${templateKey}`;
        let savedInDb = false;

        try {
            await prisma.$executeRawUnsafe(
                `INSERT INTO broadcast_templates (id, templateKey, title, content, category, updatedAt) 
                 VALUES (?, ?, ?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), category = VALUES(category), updatedAt = NOW()`,
                id,
                templateKey,
                title || templateKey,
                content,
                category
            );
            savedInDb = true;
        } catch (dbErr) {
            console.error("Error saving template to DB, saving to backup file:", dbErr);
        }

        // Also update backup file for extra precision and resilience
        const existing = readBackupTemplates();
        const idx = existing.findIndex((t: any) => t.templateKey === templateKey);
        const updatedObj = {
            id,
            templateKey,
            title: title || (idx >= 0 ? existing[idx].title : templateKey),
            content,
            category,
            updatedAt: new Date().toISOString()
        };

        if (idx >= 0) {
            existing[idx] = updatedObj;
        } else {
            existing.push(updatedObj);
        }
        writeBackupTemplates(existing);

        return NextResponse.json({
            status: true,
            message: savedInDb ? "Modelo salvo no banco de dados com sucesso!" : "Modelo salvo com sucesso no sistema!",
            data: updatedObj
        });
    } catch (error: any) {
        console.error("Error saving broadcast template:", error);
        return NextResponse.json({ status: false, message: error.message || "Erro ao salvar modelo" }, { status: 500 });
    }
}
