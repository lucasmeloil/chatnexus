import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Check if a JID is in @lid format (WhatsApp Linked ID)
 */
export function isLidJid(jid: string | undefined | null): boolean {
    if (!jid) return false;
    return jid.endsWith("@lid");
}

/**
 * Normalize a JID to standard format.
 * Primarily ensures that @c.us is converted to @s.whatsapp.net.
 * Does not touch @g.us or @broadcast.
 */
export function normalizeJid(jid: string | undefined | null): string {
    if (!jid) return "";
    if (jid.endsWith("@c.us")) {
        return jid.replace("@c.us", "@s.whatsapp.net");
    }
    return jid;
}

/**
 * Normaliza qualquer número de telefone ou JID para formato de WhatsApp brasileiro (@s.whatsapp.net).
 * Adiciona automaticamente o DDI +55 quando informado com DDD (10 ou 11 dígitos, ex: 11987654321).
 * Suporta formatos:
 *  - "+55 (11) 98765-4321" -> "5511987654321@s.whatsapp.net"
 *  - "(11) 98765-4321"     -> "5511987654321@s.whatsapp.net"
 *  - "11987654321"         -> "5511987654321@s.whatsapp.net"
 *  - "011987654321"        -> "5511987654321@s.whatsapp.net"
 *  - "5511987654321"       -> "5511987654321@s.whatsapp.net"
 *  - IDs de grupos (@g.us) ou canais (@newsletter) são mantidos intactos.
 */
export function formatToBrazilPhoneJid(raw: string | undefined | null): string {
    if (!raw) return "";
    let trimmed = raw.trim();
    if (trimmed.endsWith("@g.us") || trimmed.endsWith("@newsletter") || trimmed.endsWith("@broadcast") || trimmed.endsWith("@lid")) {
        return trimmed;
    }
    let jidClean = trimmed.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "");
    let digits = jidClean.replace(/\D/g, "");

    // Se começa com 0 (ex: 011987654321), remove o 0 inicial
    if (digits.startsWith("0")) {
        digits = digits.substring(1);
    }

    // Se possui 10 ou 11 dígitos (DDD + 8 ou 9 dígitos), é número do Brasil sem o DDI 55
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
        digits = "55" + digits;
    }

    // Se possui 12 dígitos com DDI 55 (55 + DDD de 2 dígitos + 8 dígitos), adiciona o 9º dígito
    if (digits.length === 12 && digits.startsWith("55")) {
        digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
    }

    return `${digits}@s.whatsapp.net`;
}

/**
 * Resolve a @lid JID to @s.whatsapp.net phone number JID.
 * 
 * Resolution strategy:
 *   1. Inline remoteJidAlt (from Baileys message key) if provided
 *   2. DB Contact lookup (contact.remoteJidAlt or matching by lid field)
 *   3. Falls back to the original JID if no resolution is found
 *
 * For non-LID JIDs: returns the original JID unchanged.
 * For group JIDs (@g.us) or broadcast: returns unchanged.
 */
export async function resolveToPhoneJid(
    jid: string,
    dbSessionId: string,
    inlineAlt?: string | null
): Promise<string> {
    if (!jid) return jid;

    // Only resolve if it's a @lid JID
    if (!isLidJid(jid)) return jid;

    // 1. Use inline remoteJidAlt if provided
    if (inlineAlt && !isLidJid(inlineAlt)) {
        return inlineAlt;
    }

    // 2. Try DB lookup
    try {
        const contact = await prisma.contact.findFirst({
            where: {
                sessionId: dbSessionId,
                OR: [
                    { jid: jid },
                    { lid: jid }
                ]
            },
            select: { jid: true, remoteJidAlt: true, lid: true }
        });

        if (contact) {
            // If remoteJidAlt is a phone JID, use it
            if (contact.remoteJidAlt && !isLidJid(contact.remoteJidAlt)) {
                return contact.remoteJidAlt;
            }
            // If the primary jid is a phone JID, use it
            if (contact.jid && !isLidJid(contact.jid)) {
                return contact.jid;
            }
        }
    } catch (e) {
        logger.error("JID", `resolveToPhoneJid: DB lookup failed for ${jid}`, e);
    }

    // 3. Fallback: return original JID
    return jid;
}

/**
 * Resolve a @lid JID using sessionId (string, e.g., "session-01") instead of dbSessionId (cuid).
 * This is a convenience wrapper that first looks up the DB session ID.
 */
export async function resolveToPhoneJidBySessionId(
    jid: string,
    sessionId: string,
    inlineAlt?: string | null
): Promise<string> {
    if (!jid || !isLidJid(jid)) return jid;

    // 1. Use inline remoteJidAlt if provided
    if (inlineAlt && !isLidJid(inlineAlt)) {
        return inlineAlt;
    }

    try {
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (session) {
            return resolveToPhoneJid(jid, session.id, inlineAlt);
        }
    } catch (e) {
        logger.error("JID", `resolveToPhoneJidBySessionId: Session lookup failed for ${sessionId}`, e);
    }

    return jid;
}

/**
 * Batch resolve multiple JIDs at once (efficient for lists).
 * Builds a LID→Phone lookup map from the Contact table in a single query,
 * then applies it to all provided JIDs.
 */
export async function batchResolveToPhoneJid(
    jids: string[],
    dbSessionId: string
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const lids = jids.filter(j => isLidJid(j));

    // No LIDs to resolve, return identity map
    if (lids.length === 0) {
        jids.forEach(j => result.set(j, j));
        return result;
    }

    // Batch query: find contacts that match any of the LID JIDs
    try {
        const contacts = await prisma.contact.findMany({
            where: {
                sessionId: dbSessionId,
                OR: [
                    { jid: { in: lids } },
                    { lid: { in: lids } }
                ]
            },
            select: { jid: true, lid: true, remoteJidAlt: true }
        });

        // Build lookup map
        for (const c of contacts) {
            const phoneJid = (c.remoteJidAlt && !isLidJid(c.remoteJidAlt))
                ? c.remoteJidAlt
                : (!isLidJid(c.jid) ? c.jid : null);

            if (phoneJid) {
                // Map by jid (if it's a LID)
                if (isLidJid(c.jid)) {
                    result.set(c.jid, phoneJid);
                }
                // Map by lid field
                if (c.lid && isLidJid(c.lid)) {
                    result.set(c.lid, phoneJid);
                }
            }
        }
    } catch (e) {
        logger.error("JID", `batchResolveToPhoneJid: DB query failed`, e);
    }

    // Fill in any un-resolved JIDs with themselves
    for (const jid of jids) {
        if (!result.has(jid)) {
            result.set(jid, jid);
        }
    }

    return result;
}

/**
 * Compare two JIDs for equality, handling Brazilian 12 vs 13 digits variations
 * (@s.whatsapp.net, @c.us, with/without the 9th digit).
 */
export function isSameChatJid(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    if (a === b) return true;

    // Both normalize to same Brazilian phone JID (handles 10, 11, 12, 13 digits)
    const normA = formatToBrazilPhoneJid(a);
    const normB = formatToBrazilPhoneJid(b);
    if (normA && normB && normA === normB) return true;

    const cleanA = a.replace(/@.*$/, "").replace(/\D/g, "");
    const cleanB = b.replace(/@.*$/, "").replace(/\D/g, "");
    if (cleanA && cleanB && cleanA === cleanB) return true;

    if (cleanA.startsWith("55") && cleanB.startsWith("55")) {
        if (cleanA.length === 13 && cleanB.length === 12 && cleanA[4] === "9") {
            return `${cleanA.slice(0, 4)}${cleanA.slice(5)}` === cleanB;
        }
        if (cleanB.length === 13 && cleanA.length === 12 && cleanB[4] === "9") {
            return `${cleanB.slice(0, 4)}${cleanB.slice(5)}` === cleanA;
        }
    }
    return false;
}
