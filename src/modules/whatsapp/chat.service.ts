import { prisma } from "@/lib/prisma";
import { normalizeJid, isSameChatJid, formatToBrazilPhoneJid } from "@/lib/jid-utils";
import { waManager } from "@/modules/whatsapp/manager";
import { onMessageSent } from "@/lib/webhook";
import { AttendanceService } from "./attendance.service";
import Sticker from "wa-sticker-formatter";
import { convertToOggOpus } from "@/lib/audio-converter";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export class ChatService {
    /**
     * Get active chats list for a session with last message preview.
     * Cursor-based pagination — `before` is ISO timestamp of last seen chat.
     * Returns chats with last message timestamp < before (older).
     */
    static async getChatsList(
        dbSessionId: string,
        limit = 50,
        before?: string,
        search?: string
    ) {
        // 1. Get latest message per remoteJid with cursor pagination
        // Uses m1.timestamp < before (when provided) to load older chats
        // Build params: [dbSessionId, dbSessionId, (before?), limit]
        const qParams: any[] = [dbSessionId, dbSessionId];
        if (before) qParams.push(new Date(before));
        qParams.push(limit);

        const rawLastMessages = await prisma.$queryRawUnsafe<Array<{
            remoteJid: string;
            content: string | null;
            timestamp: Date;
            type: string;
            fromMe: boolean | number;
            keyId: string;
            status: string;
        }>>(`
            SELECT m1.remoteJid, m1.content, m1.timestamp, m1.type, m1.fromMe, m1.keyId, m1.status
            FROM \`Message\` m1
            INNER JOIN (
                SELECT remoteJid, MAX(timestamp) as max_ts
                FROM \`Message\`
                WHERE sessionId = ? AND remoteJid NOT LIKE '%status@broadcast%' AND remoteJid NOT LIKE '%@newsletter%'
                GROUP BY remoteJid
            ) m2 ON m1.remoteJid = m2.remoteJid AND m1.timestamp = m2.max_ts
            WHERE m1.sessionId = ? AND m1.remoteJid NOT LIKE '%status@broadcast%' AND m1.remoteJid NOT LIKE '%@newsletter%'
            ${before ? 'AND m1.timestamp < ?' : ''}
            ORDER BY m1.timestamp DESC
            LIMIT ?
        `, ...qParams);

        // Fast return if no messages
        if (rawLastMessages.length === 0) return [];

        // 2. Batch fetch contacts, groups & unread message counts ONLY for JIDs that have messages
        const jids = Array.from(new Set(rawLastMessages.map(m => m.remoteJid)));
        const inPlaceholders = jids.map(() => '?').join(',');

        let unreadCounts: Array<{ remoteJid: string; unreadCount: bigint | number }> = [];
        try {
            unreadCounts = await prisma.$queryRawUnsafe<Array<{ remoteJid: string; unreadCount: bigint | number }>>(`
                SELECT 
                    m.remoteJid,
                    COUNT(*) as unreadCount
                FROM \`Message\` m
                LEFT JOIN (
                    SELECT remoteJid, MAX(timestamp) as lastOutTs
                    FROM \`Message\`
                    WHERE sessionId = ? AND fromMe = 1 AND remoteJid IN (${inPlaceholders})
                    GROUP BY remoteJid
                ) out_m ON m.remoteJid = out_m.remoteJid
                WHERE m.sessionId = ? 
                  AND m.fromMe = 0 
                  AND m.status != 'READ'
                  AND m.remoteJid IN (${inPlaceholders})
                  AND (out_m.lastOutTs IS NULL OR m.timestamp > out_m.lastOutTs)
                GROUP BY m.remoteJid
            `, dbSessionId, ...jids, dbSessionId, ...jids);
        } catch (e) {
            console.error("Error querying unreadCounts in getChatsList:", e);
        }

        const [contacts, groups] = await Promise.all([
            prisma.contact.findMany({
                where: { sessionId: dbSessionId, jid: { in: jids } },
                select: { jid: true, name: true, notify: true, profilePic: true }
            }),
            prisma.group.findMany({
                where: { sessionId: dbSessionId, jid: { in: jids } },
                select: { jid: true, subject: true }
            })
        ]);

        // Build lookup map
        const infoMap = new Map<string, { name: string | null; notify: string | null; profilePic: string | null }>();
        contacts.forEach(c => infoMap.set(c.jid, { name: c.name, notify: c.notify, profilePic: c.profilePic }));
        groups.forEach(g => infoMap.set(g.jid, { name: g.subject, notify: g.subject, profilePic: null }));

        const unreadMap = new Map<string, number>();
        unreadCounts.forEach(u => unreadMap.set(u.remoteJid, Number(u.unreadCount || 0)));

        // 3. Build result array (already sorted by SQL DESC)
        const result: any[] = [];
        for (const msg of rawLastMessages) {
            // Check if this chat (or a variation of the same number with 12 vs 13 digits) was already added
            const existingIdx = result.findIndex(r => isSameChatJid(r.jid, msg.remoteJid));
            if (existingIdx !== -1) {
                // If this variation has unread messages, sum them up
                const existing = result[existingIdx];
                const altUnread = unreadMap.get(msg.remoteJid) || 0;
                if (altUnread > 0) {
                    existing.unreadCount = (existing.unreadCount || 0) + altUnread;
                }
                // If the current entry has a newer message, update preview
                const msgTs = new Date(msg.timestamp).getTime();
                const existingTs = existing.lastMessage?.timestamp ? new Date(existing.lastMessage.timestamp).getTime() : 0;
                if (msgTs > existingTs) {
                    result[existingIdx] = {
                        ...existing,
                        lastMessage: {
                            content: msg.content,
                            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : String(msg.timestamp),
                            type: msg.type,
                            fromMe: Boolean(msg.fromMe),
                            keyId: msg.keyId,
                            status: msg.status
                        }
                    };
                }
                continue;
            }

            const canonicalJid = formatToBrazilPhoneJid(msg.remoteJid);
            const info = infoMap.get(msg.remoteJid) || infoMap.get(canonicalJid);
            result.push({
                jid: canonicalJid || msg.remoteJid,
                name: info?.name || null,
                notify: info?.notify || null,
                profilePic: info?.profilePic || null,
                unreadCount: unreadMap.get(msg.remoteJid) || 0,
                lastMessage: {
                    content: msg.content,
                    timestamp: msg.timestamp instanceof Date
                        ? msg.timestamp.toISOString()
                        : String(msg.timestamp),
                    type: msg.type,
                    fromMe: Boolean(msg.fromMe),
                    keyId: msg.keyId,
                    status: msg.status
                }
            });
        }

        // 4. Apply in-memory search filter if needed
        if (search && search.trim()) {
            const q = search.toLowerCase();
            return result.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.notify || '').toLowerCase().includes(q) ||
                c.jid.toLowerCase().includes(q)
            );
        }

        return result;
    }

    /**
     * Get messages for a specific chat with cursor pagination (infinite scroll).
     * @param before ISO timestamp — load messages older than this
     * @param limit max messages to return
     */
    static async getMessages(
        dbSessionId: string,
        jid: string,
        limit = 50,
        before?: string
    ) {
        const normalizedJid = normalizeJid(jid);

        // Find contact variations (LID, alt JIDs, Brazilian 12/13 digits)
        const candidates = AttendanceService.getJidCandidates(jid);
        const contact = await prisma.contact.findFirst({
            where: {
                sessionId: dbSessionId,
                OR: [
                    { jid: { in: candidates } },
                    { lid: jid },
                    { remoteJidAlt: { in: candidates } },
                    { jid: normalizedJid }
                ]
            },
            select: { jid: true, lid: true, remoteJidAlt: true }
        });

        const queryJids = new Set([jid, normalizedJid, ...candidates]);
        if (contact) {
            if (contact.jid) queryJids.add(contact.jid);
            if (contact.lid) queryJids.add(contact.lid);
            if (contact.remoteJidAlt) queryJids.add(contact.remoteJidAlt);
        }

        const where: any = {
            sessionId: dbSessionId,
            remoteJid: { in: Array.from(queryJids) }
        };

        // Cursor-based: load older messages before this timestamp
        if (before) {
            where.timestamp = { lt: new Date(before) };
        }

        const messages = await prisma.message.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit + 1 // fetch 1 extra to know if there's more
        });

        const hasMore = messages.length > limit;
        if (hasMore) messages.pop();

        // Fetch quoted messages
        const quoteIds = messages.map(m => m.quoteId).filter((id): id is string => !!id);
        const quotedMessagesMap = new Map<string, { content: string | null; fromMe: boolean; senderJid: string | null; pushName: string | null }>();
        if (quoteIds.length > 0) {
            try {
                const quotedMsgs = await prisma.message.findMany({
                    where: { sessionId: dbSessionId, keyId: { in: quoteIds } },
                    select: { keyId: true, content: true, fromMe: true, senderJid: true, pushName: true }
                });
                quotedMsgs.forEach(qm => {
                    quotedMessagesMap.set(qm.keyId, {
                        content: qm.content,
                        fromMe: qm.fromMe,
                        senderJid: qm.senderJid,
                        pushName: qm.pushName
                    });
                });
            } catch (e) {
                console.error("Failed to batch load quoted messages:", e);
            }
        }

        const messagesWithQuote = messages.map((m: any) => {
            const quoted = m.quoteId ? quotedMessagesMap.get(m.quoteId) : undefined;
            return {
                ...m,
                quoted: quoted ? {
                    keyId: m.quoteId,
                    content: quoted.content,
                    fromMe: quoted.fromMe,
                    senderJid: quoted.senderJid,
                    pushName: quoted.pushName
                } : null
            };
        });

        // Return chronological order (oldest first)
        return {
            messages: messagesWithQuote.reverse(),
            hasMore
        };
    }

    /**
     * Resolve the canonical WhatsApp JID for sending.
     * Ensures Brazilian phone numbers (12 vs 13 digits) are sent to the exact
     * JID that actually exists and is registered on WhatsApp servers.
     */
    static async resolveSendingJid(sock: any, rawJid: string): Promise<string> {
        let jid = (rawJid || "").trim();
        if (jid.endsWith("@c.us")) {
            jid = jid.replace("@c.us", "@s.whatsapp.net");
        }

        // Preserve groups, newsletters, broadcasts, and LIDs
        if (jid.endsWith("@g.us") || jid.endsWith("@newsletter") || jid.endsWith("@broadcast") || jid.endsWith("@lid")) {
            return jid;
        }

        const digits = jid.replace(/@.*$/, "").replace(/\D/g, "");
        if (!digits) return jid;

        if (sock && typeof sock.onWhatsApp === "function") {
            try {
                // 1. Check exact digits
                const [check1] = await sock.onWhatsApp(digits);
                if (check1?.exists && check1.jid) {
                    return check1.jid;
                }

                // 2. If Brazilian number starting with 55
                if (digits.startsWith("55")) {
                    let altDigits: string | null = null;
                    if (digits.length === 12) {
                        // 12 digits: try with 9
                        altDigits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
                    } else if (digits.length === 13 && digits[4] === "9") {
                        // 13 digits: try without 9
                        altDigits = `${digits.slice(0, 4)}${digits.slice(5)}`;
                    }

                    if (altDigits) {
                        const [check2] = await sock.onWhatsApp(altDigits);
                        if (check2?.exists && check2.jid) {
                            return check2.jid;
                        }
                    }
                }
            } catch (err) {
                // Ignore onWhatsApp error and fallback
            }
        }

        if (jid.endsWith("@s.whatsapp.net")) {
            return jid;
        }
        return formatToBrazilPhoneJid(jid) || `${digits}@s.whatsapp.net`;
    }

    static async sendTextMessage(sessionId: string, jid: string, messagePayload: any, mentions?: string[], quotedMessageId?: string) {
        const instance = waManager.getInstance(sessionId);
        if (!instance || !instance.socket) {
            throw new Error("WhatsApp session is disconnected or not found");
        }
        const targetJid = await ChatService.resolveSendingJid(instance.socket, jid);

        // Handle quoted/reply message
        let quotedOption: any = undefined;
        if (quotedMessageId) {
            try {
                const dbSession = await prisma.session.findFirst({
                    where: { OR: [{ sessionId }, { id: sessionId }] },
                    select: { id: true }
                });
                if (dbSession) {
                    const quotedMsg = await prisma.message.findFirst({
                        where: { sessionId: dbSession.id, keyId: quotedMessageId },
                        select: { keyId: true, remoteJid: true, fromMe: true, content: true, senderJid: true }
                    });
                    if (quotedMsg) {
                        const rawParticipant = quotedMsg.fromMe 
                            ? instance.socket.user?.id 
                            : (quotedMsg.senderJid || quotedMsg.remoteJid);
                        
                        let cleanParticipant: string | undefined = undefined;
                        if (rawParticipant) {
                            const [userPart, domain] = rawParticipant.split('@');
                            const cleanUser = userPart.split(':')[0];
                            cleanParticipant = domain ? `${cleanUser}@${domain}` : cleanUser;
                        }

                        quotedOption = {
                            key: {
                                remoteJid: quotedMsg.remoteJid,
                                fromMe: quotedMsg.fromMe,
                                id: quotedMsg.keyId,
                                participant: cleanParticipant
                            },
                            message: {
                                conversation: quotedMsg.content || ""
                            }
                        };
                    }
                }
            } catch (e) {
                console.error("Error fetching quoted message (non-fatal):", e);
            }
        }

        let msgPayload = { ...messagePayload };

        // Normalize "text" to "caption" if a media message is sent with "text"
        if (msgPayload.text && (msgPayload.image || msgPayload.video || msgPayload.document || msgPayload.audio)) {
            if (!msgPayload.caption) {
                msgPayload.caption = msgPayload.text;
            }
            delete msgPayload.text;
        }

        if (msgPayload.sticker && (msgPayload.sticker.url || typeof msgPayload.sticker === 'string')) {
            const url = msgPayload.sticker.url || msgPayload.sticker;
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to fetch sticker media`);
                const buffer = await res.arrayBuffer();
                const sticker = new Sticker(Buffer.from(buffer), {
                    pack: msgPayload.sticker.pack || "WA-AKG Bot",
                    author: msgPayload.sticker.author || "WA-AKG",
                    type: "full",
                    quality: 50
                });
                msgPayload = { sticker: await sticker.toBuffer() };
            } catch (e: any) {
                throw new Error(`Failed to generate sticker from URL: ${e.message}`);
            }
        }

        if (msgPayload.image && typeof msgPayload.image === 'object' && msgPayload.image.url) {
            try {
                const res = await fetch(msgPayload.image.url);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                const buffer = await res.arrayBuffer();
                msgPayload.image = Buffer.from(buffer);
            } catch (e: any) {
                throw new Error(`Failed to fetch image from URL: ${e.message}`);
            }
        }

        if (msgPayload.video && typeof msgPayload.video === 'object' && msgPayload.video.url) {
            try {
                const res = await fetch(msgPayload.video.url);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                const buffer = await res.arrayBuffer();
                msgPayload.video = Buffer.from(buffer);
            } catch (e: any) {
                throw new Error(`Failed to fetch video from URL: ${e.message}`);
            }
        }

        if (msgPayload.document && typeof msgPayload.document === 'object' && msgPayload.document.url) {
            try {
                const res = await fetch(msgPayload.document.url);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                const buffer = await res.arrayBuffer();
                msgPayload.document = Buffer.from(buffer);
            } catch (e: any) {
                throw new Error(`Failed to fetch document from URL: ${e.message}`);
            }
        }

        if (msgPayload.audio && typeof msgPayload.audio === 'object' && msgPayload.audio.url) {
            try {
                const res = await fetch(msgPayload.audio.url);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                const buffer = await res.arrayBuffer();
                msgPayload.audio = Buffer.from(buffer);
            } catch (e: any) {
                throw new Error(`Failed to fetch audio from URL: ${e.message}`);
            }
        }

        if (msgPayload.text && mentions && Array.isArray(mentions)) {
            msgPayload.mentions = mentions;
        }

        const options: any = { mentions: mentions || [] };
        if (quotedOption) {
            options.quoted = quotedOption;
        }

        const sendResult = await instance.socket.sendMessage(targetJid, msgPayload, options);

        // Fire webhook for sent message (non-blocking)
        try {
            const webhookMsg: any = {
                key: sendResult?.key || sendResult || {},
                message: {
                    conversation: typeof msgPayload.text === 'string' ? msgPayload.text : (msgPayload.caption || "")
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            };

            // Map media types to proper message structure for webhook
            if (msgPayload.image) {
                webhookMsg.message = {
                    imageMessage: { caption: msgPayload.caption || "", mimetype: msgPayload.mimetype || "image/jpeg" }
                };
            } else if (msgPayload.video) {
                webhookMsg.message = {
                    videoMessage: { caption: msgPayload.caption || "", mimetype: msgPayload.mimetype || "video/mp4" }
                };
            } else if (msgPayload.audio) {
                webhookMsg.message = {
                    audioMessage: { mimetype: msgPayload.ptt ? "audio/ogg; codecs=opus" : "audio/mp4" }
                };
            } else if (msgPayload.document) {
                webhookMsg.message = {
                    documentMessage: { caption: msgPayload.caption || "", fileName: msgPayload.fileName || "document", mimetype: msgPayload.mimetype || "application/octet-stream" }
                };
            } else if (msgPayload.sticker) {
                webhookMsg.message = {
                    stickerMessage: {}
                };
            }

            onMessageSent(sessionId, webhookMsg).catch(e => console.error("Webhook error:", e));
        } catch (e) {
            // Non-blocking — webhook failure shouldn't break message send
        }

        // Instant DB persistence and UI socket broadcast
        if (sendResult?.key?.id) {
            try {
                const dbSession = await prisma.session.findFirst({
                    where: { OR: [{ sessionId }, { id: sessionId }] },
                    select: { id: true }
                });
                if (dbSession) {
                    const saved = await prisma.message.upsert({
                        where: {
                            sessionId_keyId: {
                                sessionId: dbSession.id,
                                keyId: sendResult.key.id
                            }
                        },
                        create: {
                            sessionId: dbSession.id,
                            remoteJid: targetJid,
                            fromMe: true,
                            keyId: sendResult.key.id,
                            type: (msgPayload.image ? "IMAGE" : msgPayload.video ? "VIDEO" : msgPayload.audio ? "AUDIO" : msgPayload.document ? "DOCUMENT" : msgPayload.sticker ? "STICKER" : "TEXT") as any,
                            content: typeof msgPayload.text === 'string' ? msgPayload.text : (msgPayload.caption || ""),
                            status: "SENT",
                            timestamp: new Date()
                        },
                        update: {
                            status: "SENT"
                        }
                    });

                    const globalIo = (global as any).io || instance.io;
                    if (globalIo) {
                        globalIo.to(sessionId).emit("message.update", [{
                            ...saved,
                            timestamp: saved.timestamp.toISOString()
                        }]);
                    }
                }
            } catch (err) {
                // Non-blocking
            }
        }

        return sendResult;
    }

    /**
     * Send a media message locally from a buffer.
     */
    static async sendMediaMessage(
        sessionId: string,
        jid: string,
        buffer: Buffer,
        type: string,
        mimetype: string,
        fileName: string,
        caption: string,
        voiceProfile?: any
    ) {
        let instance = waManager.getInstance(sessionId);
        if (!instance) {
            const dbSession = await prisma.session.findFirst({
                where: { OR: [{ id: sessionId }, { sessionId: sessionId }] },
                select: { sessionId: true }
            });
            if (dbSession) {
                instance = waManager.getInstance(dbSession.sessionId);
                sessionId = dbSession.sessionId;
            }
        }
        if (!instance || !instance.socket) {
            throw new Error("A sessão do WhatsApp está desconectada. Verifique o status da conexão em Sessões.");
        }
        const targetJid = await ChatService.resolveSendingJid(instance.socket, jid);

        const messageOptions: any = {};
        if (caption) messageOptions.caption = caption;
        messageOptions.mimetype = mimetype;

        let content: any = {};
        let finalBuffer = buffer;
        let finalMime = mimetype;

        if (type === 'image') {
            content = { image: buffer, ...messageOptions };
        } else if (type === 'video') {
            content = { video: buffer, ...messageOptions };
        } else if (type === 'audio') {
            content = { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: false };
        } else if (type === 'voice') {
            // Transcode voice note (WebM/WAV/MP3) to WhatsApp native Ogg Opus (PTT) with selected voiceProfile
            finalBuffer = await convertToOggOpus(buffer, voiceProfile);
            finalMime = 'audio/ogg; codecs=opus';
            content = { audio: finalBuffer, mimetype: finalMime, ptt: true };
        } else if (type === 'document') {
            content = { document: buffer, mimetype, fileName, ...messageOptions };
        } else if (type === 'sticker') {
            const sticker = new Sticker(buffer, {
                pack: "WA-AKG Bot",
                author: "WA-AKG",
                type: "full",
                quality: 50
            });
            content = { sticker: await sticker.toBuffer() };
        } else {
            content = { document: buffer, mimetype, fileName, ...messageOptions };
        }

        const sendResult = await instance.socket.sendMessage(targetJid, content);

        // Fire webhook for sent media message (non-blocking)
        try {
            const webhookMsg: any = {
                key: sendResult?.key || sendResult || {},
                message: {
                    conversation: caption || ""
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            };

            // Map media type to proper message structure for webhook
            if (type === 'image') {
                webhookMsg.message = { imageMessage: { caption: caption || "", mimetype } };
            } else if (type === 'video') {
                webhookMsg.message = { videoMessage: { caption: caption || "", mimetype } };
            } else if (type === 'audio' || type === 'voice') {
                webhookMsg.message = { audioMessage: { mimetype: finalMime, ptt: type === 'voice' } };
            } else if (type === 'document') {
                webhookMsg.message = { documentMessage: { caption: caption || "", fileName, mimetype } };
            } else if (type === 'sticker') {
                webhookMsg.message = { stickerMessage: {} };
            }

            onMessageSent(sessionId, webhookMsg).catch(e => console.error("Webhook error:", e));
        } catch (e) {
            // Non-blocking
        }

        // Instant DB persistence and UI socket broadcast for media
        if (sendResult?.key?.id) {
            try {
                // Save media locally so it is immediately viewable and clickable in UI
                const extMap: Record<string, string> = {
                    image: 'jpg',
                    video: 'mp4',
                    audio: 'mp3',
                    voice: 'ogg',
                    document: 'pdf',
                    sticker: 'webp'
                };
                let ext = extMap[type] || 'bin';
                if (fileName && fileName.includes('.')) {
                    ext = fileName.split('.').pop()?.toLowerCase() || ext;
                } else if (mimetype) {
                    const sub = mimetype.split('/')[1]?.split(';')[0]?.toLowerCase();
                    if (sub === 'jpeg') ext = 'jpg';
                    else if (sub) ext = sub;
                }

                const filename = `${sessionId}-${sendResult.key.id}.${ext}`;
                const mediaDir = path.join(process.cwd(), "data", "media");
                await mkdir(mediaDir, { recursive: true });
                const filePath = path.join(mediaDir, filename);
                await writeFile(filePath, finalBuffer);

                const fileUrl = `/api/media/${filename}`;

                const dbSession = await prisma.session.findFirst({
                    where: { OR: [{ sessionId }, { id: sessionId }] },
                    select: { id: true }
                });
                if (dbSession) {
                    const saved = await prisma.message.upsert({
                        where: {
                            sessionId_keyId: {
                                sessionId: dbSession.id,
                                keyId: sendResult.key.id
                            }
                        },
                        create: {
                            sessionId: dbSession.id,
                            remoteJid: targetJid,
                            fromMe: true,
                            keyId: sendResult.key.id,
                            type: (type === 'voice' ? 'AUDIO' : type.toUpperCase()) as any,
                            content: caption || fileName || "",
                            mediaUrl: fileUrl,
                            status: "SENT",
                            timestamp: new Date()
                        },
                        update: {
                            mediaUrl: fileUrl,
                            status: "SENT"
                        }
                    });

                    const globalIo = (global as any).io || instance.io;
                    if (globalIo) {
                        globalIo.to(sessionId).emit("message.update", [{
                            ...saved,
                            mediaUrl: fileUrl,
                            timestamp: saved.timestamp.toISOString()
                        }]);
                    }
                }
            } catch (err) {
                console.error("[ChatService] Error saving sent media:", err);
            }
        }

        return sendResult;
    }

    /**
     * Solicit on-demand message history for a specific chat directly from the user's mobile device
     */
    static async syncHistoryFromDevice(sessionId: string, jid: string, count = 50) {
        const dbSession = await prisma.session.findFirst({
            where: { OR: [{ sessionId }, { id: sessionId }] },
            select: { id: true, sessionId: true }
        });
        if (!dbSession) throw new Error("Sessão não encontrada");

        const targetSessionId = dbSession.sessionId;
        const instance = waManager.getInstance(targetSessionId);
        if (!instance || !instance.socket || (typeof instance.isReady === "function" && !instance.isReady())) {
            throw new Error("Instância do WhatsApp não está conectada ao dispositivo");
        }

        const candidates = AttendanceService.getJidCandidates(jid);
        const contact = await prisma.contact.findFirst({
            where: {
                sessionId: dbSession.id,
                OR: [
                    { jid: { in: candidates } },
                    { lid: jid },
                    { remoteJidAlt: { in: candidates } }
                ]
            },
            select: { jid: true, remoteJidAlt: true }
        });

        const queryJids = new Set([jid, ...candidates]);
        if (contact?.jid) queryJids.add(contact.jid);
        if (contact?.remoteJidAlt) queryJids.add(contact.remoteJidAlt);

        // Find the oldest message in database for this chat to query backwards
        const oldestMsg = await prisma.message.findFirst({
            where: {
                sessionId: dbSession.id,
                remoteJid: { in: Array.from(queryJids) }
            },
            orderBy: { timestamp: 'asc' },
            select: { keyId: true, fromMe: true, timestamp: true, remoteJid: true }
        });

        let targetJid = jid;
        if (targetJid.includes('@c.us')) {
            targetJid = targetJid.replace('@c.us', '@s.whatsapp.net');
        }

        const oldestMsgKey = oldestMsg ? {
            remoteJid: oldestMsg.remoteJid || targetJid,
            id: oldestMsg.keyId,
            fromMe: oldestMsg.fromMe
        } : {
            remoteJid: targetJid,
            id: '',
            fromMe: false
        };

        const oldestTimestamp = oldestMsg
            ? oldestMsg.timestamp.getTime()
            : Date.now();

        await (instance.socket as any).fetchMessageHistory(count, oldestMsgKey, oldestTimestamp);

        return { success: true, count, oldestId: oldestMsgKey.id };
    }
}

