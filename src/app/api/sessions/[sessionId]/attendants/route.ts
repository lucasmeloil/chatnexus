import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/modules/whatsapp/attendance.service";
import bcrypt from "bcryptjs";

// GET: List attendants for a session
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado à sessão" }, { status: 403 });
        }

        // Get session record
        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Sessão não encontrada" }, { status: 404 });
        }

        // Get all accesses granted specifically to this session
        const accesses = await prisma.sessionAccess.findMany({
            where: { sessionId: sessionRecord.id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, createdAt: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Collect users with access
        const usersList: any[] = accesses.map(a => a.user).filter(Boolean);

        // Include the session owner at the beginning if not already in list
        const owner = await prisma.user.findUnique({
            where: { id: sessionRecord.userId },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });

        if (owner && !usersList.some(u => u.id === owner.id)) {
            usersList.unshift(owner);
        }

        // Enrich with attendant configs (allowedTags)
        const enriched = await Promise.all(
            usersList.map(async (u) => {
                const config = await AttendanceService.getAttendantConfig(u.id);
                return {
                    id: u.id,
                    userId: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    isOwner: u.id === sessionRecord.userId,
                    allowedTags: config?.allowedTags || [],
                    createdAt: u.createdAt
                };
            })
        );

        return NextResponse.json({
            status: true,
            data: enriched
        });
    } catch (error: any) {
        console.error("Get attendants error:", error);
        return NextResponse.json({ status: false, message: error.message || "Falha ao carregar atendentes" }, { status: 500 });
    }
}

// POST: Create a new attendant user and grant access with allowedTags
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const currentUser = await getAuthenticatedUser(request);
        if (!currentUser) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado à sessão" }, { status: 403 });
        }

        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Sessão não encontrada" }, { status: 404 });
        }

        const body = await request.json();
        const { name, email, password, role, allowedTags } = body;

        if (!email?.trim()) {
            return NextResponse.json({ status: false, message: "E-mail é obrigatório" }, { status: 400 });
        }

        const cleanEmail = email.trim().toLowerCase();
        let targetUser = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (!targetUser) {
            if (!password || password.length < 4) {
                return NextResponse.json({ status: false, message: "Senha deve ter pelo menos 4 caracteres para novo atendente" }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            targetUser = await prisma.user.create({
                data: {
                    email: cleanEmail,
                    name: name?.trim() || cleanEmail.split("@")[0],
                    password: hashedPassword,
                    role: role === "OWNER" ? "OWNER" : "STAFF"
                }
            });
        } else {
            // User exists: update optional name, password, or role
            const updateData: any = {};
            if (name?.trim()) updateData.name = name.trim();
            if (password && password.length >= 4) {
                updateData.password = await bcrypt.hash(password, 10);
            }
            if (role && ["STAFF", "OWNER"].includes(role)) {
                updateData.role = role;
            }

            if (Object.keys(updateData).length > 0) {
                targetUser = await prisma.user.update({
                    where: { id: targetUser.id },
                    data: updateData
                });
            }
        }

        // Link attendant to this session
        await prisma.sessionAccess.upsert({
            where: {
                sessionId_userId: {
                    sessionId: sessionRecord.id,
                    userId: targetUser.id
                }
            },
            create: {
                sessionId: sessionRecord.id,
                userId: targetUser.id
            },
            update: {}
        });

        // Save allowedTags in AttendantConfig
        const tags = Array.isArray(allowedTags) ? allowedTags : [];
        await AttendanceService.setAttendantConfig(targetUser.id, tags);

        return NextResponse.json({
            status: true,
            message: "Atendente cadastrado com sucesso e vinculado à sessão!",
            data: {
                userId: targetUser.id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                allowedTags: tags
            }
        });
    } catch (error: any) {
        console.error("Create attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Falha ao cadastrar atendente" }, { status: 500 });
    }
}

// PUT: Update an attendant's name, email, password, role or allowedTags
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const currentUser = await getAuthenticatedUser(request);
        if (!currentUser) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado à sessão" }, { status: 403 });
        }

        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Sessão não encontrada" }, { status: 404 });
        }

        const body = await request.json();
        const { userId, allowedTags, password, name, email, role } = body;

        if (!userId) {
            return NextResponse.json({ status: false, message: "ID do usuário é obrigatório" }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return NextResponse.json({ status: false, message: "Usuário não encontrado" }, { status: 404 });
        }

        const userUpdateData: any = {};
        if (name?.trim() && name.trim() !== existingUser.name) {
            userUpdateData.name = name.trim();
        }

        if (email?.trim()) {
            const cleanEmail = email.trim().toLowerCase();
            if (cleanEmail !== existingUser.email) {
                const emailInUse = await prisma.user.findUnique({
                    where: { email: cleanEmail }
                });
                if (emailInUse && emailInUse.id !== userId) {
                    return NextResponse.json({ status: false, message: "Este e-mail já está sendo utilizado por outro usuário" }, { status: 400 });
                }
                userUpdateData.email = cleanEmail;
            }
        }

        if (password && password.trim().length >= 4) {
            userUpdateData.password = await bcrypt.hash(password.trim(), 10);
        }

        if (role && ["STAFF", "OWNER", "SUPERADMIN"].includes(role)) {
            // Cannot change session owner's role from here
            if (userId !== sessionRecord.userId) {
                userUpdateData.role = role;
            }
        }

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({
                where: { id: userId },
                data: userUpdateData
            });
        }

        if (Array.isArray(allowedTags)) {
            await AttendanceService.setAttendantConfig(userId, allowedTags);
        }

        return NextResponse.json({
            status: true,
            message: "Configurações e dados do atendente atualizados com sucesso!"
        });
    } catch (error: any) {
        console.error("Update attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Falha ao atualizar atendente" }, { status: 500 });
    }
}

// DELETE: Revoke access or permanently delete an attendant
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const currentUser = await getAuthenticatedUser(request);
        if (!currentUser) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Acesso negado à sessão" }, { status: 403 });
        }

        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Sessão não encontrada" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const permanent = searchParams.get("permanent") === "true";

        if (!userId) {
            return NextResponse.json({ status: false, message: "ID do usuário é obrigatório" }, { status: 400 });
        }

        // Prevent deleting oneself
        if (userId === currentUser.id) {
            return NextResponse.json({ status: false, message: "Você não pode revogar ou excluir seu próprio usuário" }, { status: 400 });
        }

        // Prevent deleting session owner
        if (userId === sessionRecord.userId) {
            return NextResponse.json({ status: false, message: "Não é possível remover o proprietário desta sessão" }, { status: 400 });
        }

        // 1. Delete session access for this session
        await prisma.sessionAccess.deleteMany({
            where: {
                sessionId: sessionRecord.id,
                userId
            }
        });

        // 2. If permanent deletion is requested, delete user and associated configurations
        if (permanent) {
            // Delete all other session accesses
            await prisma.sessionAccess.deleteMany({
                where: { userId }
            }).catch(() => {});

            // Delete attendant config
            await AttendanceService.deleteAttendantConfig(userId).catch(() => {});

            // Unassign pending / active chats
            await prisma.$executeRawUnsafe(
                `UPDATE \`ChatAttendance\` SET assignedUserId = NULL, assignedUserName = NULL, status = 'WAITING' WHERE assignedUserId = ?`,
                userId
            ).catch(() => {});

            // Delete the user record
            await prisma.user.delete({
                where: { id: userId }
            }).catch(e => console.error("Error deleting user from database:", e));
        }

        return NextResponse.json({
            status: true,
            message: permanent 
                ? "Atendente excluído definitivamente do sistema com sucesso!" 
                : "Acesso do atendente revogado desta sessão com sucesso!"
        });
    } catch (error: any) {
        console.error("Delete attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Falha ao remover atendente" }, { status: 500 });
    }
}
