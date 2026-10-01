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
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        // Get session record
        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Session not found" }, { status: 404 });
        }

        // Get all accesses
        const accesses = await prisma.sessionAccess.findMany({
            where: { sessionId: sessionRecord.id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, createdAt: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Collect users
        const usersList: any[] = accesses.map(a => a.user);

        // Also include the session owner if not already in list
        if (!usersList.some(u => u.id === sessionRecord.userId)) {
            const owner = await prisma.user.findUnique({
                where: { id: sessionRecord.userId },
                select: { id: true, name: true, email: true, role: true, createdAt: true }
            });
            if (owner) usersList.push(owner);
        }

        // If list is still small or only 1, include other system attendants so transfer is always possible
        if (usersList.length <= 1) {
            const allUsers = await prisma.user.findMany({
                select: { id: true, name: true, email: true, role: true, createdAt: true }
            });
            for (const u of allUsers) {
                if (!usersList.some(existing => existing.id === u.id)) {
                    usersList.push(u);
                }
            }
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
        return NextResponse.json({ status: false, message: error.message || "Failed to load attendants" }, { status: 500 });
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
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Session not found" }, { status: 404 });
        }

        const body = await request.json();
        const { name, email, password, allowedTags } = body;

        if (!email?.trim()) {
            return NextResponse.json({ status: false, message: "Email é obrigatório" }, { status: 400 });
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
                    role: "STAFF"
                }
            });
        } else if (password && password.length >= 4) {
            // Update password if specified
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { id: targetUser.id },
                data: {
                    name: name?.trim() || targetUser.name,
                    password: hashedPassword
                }
            });
        }

        // Ensure session access
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
                allowedTags: tags
            }
        });
    } catch (error: any) {
        console.error("Create attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Failed to create attendant" }, { status: 500 });
    }
}

// PUT: Update an attendant's allowedTags or password
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const currentUser = await getAuthenticatedUser(request);
        if (!currentUser) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { userId, allowedTags, password, name } = body;

        if (!userId) {
            return NextResponse.json({ status: false, message: "User ID is required" }, { status: 400 });
        }

        const userUpdateData: any = {};
        if (name?.trim()) userUpdateData.name = name.trim();
        if (password && password.length >= 4) {
            userUpdateData.password = await bcrypt.hash(password, 10);
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
            message: "Configurações do atendente atualizadas com sucesso!"
        });
    } catch (error: any) {
        console.error("Update attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Failed to update attendant" }, { status: 500 });
    }
}

// DELETE: Revoke access of an attendant
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const currentUser = await getAuthenticatedUser(request);
        if (!currentUser) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(currentUser.id, currentUser.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });
        }

        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, message: "Session not found" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ status: false, message: "User ID is required" }, { status: 400 });
        }

        await prisma.sessionAccess.deleteMany({
            where: {
                sessionId: sessionRecord.id,
                userId
            }
        });

        return NextResponse.json({
            status: true,
            message: "Acesso do atendente revogado com sucesso"
        });
    } catch (error: any) {
        console.error("Delete attendant error:", error);
        return NextResponse.json({ status: false, message: error.message || "Failed to revoke attendant access" }, { status: 500 });
    }
}
