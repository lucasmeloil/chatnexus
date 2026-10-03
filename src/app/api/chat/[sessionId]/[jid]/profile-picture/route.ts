import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

// GET: Fetch profile picture URL for a JID (with fallback across Brazilian 9th digit and LID)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid } = await params;

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const decodedJid = decodeURIComponent(jid);
        const cleanDigits = decodedJid.replace(/@.*$/, "").replace(/\D/g, "");

        // Build candidate JIDs (12 vs 13 digits, LID, etc.)
        const targetJids: string[] = [decodedJid];
        if (cleanDigits.startsWith("55")) {
            if (cleanDigits.length === 13 && cleanDigits[4] === "9") {
                targetJids.push(`${cleanDigits.slice(0, 4)}${cleanDigits.slice(5)}@s.whatsapp.net`);
            } else if (cleanDigits.length === 12) {
                targetJids.push(`${cleanDigits.slice(0, 4)}9${cleanDigits.slice(4)}@s.whatsapp.net`);
            }
        }

        // Check if contact in DB has lid or remoteJidAlt
        const contactDb = await prisma.contact.findFirst({
            where: {
                OR: [
                    { jid: { in: targetJids } },
                    { remoteJidAlt: { in: targetJids } },
                    { lid: { in: targetJids } }
                ]
            },
            select: { jid: true, remoteJidAlt: true, lid: true, profilePic: true }
        });

        if (contactDb?.lid && !targetJids.includes(contactDb.lid)) {
            targetJids.push(contactDb.lid);
        }
        if (contactDb?.remoteJidAlt && !targetJids.includes(contactDb.remoteJidAlt)) {
            targetJids.push(contactDb.remoteJidAlt);
        }

        const instance = waManager.getInstance(sessionId);
        let profilePicUrl: string | null = null;

        if (instance?.socket) {
            for (const candidate of targetJids) {
                try {
                    const pic = await instance.socket.profilePictureUrl(candidate, 'image');
                    if (pic) {
                        profilePicUrl = pic;
                        break;
                    }
                } catch {
                    try {
                        const pic = await instance.socket.profilePictureUrl(candidate, 'preview');
                        if (pic) {
                            profilePicUrl = pic;
                            break;
                        }
                    } catch {}
                }
            }
        }

        // If found from live Baileys, update DB cache
        if (profilePicUrl) {
            try {
                await prisma.contact.updateMany({
                    where: {
                        OR: targetJids.map(j => ({ jid: j }))
                    },
                    data: { profilePic: profilePicUrl }
                });
            } catch {}
        } else if (contactDb?.profilePic) {
            profilePicUrl = contactDb.profilePic;
        }

        return NextResponse.json({ 
            success: true,
            status: true,
            jid: decodedJid,
            profilePicUrl
        });

    } catch (error) {
        console.error("Fetch profile picture error:", error);
        return NextResponse.json({ status: false, message: "Failed to fetch profile picture", error: "Failed to fetch profile picture" }, { status: 500 });
    }
}

// POST: Upload a custom profile picture or trigger refresh
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden", error: "Forbidden" }, { status: 403 });
        }

        const decodedJid = decodeURIComponent(jid);
        const cleanDigits = decodedJid.replace(/@.*$/, "").replace(/\D/g, "");

        const contentType = request.headers.get("content-type") || "";

        // Mode A: File upload for custom contact picture
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const file = formData.get("file") as File;
            if (!file) {
                return NextResponse.json({ status: false, message: "Arquivo obrigatório" }, { status: 400 });
            }

            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const filename = `profile-${sessionId}-${cleanDigits}-${Date.now()}.${ext}`;
            const mediaDir = path.join(process.cwd(), "data", "media");
            await mkdir(mediaDir, { recursive: true });
            const filePath = path.join(mediaDir, filename);

            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(filePath, buffer);

            const localUrl = `/api/media/${filename}`;

            // Update in DB
            const targetJids = [decodedJid];
            if (cleanDigits.startsWith("55")) {
                if (cleanDigits.length === 13 && cleanDigits[4] === "9") {
                    targetJids.push(`${cleanDigits.slice(0, 4)}${cleanDigits.slice(5)}@s.whatsapp.net`);
                } else if (cleanDigits.length === 12) {
                    targetJids.push(`${cleanDigits.slice(0, 4)}9${cleanDigits.slice(4)}@s.whatsapp.net`);
                }
            }

            await prisma.contact.updateMany({
                where: { OR: targetJids.map(j => ({ jid: j })) },
                data: { profilePic: localUrl }
            });

            return NextResponse.json({
                status: true,
                success: true,
                message: "Foto do contato atualizada com sucesso!",
                profilePicUrl: localUrl
            });
        }

        // Mode B: Regular GET/fetch trigger
        return GET(request, { params });

    } catch (error: any) {
        console.error("Save profile picture error:", error);
        return NextResponse.json({ status: false, message: error?.message || "Erro ao salvar foto" }, { status: 500 });
    }
}
