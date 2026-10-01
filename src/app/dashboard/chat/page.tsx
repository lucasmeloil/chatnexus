import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";
import { cookies } from "next/headers";
import { canAccessSession } from "@/lib/api-auth";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { formatToBrazilPhoneJid } from "@/lib/jid-utils";

export default async function ChatPage({
    searchParams
}: {
    searchParams?: Promise<{ jid?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) return <div>Unauthorized</div>;

    const sp = await searchParams;
    let initialJid: string | undefined = undefined;
    if (sp?.jid) {
        const decoded = decodeURIComponent(sp.jid);
        initialJid = decoded.includes("@") ? decoded : formatToBrazilPhoneJid(decoded);
    }

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    let validSessionId: string | null = null;

    if (sessionId) {
        const hasAccess = await canAccessSession(session.user.id, session.user.role, sessionId);
        if (hasAccess) {
            validSessionId = sessionId;
        }
    }

    if (!validSessionId) {
        return (
            <SessionGuard>
                <ChatInterface sessionId={null} />
            </SessionGuard>
        );
    }

    return (
        <div className="h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-6rem)]">
            <ChatLayoutClient
                key={`${validSessionId}-${initialJid || "none"}`}
                sessionId={validSessionId}
                initialJid={initialJid}
            />
        </div>
    );
}
