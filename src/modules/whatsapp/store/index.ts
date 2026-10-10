import { prisma } from "@/lib/prisma";
import type { WASocket, WAMessage, Contact } from "@whiskeysockets/baileys";
import { normalizeMessageContent } from "@whiskeysockets/baileys";
import { onMessageReceived, onMessageSent, dispatchWebhook, downloadAndSaveMedia } from "@/lib/webhook";
import { handleBotCommand, setSessionStartTime } from "../bot/command-handler";
import { resolveToPhoneJid, isLidJid, normalizeJid, formatToBrazilPhoneJid } from "@/lib/jid-utils";

import { Server } from "socket.io";
import { logger } from "@/lib/logger";
import { AttendanceService } from "../attendance.service";

export const bindSessionStore = (sock: WASocket, sessionId: string, io: Server | null) => {
    // Set start time for uptime command
    setSessionStartTime(sessionId);

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
            logger.error("Store", `Failed to get dbSessionId for ${sessionId}`, e);
        }
        return dbSessionId;
    };

    // Initialize by fetching the session ID
    (async () => {
        const id = await getDbSessionId();
        if (id) {
            logger.info("Store", `Message store initialized for session ${sessionId} (db: ${id})`);
        } else {
            logger.error("Store", `Session ${sessionId} not found for message store`);
        }
    })();

    // Handle Messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Process all message types: notify, append, and history sync
        if (type !== 'notify' && type !== 'append') {
            // For history sync, we still want to save messages
            logger.debug("Store", `Received ${messages.length} messages of type: ${type}`);
        }

        // Small batches (<= 5) of notify or append are genuine real-time messages.
        // Large batches indicate an offline catch-up dump where we should not sound alarms.
        const isLiveNotify = (type === 'notify' || type === 'append') && messages.length <= 5;

        // Instant broadcast for real-time contact messages (zero delay floating alerts & audio chimes)
        if (isLiveNotify) {
            for (const msg of messages) {
                const jid = msg.key?.remoteJid;
                if (!msg.key?.fromMe && jid && !jid.includes('status@broadcast') && !jid.includes('@newsletter') && !jid.includes('@broadcast')) {
                    const altJid = msg.key?.remoteJidAlt;
                    let effectiveJid = jid;
                    if (isLidJid(jid)) {
                        if (altJid && !isLidJid(altJid)) {
                            effectiveJid = altJid;
                        } else if (dbSessionId) {
                            try {
                                effectiveJid = await resolveToPhoneJid(jid, dbSessionId, altJid);
                            } catch {}
                        }
                    }
                    const finalJid = formatToBrazilPhoneJid(normalizeJid(effectiveJid));

                    let previewText = "";
                    let mType = "TEXT";
                    if (msg.message) {
                        const content = normalizeMessageContent(msg.message);
                        if (content?.conversation) previewText = content.conversation;
                        else if (content?.extendedTextMessage?.text) previewText = content.extendedTextMessage.text;
                        else if (content?.imageMessage) { mType = "IMAGE"; previewText = content.imageMessage.caption || "📷 Foto recebida"; }
                        else if (content?.videoMessage) { mType = "VIDEO"; previewText = content.videoMessage.caption || "🎥 Vídeo recebido"; }
                        else if (content?.audioMessage) { mType = "AUDIO"; previewText = "🎵 Áudio recebido"; }
                        else if (content?.documentMessage) { mType = "DOCUMENT"; previewText = content.documentMessage.fileName || "📄 Documento recebido"; }
                        else if (content?.stickerMessage) { mType = "STICKER"; previewText = "🏷️ Figurinha recebida"; }
                        else if (content?.locationMessage) { mType = "LOCATION"; previewText = "📍 Localização recebida"; }
                        else if (content?.contactMessage) { mType = "CONTACT"; previewText = content.contactMessage.displayName || "👤 Contato compartilhado"; }
                    }

                    // Ignorar notificações instantâneas para mensagens vazias ou técnicas
                    if (!previewText || previewText.trim().length === 0) {
                        continue;
                    }

                    const instantPayload = {
                        sessionId,
                        message: {
                            keyId: msg.key.id,
                            remoteJid: finalJid,
                            pushName: msg.pushName || null,
                            content: previewText,
                            type: mType,
                            timestamp: new Date().toISOString(),
                            fromMe: false
                        }
                    };
                    logger.info("Socket", `Instant incoming.message broadcast from ${finalJid} in session ${sessionId}`);
                    io?.emit('incoming.message', instantPayload);
                    io?.to(sessionId).emit('incoming.message', instantPayload);
                }
            }
        }

        // Emit to socket room for real-time frontend updates (ignore newsletters & broadcasts)
        if (type === 'notify' || type === 'append') {
            const cleanMessages = messages.filter(m => {
                const jid = m.key?.remoteJid;
                return jid && !jid.includes('status@broadcast') && !jid.includes('@newsletter') && !jid.includes('@broadcast');
            });
            if (cleanMessages.length > 0) {
                io?.to(sessionId).emit('message.upsert', { messages: cleanMessages, type });
            }
        }

        // Ensure we have the database session ID
        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) {
            logger.warn("Store", `Skipping messages.upsert: DB session not found for ${sessionId}`);
            return;
        }

        const processedMessages = [];

        // Fetch Bot Config for auto-read & welcome message
        const config = await prisma.botConfig.findUnique({
            where: { sessionId: currentDbSessionId }
        });

        for (const msg of messages) {
            try {
                // Auto Read Logic (only for genuine real-time messages)
                if (isLiveNotify && (config as any)?.autoRead && !msg.key.fromMe) {
                    await sock.readMessages([msg.key]);
                }

                const savedMessage = await processAndSaveMessage(msg, currentDbSessionId, sessionId, isLiveNotify, sock, config, io);
                if (savedMessage) {
                    processedMessages.push(savedMessage);
                }

                // Execute Bot Commands (Only for genuine real-time live messages)
                if (isLiveNotify && savedMessage) {
                    // Run in background, don't await strictly to not block saving
                    handleBotCommand(sock, sessionId, msg).catch(e => logger.error("Bot", "Bot Handler Error", e));
                }
            } catch (error) {
                logger.error("Store", "Error saving message", error);
            }
        }

        // Emit to socket room for real-time frontend updates
        if (processedMessages.length > 0) {
            // Serialize for frontend: convert Date to ISO string
            const serialized = processedMessages.map((m: any) => ({
                ...m,
                timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
            }));
            logger.debug("Socket", `Emitting message.update for ${serialized.length} messages in session ${sessionId}`);
            io?.to(sessionId).emit('message.update', serialized);
            io?.emit('message.update', serialized);

            // Redundant global emission for sound and floating notification across all dashboard operators (only for live messages)
            if (isLiveNotify) {
                for (const m of serialized) {
                    if (!m.fromMe) {
                        logger.info("Socket", `Broadcasting incoming.message (post-save) from ${m.remoteJid} in session ${sessionId}`);
                        io?.emit('incoming.message', {
                            sessionId,
                            message: m
                        });
                    }
                }
            }
        }
    });

    // Handle Message History Sync (when connecting for the first time or syncing)
    sock.ev.on('messaging-history.set', async ({ messages, chats, contacts, isLatest }) => {
        logger.info("Store", `History sync: ${messages?.length || 0} messages, ${chats?.length || 0} chats, ${contacts?.length || 0} contacts, latest: ${isLatest}`);

        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) {
            logger.warn("Store", `Skipping history sync: DB session not found for ${sessionId}`);
            return;
        }

        // Save historical messages without choking event loop or downloading expired media
        if (messages && messages.length > 0) {
            logger.info("Store", `Syncing ${messages.length} historical messages...`);
            let count = 0;
            for (const msg of messages) {
                try {
                    // triggerWebhook = false: skips media download, skips attendance queue, skips tag routing
                    await processAndSaveMessage(msg, currentDbSessionId, sessionId, false, sock, undefined, io);
                    count++;
                    // Yield event loop every 50 messages so Baileys connection keep-alives and pings are never blocked
                    if (count % 50 === 0) {
                        await new Promise((resolve) => setImmediate(resolve));
                    }
                } catch (error) {
                    logger.error("Store", "Error saving historical message", error);
                }
            }
            logger.success("Store", `Finished syncing ${messages.length} historical messages`);
            // Notify active chat windows and chat list to display newly pulled history
            io?.to(sessionId).emit('message.update');
            io?.emit('message.update');
        }

        // Note: Contacts and Chats are synced by src/modules/whatsapp/store/contacts.ts
        // We only handle messages here to avoid P2002 Unique Constraint Race Conditions.
        logger.debug("Store", `Finished syncing messages`);
    });

    // Handle Contacts Upsert
    sock.ev.on('contacts.upsert', async (contacts) => {
        // Ensure we have the database session ID
        if (!dbSessionId) {
            const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
            if (!session) return;
            dbSessionId = session.id;
        }

        for (const c of contacts) {
            try {
                if (!c.id) continue;
                await prisma.contact.upsert({
                    where: { sessionId_jid: { sessionId: dbSessionId, jid: c.id } },
                    create: {
                        sessionId: dbSessionId,
                        jid: c.id,
                        // @ts-ignore
                        lid: c.lid || undefined,
                        name: c.name || c.notify || c.verifiedName,
                        notify: c.notify,
                        // @ts-ignore
                        verifiedName: c.verifiedName,
                        profilePic: c.imgUrl || undefined,
                        data: c as any
                    },
                    update: {
                        // @ts-ignore
                        lid: c.lid || undefined,
                        name: c.name || undefined,
                        notify: c.notify || undefined,
                        // @ts-ignore
                        verifiedName: c.verifiedName || undefined,
                        profilePic: c.imgUrl || undefined,
                        data: c as any
                    }
                });

                // Dispatch webhook for contact update
                dispatchWebhook(sessionId, "contact.update", { jid: c.id, name: c.name, notify: c.notify });
            } catch (e) {
                logger.error("Store", "Error saving contact", e);
            }
        }
    });

    // Handle Message Status Updates
    sock.ev.on('messages.update', async (updates) => {
        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) return;

        for (const update of updates) {
            try {
                const keyId = update.key?.id;
                if (!keyId) continue;

                // Baileys WAMessageStatus (proto.WebMessageInfo.Status):
                // 0 = ERROR, 1 = PENDING, 2 = SERVER_ACK (SENT), 3 = DELIVERY_ACK (DELIVERED), 4 = READ, 5 = PLAYED
                const statusMap: Record<string | number, string> = {
                    0: 'FAILED',
                    1: 'PENDING',
                    2: 'SENT',
                    3: 'DELIVERED',
                    4: 'READ',
                    5: 'READ',
                    'ERROR': 'FAILED',
                    'PENDING': 'PENDING',
                    'SERVER_ACK': 'SENT',
                    'DELIVERY_ACK': 'DELIVERED',
                    'READ': 'READ',
                    'PLAYED': 'READ',
                    'SENT': 'SENT',
                    'DELIVERED': 'DELIVERED',
                    'FAILED': 'FAILED'
                };

                const rawStatus = (update.update as any)?.status;
                if (rawStatus === undefined || rawStatus === null) continue;

                const status = statusMap[rawStatus];
                if (!status) continue;

                await prisma.message.updateMany({
                    where: { sessionId: currentDbSessionId, keyId },
                    data: { status: status as any }
                });

                const targetRemoteJid = update.key?.remoteJid;
                logger.debug("Store", `Message status update: ${keyId} -> ${status} (${targetRemoteJid})`);

                // Emit to socket room for real-time frontend ticks update
                io?.to(sessionId).emit('message.status', {
                    keyId,
                    remoteJid: targetRemoteJid,
                    status
                });

                // Dispatch webhook for message status update
                dispatchWebhook(sessionId, "message.status", {
                    keyId,
                    remoteJid: targetRemoteJid,
                    status
                });
            } catch (e) {
                logger.error("Store", "Error updating message status", e);
            }
        }
    });

    // Handle Message Receipts (read and delivery receipts from recipient)
    sock.ev.on('message-receipt.update', async (receipts) => {
        const currentDbSessionId = await getDbSessionId();
        if (!currentDbSessionId) return;

        for (const r of receipts) {
            try {
                const keyId = r.key?.id;
                if (!keyId) continue;

                const isRead = !!(r.receipt?.readTimestamp || r.receipt?.playedTimestamp);
                const status = isRead ? 'READ' : 'DELIVERED';

                await prisma.message.updateMany({
                    where: { sessionId: currentDbSessionId, keyId },
                    data: { status: status as any }
                });

                const targetRemoteJid = r.key?.remoteJid;
                logger.debug("Store", `Message receipt update: ${keyId} -> ${status} (${targetRemoteJid})`);

                io?.to(sessionId).emit('message.status', {
                    keyId,
                    remoteJid: targetRemoteJid,
                    status
                });

                dispatchWebhook(sessionId, "message.status", {
                    keyId,
                    remoteJid: targetRemoteJid,
                    status
                });
            } catch (e) {
                logger.error("Store", "Error updating message receipt", e);
            }
        }
    });

    // Handle Group Updates
    sock.ev.on('groups.update', async (updates) => {
        if (!dbSessionId) return;

        for (const update of updates) {
            try {
                if (!update.id) continue;
                
                // Keep DB in sync
                const updateData: any = {};
                if (update.subject !== undefined) updateData.subject = update.subject;
                if (update.desc !== undefined) updateData.description = update.desc;
                if (update.restrict !== undefined) updateData.restrict = update.restrict;
                if (update.announce !== undefined) updateData.announce = update.announce;
                if (update.owner !== undefined) updateData.ownerJid = update.owner;
                if (update.linkedParent !== undefined) updateData.linkedParentJid = update.linkedParent;
                if (update.isCommunity !== undefined) updateData.isCommunity = update.isCommunity;

                if (Object.keys(updateData).length > 0) {
                    await prisma.group.updateMany({
                        where: { sessionId: dbSessionId, jid: update.id },
                        data: updateData
                    });
                }
                
                // Trigger webhook
                dispatchWebhook(sessionId, "group.update", {
                    jid: update.id,
                    ...update
                });
            } catch (e) {
                logger.error("Store", "Error in groups.update handling", e);
            }
        }
    });

    // Handle Group Participants Update
    sock.ev.on('group-participants.update', async (update) => {
        if (!dbSessionId || !update.id) return;

        try {
            // update.id is the group JID
            // update.participants is array of JIDs
            // update.action is 'add', 'remove', 'promote', 'demote'
            dispatchWebhook(sessionId, "group.participant", {
                jid: update.id,
                action: update.action,
                participants: update.participants
            });
            
            // To properly resync the group participants in DB, it's safer to re-fetch the entire group metadata
            // But we don't await strictly to not block the socket
            sock.groupMetadata(update.id).then(async (g) => {
                await prisma.group.updateMany({
                    where: { sessionId: dbSessionId as string, jid: update.id as string },
                    data: { participants: g.participants as any }
                });
            }).catch(e => {
                 logger.debug("Store", "Failed to refresh group participants metadata", e);
            });
        } catch (e) {
            logger.error("Store", "Error in group-participants.update handling", e);
        }
    });
};

async function processAndSaveMessage(
    msg: WAMessage,
    dbSessionId: string,
    sessionId: string,
    triggerWebhook: boolean,
    sock?: WASocket,
    config?: any,
    io?: Server | null
) {
    const keyId = msg.key.id;
    const remoteJid = msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const pushName = msg.pushName;
    const parseTimestamp = (ts: any): Date => {
        if (!ts) return new Date();
        if (typeof ts === 'number') return new Date(ts * 1000);
        if (typeof ts === 'string') {
            const n = Number(ts);
            if (!isNaN(n)) return new Date(n * 1000);
        }
        if (typeof ts?.toNumber === 'function') {
            return new Date(ts.toNumber() * 1000);
        }
        if (typeof ts?.low === 'number') {
            return new Date(ts.low * 1000);
        }
        const n = Number(ts);
        return !isNaN(n) ? new Date(n * 1000) : new Date();
    };
    const timestamp = parseTimestamp(msg.messageTimestamp);

    // Filter out Protocol & Empty Messages
    if (!msg.message) return false;
    if (!keyId || !remoteJid) return false;

    // Ignore WhatsApp Newsletter channels and Status broadcast completely
    if (remoteJid.includes('@newsletter') || remoteJid.includes('status@broadcast') || remoteJid.includes('@broadcast')) {
        return null;
    }

    // Ignore specific technical message types
    const messageKeys = Object.keys(msg.message);

    // Check for message edit/revoke protocol messages FIRST
    if (messageKeys.includes('protocolMessage')) {
        const pMessage = msg.message.protocolMessage;
        const targetKeyId = pMessage?.key?.id;

        // Message Edit (Type 14)
        if (pMessage?.type === 14 && targetKeyId) {
            const editContent = pMessage?.editedMessage;
            if (editContent) {
                // Determine new text
                const normalizedEdit = normalizeMessageContent(editContent);
                let newText = "";
                if (normalizedEdit?.conversation) newText = normalizedEdit.conversation;
                else if (normalizedEdit?.extendedTextMessage?.text) newText = normalizedEdit.extendedTextMessage.text;

                // Update DB safely
                await prisma.message.updateMany({
                    where: { sessionId: dbSessionId, keyId: targetKeyId },
                    data: { content: newText } // Note: we don't update timestamp of original
                });

                // Notificar frontend em tempo real
                io?.to(sessionId).emit("message.edited", {
                    keyId: targetKeyId,
                    remoteJid,
                    newContent: newText
                });

                // Trigger Webhook
                if (triggerWebhook) {
                    dispatchWebhook(sessionId, "message.edited", {
                        keyId: targetKeyId,
                        newContent: newText,
                        remoteJid,
                        fromMe
                    });
                }
            }
            return null; // Stop processing as new message
        }

        // Message Revoke/Deleted (Type 0)
        if (pMessage?.type === 0 && targetKeyId) {
            // Always preserve original content/media and flag as deleted for everyone
            await prisma.message.updateMany({
                where: { sessionId: dbSessionId, keyId: targetKeyId },
                data: { isDeleted: true }
            });

            // Notify frontend in real time (dedicated event to avoid re-triggering new-message alerts)
            io?.to(sessionId).emit("message.deleted", {
                keyId: targetKeyId,
                remoteJid
            });

            // Trigger Webhook
            if (triggerWebhook) {
                dispatchWebhook(sessionId, "message.deleted", {
                    keyId: targetKeyId,
                    remoteJid,
                    fromMe
                });
            }
            return null;
        }
    }

    const technicalKeys = new Set([
        'protocolMessage',
        'senderKeyDistributionMessage',
        'reactionMessage',
        'keepInChatMessage',
        'messageContextInfo',
        'deviceSentMessage',
        'deviceListMetadata',
        'bcallMessage',
        'callLogRecordMessage',
        'keyExpiration'
    ]);

    // If message only contains technical/sync/protocol keys, skip (since edit and revoke handled above)
    if (messageKeys.every(k => technicalKeys.has(k))) {
        logger.debug("Store", `Skipping technical message: ${keyId} (${messageKeys.join(', ')})`);
        return null;
    }

    // Check if message already exists to avoid duplicates
    // Baileys 'notify' event can sometimes trigger multiple times or for history
    const existingMessage = await prisma.message.findUnique({
        where: { sessionId_keyId: { sessionId: dbSessionId, keyId: keyId! } },
        select: { id: true, status: true }
    });

    if (existingMessage) {
        // Message exists! Update status if changed, but DO NOT re-trigger webhooks/bot
        if (fromMe && existingMessage.status !== 'SENT') {
            await prisma.message.update({
                where: { id: existingMessage.id },
                data: { status: 'SENT' }
            });
        }
        // Return null to indicate "Not New"
        return null;
    }

    // Debug fromMe issue (Keep this for a while)
    if (fromMe === undefined || fromMe === null) {
        logger.warn("Store", `[DEBUG] Message ${keyId} has fromMe=${fromMe}. Key:`, msg.key);
    }

    const messageContent = normalizeMessageContent(msg.message);
    let text = "";
    let messageType = "TEXT";

    // Extract content based on message type
    if (messageContent?.conversation) {
        text = messageContent.conversation;
    } else if (messageContent?.extendedTextMessage?.text) {
        text = messageContent.extendedTextMessage.text;
    } else if (messageContent?.imageMessage) {
        messageType = "IMAGE";
        text = messageContent.imageMessage.caption || "";
    } else if (messageContent?.videoMessage) {
        messageType = "VIDEO";
        text = messageContent.videoMessage.caption || "";
    } else if (messageContent?.audioMessage) {
        messageType = "AUDIO";
    } else if (messageContent?.documentMessage) {
        messageType = "DOCUMENT";
        text = messageContent.documentMessage.fileName || "";
    } else if (messageContent?.stickerMessage) {
        messageType = "STICKER";
    } else if (messageContent?.locationMessage) {
        messageType = "LOCATION";
        text = `${messageContent.locationMessage.degreesLatitude},${messageContent.locationMessage.degreesLongitude}`;
    } else if (messageContent?.contactMessage) {
        messageType = "CONTACT";
        text = messageContent.contactMessage.displayName || "";
    } else if (messageContent?.buttonsResponseMessage?.selectedDisplayText) {
        text = messageContent.buttonsResponseMessage.selectedDisplayText;
    } else if (messageContent?.templateButtonReplyMessage?.selectedDisplayText) {
        text = messageContent.templateButtonReplyMessage.selectedDisplayText;
    } else if (messageContent?.listResponseMessage?.title) {
        text = messageContent.listResponseMessage.title;
    } else if (messageContent?.interactiveResponseMessage) {
        try {
            const params = JSON.parse(messageContent.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || "{}");
            text = params.title || params.id || "Resposta interativa";
        } catch {
            text = "Resposta interativa";
        }
    } else if (messageContent?.pollCreationMessage) {
        text = messageContent.pollCreationMessage.name || "Enquete";
    }

    // Validação estrita: somente mensagens reais (texto com conteúdo, mídias válidas, localização ou contato)
    const hasText = Boolean(text && text.trim().length > 0);
    const isMedia = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(messageType);
    const isSpecialWithContent = ['LOCATION', 'CONTACT'].includes(messageType) && Boolean(text && text.trim().length > 0);

    if (!hasText && !isMedia && !isSpecialWithContent) {
        logger.debug("Store", `[Ignored] Blank message with no text or media content: ${keyId} (${remoteJid})`);
        return null;
    }

    // Determine effective participant for groups
    // Determine effective participant for groups with standard logic
    const isGroup = remoteJid.endsWith("@g.us");
    const remoteJidAlt = msg.key.remoteJidAlt; // LID/Phone JID handling
    let senderJid = fromMe ? undefined : (isGroup ? (msg.key.participant || msg.participant) : remoteJid);

    // Prefer remoteJidAlt for DMs if available (matches webhook logic)
    if (!fromMe && !isGroup && remoteJidAlt) {
        senderJid = remoteJidAlt;
    }

    // --- Normalize LID JIDs to @s.whatsapp.net and canonicalize Brazilian phone numbers ---
    let normalizedRemoteJid = remoteJid;
    if (isLidJid(remoteJid)) {
        normalizedRemoteJid = await resolveToPhoneJid(remoteJid, dbSessionId, remoteJidAlt);
    }
    if (senderJid && isLidJid(senderJid)) {
        senderJid = await resolveToPhoneJid(senderJid, dbSessionId, remoteJidAlt);
    }
    normalizedRemoteJid = formatToBrazilPhoneJid(normalizeJid(normalizedRemoteJid));
    if (senderJid) {
        senderJid = formatToBrazilPhoneJid(normalizeJid(senderJid));
    }


    // Download Media ONLY for live messages (triggerWebhook === true)
    // NEVER eagerly download media for historical sync messages (their CDN tokens are expired and cause timeouts/disconnects)
    let fileUrl: string | null = null;
    const isLive = triggerWebhook;
    const isRecent = Math.abs(Date.now() - timestamp.getTime()) < 12 * 60 * 60 * 1000;

    if (isLive && isRecent) {
        try {
            fileUrl = await downloadAndSaveMedia(msg, sessionId);
        } catch (e) {
            logger.error("Store", "Error downloading media in store", e);
        }
    }

    // Extract contextInfo (quoted message ID)
    let quoteId: string | null = null;
    if (msg.message) {
        const msgObj = msg.message as any;
        for (const key of Object.keys(msgObj)) {
            const inner = msgObj[key];
            if (inner && typeof inner === 'object' && inner !== null && 'contextInfo' in inner) {
                const contextInfo = (inner as any).contextInfo;
                if (contextInfo?.stanzaId) {
                    quoteId = contextInfo.stanzaId;
                    break;
                }
            }
        }
    }

    try {
        const finalRemoteJid = normalizedRemoteJid;
        const newMessage = await prisma.message.upsert({
            where: {
                sessionId_keyId: {
                    sessionId: dbSessionId,
                    keyId
                }
            },
            create: {
                sessionId: dbSessionId,
                remoteJid: finalRemoteJid,
                senderJid,
                fromMe: fromMe || false,
                keyId,
                pushName,
                type: messageType as any,
                content: text,
                mediaUrl: fileUrl, // Save Media URL
                status: fromMe ? "SENT" : "PENDING",
                timestamp,
                quoteId
            },
            update: {
                pushName: pushName || undefined,
                content: text || undefined,
            }
        });
        
        // Ensure contact exists (Upsert Contact)
        if (remoteJid && !remoteJid.includes('@g.us') && !remoteJid.includes('status@broadcast')) {
            const contactJid = finalRemoteJid; // Use fully normalized JID
            const contactData: any = {
                sessionId: dbSessionId,
                jid: contactJid
            };

            // Only update name/notify if message is FROM the contact (not from me)
            if (!fromMe) {
                if (pushName) contactData.notify = pushName;
                if (pushName) contactData.name = pushName;
            }

            const contact = await prisma.contact.upsert({
                where: { sessionId_jid: { sessionId: dbSessionId, jid: contactJid } },
                create: {
                    sessionId: dbSessionId,
                    jid: contactJid,
                    notify: !fromMe ? pushName : undefined,
                    name: !fromMe ? pushName : undefined,
                    // @ts-ignore
                    remoteJidAlt: remoteJidAlt || undefined
                },
                update: !fromMe ? {
                    notify: pushName,
                    // @ts-ignore
                    remoteJidAlt: remoteJidAlt || undefined
                } : {}
            });

            // If contact has a designated routing tag, ensure chat is tagged (live messages only)
            if (isLive) {
                const contactTag = (contact.data as any)?.tag;
                if (contactTag && typeof contactTag === 'string' && contactTag.trim()) {
                    try {
                        const tagName = contactTag.trim();
                        const sessionRec = await prisma.session.findUnique({
                            where: { id: dbSessionId },
                            select: { sessionId: true }
                        });
                        if (sessionRec?.sessionId) {
                            let label = await prisma.label.findUnique({
                                where: { sessionId_name: { sessionId: sessionRec.sessionId, name: tagName } }
                            });
                            if (!label) {
                                const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"];
                                const colorHex = colors[Math.floor(Math.random() * colors.length)];
                                label = await prisma.label.create({
                                    data: { sessionId: sessionRec.sessionId, name: tagName, colorHex }
                                });
                            }
                            await prisma.chatLabel.upsert({
                                where: { labelId_chatJid: { labelId: label.id, chatJid: finalRemoteJid } },
                                create: { labelId: label.id, chatJid: finalRemoteJid },
                                update: {}
                            });
                        }
                    } catch (tagErr) {
                        logger.debug("Store", "Non-fatal error ensuring contact tag on message:", tagErr);
                    }
                }
            }

            // Multi-attendant: Handle Attendance Queue (Em Espera / Reabertura automática)
            // ONLY FOR LIVE INCOMING MESSAGES! Never for historical sync or outgoing messages!
            const isBroadcast = finalRemoteJid.includes("status@broadcast") || finalRemoteJid.includes("@broadcast") || finalRemoteJid.includes("@newsletter");
            if (isLive && !fromMe && !isBroadcast) {
                try {
                    const existingAtt = await AttendanceService.getAttendance(sessionId, finalRemoteJid);
                    let attRecord: any = null;
                    let isReopenedOrNew = false;

                    if (existingAtt && existingAtt.status === "IN_PROGRESS") {
                        // PRESERVE IN_PROGRESS! NEVER RESET TO WAITING!
                        attRecord = existingAtt;
                        const contactTag = (contact.data as any)?.tag;
                        if (contactTag && !existingAtt.departmentTag) {
                            await prisma.$executeRawUnsafe(
                                `UPDATE \`ChatAttendance\` SET departmentTag = ? WHERE id = ?`,
                                contactTag.trim(),
                                existingAtt.id
                            );
                            attRecord.departmentTag = contactTag.trim();
                        }
                    } else if (existingAtt && existingAtt.status === "WAITING") {
                        attRecord = existingAtt;
                        const contactTag = (contact.data as any)?.tag;
                        if (contactTag && !existingAtt.departmentTag) {
                            await prisma.$executeRawUnsafe(
                                `UPDATE \`ChatAttendance\` SET departmentTag = ? WHERE id = ?`,
                                contactTag.trim(),
                                existingAtt.id
                            );
                            attRecord.departmentTag = contactTag.trim();
                        }
                    } else {
                        // Brand new or reopening from CLOSED
                        attRecord = await AttendanceService.handleIncomingMessage(sessionId, finalRemoteJid);
                        isReopenedOrNew = true;

                        const contactTag = (contact.data as any)?.tag;
                        if (contactTag && attRecord) {
                            await prisma.$executeRawUnsafe(
                                `UPDATE \`ChatAttendance\` SET departmentTag = COALESCE(departmentTag, ?) WHERE id = ?`,
                                contactTag.trim(),
                                attRecord.id
                            );
                            attRecord.departmentTag = attRecord.departmentTag || contactTag.trim();
                        }
                    }

                    // Remove "Finalizado" label if present so it transitions out of finished
                    const finLabels = await prisma.label.findMany({
                        where: { sessionId, name: { equals: "Finalizado" } },
                        select: { id: true }
                    });
                    if (finLabels.length > 0) {
                        const targetJids = [finalRemoteJid, remoteJid];
                        await prisma.chatLabel.deleteMany({
                            where: {
                                labelId: { in: finLabels.map(l => l.id) },
                                chatJid: { in: targetJids }
                            }
                        });
                    }

                    // Only emit attendance.update if attendance was newly created in WAITING or reopened from CLOSED
                    if (isReopenedOrNew && attRecord) {
                        io?.emit("attendance.update", { sessionId, jid: finalRemoteJid, status: attRecord.status, data: attRecord });
                        io?.to(sessionId).emit("attendance.update", { sessionId, jid: finalRemoteJid, status: attRecord.status, data: attRecord });
                    }
                } catch (attErr) {
                    logger.debug("Store", "Non-fatal error updating attendance queue on message:", attErr);
                }
            }

            // Welcome Message Logic
            if (isLive && !fromMe && config?.welcomeMessage && sock) {
                // Let's check if message count for this contact is exactly 1 (the one we just saved)
                const msgCount = await prisma.message.count({
                    where: { sessionId: dbSessionId, remoteJid: finalRemoteJid }
                });

                if (msgCount === 1) {
                    logger.info("Store", `Sending welcome message to ${finalRemoteJid}`);
                    await sock.sendMessage(finalRemoteJid, { text: config.welcomeMessage });
                }
            }
        }

        // Trigger webhook for new messages only (not history sync)
        if (triggerWebhook) {
            if (fromMe) {
                onMessageSent(sessionId, msg, fileUrl).catch(e => logger.error("Webhook", "Error in onMessageSent", e));
            } else {
                onMessageReceived(sessionId, msg, fileUrl).catch(e => logger.error("Webhook", "Error in onMessageReceived", e));
            }
        }

        return newMessage;
    } catch (e: any) {
        logger.error("Store", `Error saving message ${keyId}:`, e?.message || e);
        return null;
    }
}
// Placeholder - verified that I need to find the logic first
