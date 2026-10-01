import { prisma } from "@/lib/prisma";
import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";

/**
 * Sync contacts from WhatsApp to database.
 * Uses proper Baileys events for syncing and correct Session.id foreign key.
 */
export function bindContactSync(sock: WASocket, sessionId: string) {
    // First, get the database Session ID (cuid)
    let dbSessionId: string | null = null;
    
    const getDbSessionId = async (): Promise<string | null> => {
        if (dbSessionId) return dbSessionId;
        try {
            const session = await prisma.session.findUnique({
                where: { sessionId },
                select: { id: true }
            });
            if (session) {
                dbSessionId = session.id;
            }
        } catch (e) {
            logger.error("Store", `Failed to get dbSessionId for contacts in ${sessionId}`, e);
        }
        return dbSessionId;
    };

    // Initialize by fetching the session ID
    (async () => {
        const id = await getDbSessionId();
        if (id) {
            logger.info("Store", `Contact sync initialized for session ${sessionId} (db: ${id})`);
        } else {
            logger.error("Store", `Session ${sessionId} not found for contact sync`);
        }
    })();

    // Handle contacts.update event (fires when contacts are updated)
    sock.ev.on('contacts.update', async (updates) => {
        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) return;
        
        logger.debug("Store", `Received ${updates.length} contact updates for session ${sessionId}`);
        for (const update of updates) {
            try {
                if (!update.id) continue;
                
                await prisma.contact.upsert({
                    where: { sessionId_jid: { sessionId: currentDbSessionId, jid: update.id } },
                    create: {
                        sessionId: currentDbSessionId,
                        jid: update.id,
                        name: update.name || update.notify,
                        notify: update.notify,
                        profilePic: update.imgUrl
                    },
                    update: {
                        name: update.name || undefined,
                        notify: update.notify || undefined,
                        profilePic: update.imgUrl || undefined
                    }
                });
            } catch (e) {
                logger.error("Store", `Failed to sync contact ${update.id}`, e);
            }
        }
    });

    // Also listen for messaging events to auto-create contacts
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) return;
        
        logger.info("Store", `Received messaging history: ${chats.length} chats, ${contacts?.length || 0} contacts, ${messages.length} messages`);
        
        // Sync chats as contacts (for personal chats)
        for (const chat of chats) {
            try {
                if (!chat.id || chat.id.includes('@g.us') || chat.id.includes('@broadcast')) continue;
                
                await prisma.contact.upsert({
                    where: { sessionId_jid: { sessionId: currentDbSessionId, jid: chat.id } },
                    create: {
                        sessionId: currentDbSessionId,
                        jid: chat.id,
                        name: chat.name || undefined,
                        notify: (chat as any).notify || undefined
                    },
                    update: {
                        name: chat.name || undefined
                    }
                });
            } catch (e) {
                logger.error("Store", `Failed to sync chat contact ${chat.id}`, e);
            }
        }
        
        // Sync explicit contacts
        if (contacts) {
            for (const contact of contacts) {
                try {
                    if (!contact.id) continue;
                    
                    await prisma.contact.upsert({
                        where: { sessionId_jid: { sessionId: currentDbSessionId, jid: contact.id } },
                        create: {
                            sessionId: currentDbSessionId,
                            jid: contact.id,
                            name: contact.name || contact.notify,
                            notify: contact.notify
                        },
                        update: {
                            name: contact.name || undefined,
                            notify: contact.notify || undefined
                        }
                    });
                } catch (e) {
                    logger.error("Store", `Failed to sync contact ${contact.id}`, e);
                }
            }
        }
        
        logger.success("Store", `Synced contacts from messaging history for session ${sessionId}`);
    });
}
