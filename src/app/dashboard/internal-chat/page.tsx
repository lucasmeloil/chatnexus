import { Metadata } from "next";
import { InternalChatView } from "@/components/internal-chat/internal-chat-view";

export const metadata: Metadata = {
    title: "Chat Interno da Equipe | NEXUS Chat",
    description: "Comunicação interna em tempo real entre atendentes e administradores",
};

export default function InternalChatPage() {
    return (
        <div className="h-full w-full p-4 lg:p-6 flex flex-col">
            <InternalChatView />
        </div>
    );
}

