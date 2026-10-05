import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { convertToOggOpus, VoiceProfile, VOICE_PROFILES } from "@/lib/audio-converter";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Não autorizado" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const profile = (formData.get("profile") as VoiceProfile) || "broadcast";

        if (!file) {
            return NextResponse.json({ status: false, message: "Arquivo de áudio obrigatório" }, { status: 400 });
        }

        const inputBuffer = Buffer.from(await file.arrayBuffer());
        const validProfile: VoiceProfile = VOICE_PROFILES[profile] ? profile : "broadcast";

        const processedBuffer = await convertToOggOpus(inputBuffer, validProfile);

        return new Response(processedBuffer, {
            status: 200,
            headers: {
                "Content-Type": "audio/ogg; codecs=opus",
                "Content-Disposition": 'inline; filename="preview.ogg"',
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        });
    } catch (err: any) {
        console.error("Voice preview error:", err);
        return NextResponse.json({ status: false, message: err?.message || "Erro ao processar áudio de teste" }, { status: 500 });
    }
}
