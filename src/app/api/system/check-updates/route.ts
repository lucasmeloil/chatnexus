import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });

    try {
        // Remover notificações antigas de repositórios legados/externos caso existam
        await prisma.notification.deleteMany({
            where: {
                OR: [
                    { title: { contains: "New Update Available" } },
                    { message: { contains: "WA-AKG" } },
                ]
            }
        }).catch(() => {});

        return NextResponse.json({
            status: true,
            message: "NEXUS Chat is up to date",
            data: { upToDate: true }
        });
    } catch {
        return NextResponse.json({ status: true, message: "OK" });
    }
}
