import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "10";
        const isAll = limitParam === "all";
        const limit = isAll ? 0 : parseInt(limitParam) || 10;
        const search = searchParams.get("search") || "";

        // Check if user can access this session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        // Resolve sessionId string to database ID (CUID)
        const sessionData = await prisma.session.findUnique({
            where: { sessionId: sessionId },
            select: { id: true }
        });

        if (!sessionData) {
            return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
        }

        const where: any = {
            sessionId: sessionData.id,
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { notify: { contains: search } },
                { verifiedName: { contains: search } },
                { jid: { contains: search } },
                { remoteJidAlt: { contains: search } }
            ];
        }

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                ...(isAll ? {} : { skip: (page - 1) * limit, take: limit }),
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { messages: true }
                    }
                }
            }),
            prisma.contact.count({ where })
        ]);

        // Fetch associated labels/tags for these contacts
        const contactJids = contacts.map(c => c.jid);
        const chatLabels = contactJids.length > 0
            ? await prisma.chatLabel.findMany({
                where: { chatJid: { in: contactJids } },
                include: { label: true }
            })
            : [];

        const labelMap = new Map<string, { id: string; name: string; colorHex: string }[]>();
        for (const cl of chatLabels) {
            if (!labelMap.has(cl.chatJid)) labelMap.set(cl.chatJid, []);
            labelMap.get(cl.chatJid)!.push({
                id: cl.label.id,
                name: cl.label.name,
                colorHex: cl.label.colorHex
            });
        }

        const enrichedContacts = contacts.map(c => ({
            ...c,
            labels: labelMap.get(c.jid) || [],
            notes: (c.data as any)?.notes || null,
            tag: (c.data as any)?.tag || null
        }));

        return NextResponse.json({
            status: true,
            message: "Contacts retrieved successfully",
            data: enrichedContacts,
            meta: {
                total,
                page: isAll ? 1 : page,
                limit: isAll ? total : limit,
                totalPages: isAll ? 1 : Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching contacts:", error);
        return NextResponse.json({ status: false, message: "Internal Server Error", error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const sessionData = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionData) {
            return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
        }

        const body = await req.json();
        const { name, phone, notes, tag } = body;

        if (!phone || typeof phone !== "string" || !phone.trim()) {
            return NextResponse.json({ status: false, message: "O número de telefone é obrigatório", error: "Phone number required" }, { status: 400 });
        }

        // Format to Brazilian phone format (+55 auto-injected if 10-11 digits)
        const formattedJid = formatToBrazilPhoneJid(phone.trim());
        const contactName = (name && typeof name === "string" && name.trim()) ? name.trim() : formattedJid.replace("@s.whatsapp.net", "");

        const customData: any = {};
        if (notes && typeof notes === "string" && notes.trim()) customData.notes = notes.trim();
        if (tag && typeof tag === "string" && tag.trim()) customData.tag = tag.trim();

        // 1. Create or update contact in DB
        const contact = await prisma.contact.upsert({
            where: {
                sessionId_jid: {
                    sessionId: sessionData.id,
                    jid: formattedJid
                }
            },
            create: {
                sessionId: sessionData.id,
                jid: formattedJid,
                name: contactName,
                notify: contactName,
                data: Object.keys(customData).length > 0 ? customData : undefined
            },
            update: {
                name: contactName,
                notify: contactName,
                data: Object.keys(customData).length > 0 ? customData : undefined
            }
        });

        // 2. If a tag is specified, link/create the label and assign ChatLabel
        if (tag && typeof tag === "string" && tag.trim()) {
            const tagName = tag.trim();
            let label = await prisma.label.findUnique({
                where: {
                    sessionId_name: {
                        sessionId: sessionId,
                        name: tagName
                    }
                }
            });

            if (!label) {
                // Select a distinctive color for the tag
                const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"];
                const colorHex = colors[Math.floor(Math.random() * colors.length)];
                label = await prisma.label.create({
                    data: {
                        sessionId: sessionId,
                        name: tagName,
                        colorHex
                    }
                });
            }

            await prisma.chatLabel.upsert({
                where: {
                    labelId_chatJid: {
                        labelId: label.id,
                        chatJid: formattedJid
                    }
                },
                create: {
                    labelId: label.id,
                    chatJid: formattedJid
                },
                update: {}
            });
        }

        return NextResponse.json({
            status: true,
            message: "Contato salvo com sucesso!",
            data: {
                ...contact,
                tag: customData.tag || null,
                notes: customData.notes || null
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error("Error creating contact:", error);
        return NextResponse.json({
            status: false,
            message: error.message || "Erro ao salvar contato",
            error: error.message
        }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const sessionData = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionData) {
            return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
        }

        const body = await req.json();
        const { id, jid, phone, name, notes, tag } = body;

        let targetJid = jid;
        if (!targetJid && phone) {
            targetJid = formatToBrazilPhoneJid(phone.trim());
        }

        if (!targetJid && !id) {
            return NextResponse.json({ status: false, message: "Identificador do contato obrigatório", error: "Missing identifier" }, { status: 400 });
        }

        const existing = id
            ? await prisma.contact.findUnique({ where: { id } })
            : await prisma.contact.findUnique({
                where: {
                    sessionId_jid: {
                        sessionId: sessionData.id,
                        jid: targetJid
                    }
                }
            });

        if (!existing) {
            return NextResponse.json({ status: false, message: "Contato não encontrado", error: "Contact not found" }, { status: 404 });
        }

        const finalJid = existing.jid;
        const contactName = (name && typeof name === "string" && name.trim()) ? name.trim() : existing.name;

        const currentData: any = (existing.data as any) || {};
        if (notes !== undefined) currentData.notes = typeof notes === "string" && notes.trim() ? notes.trim() : null;
        if (tag !== undefined) currentData.tag = typeof tag === "string" && tag.trim() ? tag.trim() : null;

        // 1. Update contact in database
        const updated = await prisma.contact.update({
            where: { id: existing.id },
            data: {
                name: contactName,
                notify: contactName,
                data: currentData
            }
        });

        // 2. Handle Tag / Label updates
        if (tag !== undefined) {
            const tagName = typeof tag === "string" ? tag.trim() : "";

            // Delete current ChatLabels for this chat in this session
            const currentSessionLabels = await prisma.label.findMany({
                where: { sessionId },
                select: { id: true }
            });
            const sessionLabelIds = currentSessionLabels.map(l => l.id);

            if (sessionLabelIds.length > 0) {
                await prisma.chatLabel.deleteMany({
                    where: {
                        chatJid: finalJid,
                        labelId: { in: sessionLabelIds }
                    }
                });
            }

            // Assign new label if tag provided
            if (tagName) {
                let label = await prisma.label.findUnique({
                    where: {
                        sessionId_name: {
                            sessionId: sessionId,
                            name: tagName
                        }
                    }
                });

                if (!label) {
                    const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"];
                    const colorHex = colors[Math.floor(Math.random() * colors.length)];
                    label = await prisma.label.create({
                        data: {
                            sessionId: sessionId,
                            name: tagName,
                            colorHex
                        }
                    });
                }

                await prisma.chatLabel.upsert({
                    where: {
                        labelId_chatJid: {
                            labelId: label.id,
                            chatJid: finalJid
                        }
                    },
                    create: {
                        labelId: label.id,
                        chatJid: finalJid
                    },
                    update: {}
                });
            }
        }

        return NextResponse.json({
            status: true,
            message: "Contato atualizado com sucesso!",
            data: {
                ...updated,
                tag: currentData.tag || null,
                notes: currentData.notes || null
            }
        });

    } catch (error: any) {
        console.error("Error updating contact:", error);
        return NextResponse.json({
            status: false,
            message: error.message || "Erro ao atualizar contato",
            error: error.message
        }, { status: 500 });
    }
}
