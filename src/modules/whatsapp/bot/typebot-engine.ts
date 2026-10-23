import fs from "fs";
import path from "path";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { normalizeMessageContent, downloadMediaMessage } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";

const TYPEBOT_DIR = path.join(process.cwd(), "data", "typebot");

export interface TypebotConfig {
    enabled: boolean;
    transcribeAudio: boolean;
    openaiApiKey?: string;
    humanHandoverKeywords: string; // e.g. "atendente, humano, suporte, sair"
    resetSessionHours: number; // e.g. 24
}

export interface ClientSessionState {
    currentGroupId: string | null;
    currentBlockIndex: number;
    waitingForInput: boolean;
    lastInteraction: number;
    pausedForHuman: boolean;
    collectedVariables: Record<string, any>;
}

export interface TypebotFlowSummary {
    id: string;
    name: string;
    version?: string;
    totalGroups: number;
    totalBlocks: number;
    updatedAt: string;
}

function ensureDirectory() {
    if (!fs.existsSync(TYPEBOT_DIR)) {
        fs.mkdirSync(TYPEBOT_DIR, { recursive: true });
    }
}

export function getTypebotFlowPath(sessionId: string): string {
    return path.join(TYPEBOT_DIR, `${sessionId}.json`);
}

export function getTypebotConfigPath(sessionId: string): string {
    return path.join(TYPEBOT_DIR, `${sessionId}-config.json`);
}

export function getTypebotSessionsPath(sessionId: string): string {
    return path.join(TYPEBOT_DIR, `${sessionId}-sessions.json`);
}

export function getTypebotConfig(sessionId: string): TypebotConfig {
    ensureDirectory();
    const configPath = getTypebotConfigPath(sessionId);
    const defaults: TypebotConfig = {
        enabled: false,
        transcribeAudio: true,
        openaiApiKey: "",
        humanHandoverKeywords: "atendente, humano, suporte, sair, falar com atendente",
        resetSessionHours: 24
    };

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            return { ...defaults, ...JSON.parse(raw) };
        } catch (e) {
            logger.error("Typebot", `Erro ao ler configurações do Typebot para ${sessionId}:`, e);
        }
    }
    return defaults;
}

export function saveTypebotConfig(sessionId: string, config: Partial<TypebotConfig>): TypebotConfig {
    ensureDirectory();
    const current = getTypebotConfig(sessionId);
    const updated = { ...current, ...config };
    fs.writeFileSync(getTypebotConfigPath(sessionId), JSON.stringify(updated, null, 2), "utf-8");
    return updated;
}

export function getTypebotFlow(sessionId: string): any | null {
    ensureDirectory();
    const flowPath = getTypebotFlowPath(sessionId);
    if (fs.existsSync(flowPath)) {
        try {
            const raw = fs.readFileSync(flowPath, "utf-8");
            return JSON.parse(raw);
        } catch (e) {
            logger.error("Typebot", `Erro ao ler fluxo do Typebot para ${sessionId}:`, e);
        }
    }
    return null;
}

export function saveTypebotFlow(sessionId: string, flowJson: any): TypebotFlowSummary {
    ensureDirectory();
    const flowPath = getTypebotFlowPath(sessionId);
    fs.writeFileSync(flowPath, JSON.stringify(flowJson, null, 2), "utf-8");

    const groups = flowJson.groups || [];
    let blockCount = 0;
    groups.forEach((g: any) => {
        if (Array.isArray(g.blocks)) blockCount += g.blocks.length;
    });

    return {
        id: flowJson.id || "typebot",
        name: flowJson.name || "Fluxo Typebot",
        version: flowJson.version || "6",
        totalGroups: groups.length,
        totalBlocks: blockCount,
        updatedAt: new Date().toISOString()
    };
}

export function deleteTypebotFlow(sessionId: string): boolean {
    ensureDirectory();
    const flowPath = getTypebotFlowPath(sessionId);
    if (fs.existsSync(flowPath)) {
        fs.unlinkSync(flowPath);
    }
    // Also reset sessions
    const sessionsPath = getTypebotSessionsPath(sessionId);
    if (fs.existsSync(sessionsPath)) {
        fs.unlinkSync(sessionsPath);
    }
    return true;
}

export function getTypebotSummary(sessionId: string): TypebotFlowSummary | null {
    const flow = getTypebotFlow(sessionId);
    if (!flow) return null;

    const groups = flow.groups || [];
    let blockCount = 0;
    groups.forEach((g: any) => {
        if (Array.isArray(g.blocks)) blockCount += g.blocks.length;
    });

    const flowPath = getTypebotFlowPath(sessionId);
    let updatedAt = new Date().toISOString();
    try {
        const stat = fs.statSync(flowPath);
        updatedAt = stat.mtime.toISOString();
    } catch {}

    return {
        id: flow.id || "typebot",
        name: flow.name || "Fluxo Typebot",
        version: flow.version || "6",
        totalGroups: groups.length,
        totalBlocks: blockCount,
        updatedAt
    };
}

function getClientSessions(sessionId: string): Record<string, ClientSessionState> {
    ensureDirectory();
    const sessionsPath = getTypebotSessionsPath(sessionId);
    if (fs.existsSync(sessionsPath)) {
        try {
            return JSON.parse(fs.readFileSync(sessionsPath, "utf-8"));
        } catch {}
    }
    return {};
}

function saveClientSessions(sessionId: string, sessions: Record<string, ClientSessionState>) {
    ensureDirectory();
    const sessionsPath = getTypebotSessionsPath(sessionId);
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), "utf-8");
}

// Extrai texto puro de blocos richText do Typebot
function extractTextFromRichText(richText: any[]): string {
    if (!Array.isArray(richText)) return "";
    let result = "";
    for (const item of richText) {
        if (Array.isArray(item.children)) {
            for (const child of item.children) {
                if (child.text) result += child.text;
            }
        } else if (item.text) {
            result += item.text;
        }
        result += "\n";
    }
    return result.trim();
}

// Transcrição de áudio via Whisper (OpenAI)
async function transcribeAudioWithWhisper(audioBuffer: Buffer, apiKey: string): Promise<string | null> {
    try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
        formData.append("file", blob, "voice.ogg");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey.trim()}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            return data.text || null;
        } else {
            const err = await response.text();
            logger.warn("Typebot", `Erro na transcrição Whisper OpenAI: ${err}`);
        }
    } catch (e) {
        logger.error("Typebot", "Falha ao transcrever áudio com Whisper:", e);
    }
    return null;
}

export async function processTypebotMessage(
    sock: WASocket,
    sessionId: string,
    msg: WAMessage
) {
    try {
        const fromMe = msg.key.fromMe || false;
        if (fromMe) return; // Não processa mensagens enviadas pelo próprio robô

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.endsWith("@g.us")) return; // Por padrão apenas conversas privadas 1 a 1

        const config = getTypebotConfig(sessionId);
        if (!config.enabled) return; // Typebot desativado

        const flow = getTypebotFlow(sessionId);
        if (!flow || !Array.isArray(flow.groups) || flow.groups.length === 0) return;

        const content = normalizeMessageContent(msg.message);
        let incomingText = content?.conversation || content?.extendedTextMessage?.text || "";

        // Verificação se é mensagem de áudio e se transcrição está ativa
        const isAudio = !!(content?.audioMessage);
        if (isAudio && config.transcribeAudio && config.openaiApiKey?.trim()) {
            try {
                logger.info("Typebot", `Mensagem de voz recebida de ${remoteJid}. Baixando para transcrição Whisper...`);
                const audioBuffer = await downloadMediaMessage(msg, "buffer", {});
                if (audioBuffer && audioBuffer.length > 0) {
                    const transcribed = await transcribeAudioWithWhisper(audioBuffer, config.openaiApiKey);
                    if (transcribed && transcribed.trim()) {
                        incomingText = transcribed.trim();
                        logger.info("Typebot", `Áudio transcrito com sucesso: "${incomingText}"`);
                    }
                }
            } catch (audioErr) {
                logger.error("Typebot", "Erro ao processar mensagem de áudio:", audioErr);
            }
        }

        if (!incomingText && !isAudio) return;

        const sessions = getClientSessions(sessionId);
        const now = Date.now();
        const resetIntervalMs = (config.resetSessionHours || 24) * 60 * 60 * 1000;

        let clientState: ClientSessionState | undefined = sessions[remoteJid];

        // Verificar transbordo humano
        const lowerText = incomingText.toLowerCase();
        const handoverWords = (config.humanHandoverKeywords || "atendente, humano, suporte, sair")
            .split(",")
            .map(w => w.trim().toLowerCase())
            .filter(Boolean);

        const isHandoverRequested = handoverWords.some(w => lowerText.includes(w));
        if (isHandoverRequested) {
            sessions[remoteJid] = {
                currentGroupId: null,
                currentBlockIndex: 0,
                waitingForInput: false,
                lastInteraction: now,
                pausedForHuman: true,
                collectedVariables: clientState?.collectedVariables || {}
            };
            saveClientSessions(sessionId, sessions);

            await sock.sendMessage(remoteJid, {
                text: "🙋‍♂️ *Atendimento Humano Solicitado*\n\nEntendido! Estou pausando as respostas automáticas e transferindo a sua solicitação para a nossa equipe de atendimento. Por favor, aguarde que em instantes um de nossos operadores falará com você."
            });
            return;
        }

        // Se estiver pausado para humano, checa se já expirou o tempo de reset
        if (clientState?.pausedForHuman) {
            if (now - clientState.lastInteraction > resetIntervalMs) {
                // Resetou a sessão após 24h
                clientState = undefined;
            } else {
                // Permanece pausado para o operador humano atender sem interferência do bot
                return;
            }
        }

        // Se a sessão expirou, reinicia
        if (clientState && (now - clientState.lastInteraction > resetIntervalMs)) {
            clientState = undefined;
        }

        // Se não tem estado ou está sem grupo atual, inicia do primeiro grupo do Typebot
        const groups: any[] = flow.groups;
        const edges: any[] = flow.edges || [];

        // Localiza grupo inicial (geralmente ligado ao evento 'start' ou o primeiro grupo da lista)
        let startingGroupId = groups[0]?.id;
        const startEvent = (flow.events || []).find((ev: any) => ev.type === "start");
        if (startEvent?.edgeId) {
            const edge = edges.find((e: any) => e.id === startEvent.edgeId);
            if (edge?.to?.groupId) startingGroupId = edge.to.groupId;
        }

        if (!clientState || !clientState.currentGroupId) {
            clientState = {
                currentGroupId: startingGroupId,
                currentBlockIndex: 0,
                waitingForInput: false,
                lastInteraction: now,
                pausedForHuman: false,
                collectedVariables: {}
            };
        }

        // Executar passos do fluxo
        await runFlowExecution(sock, sessionId, remoteJid, flow, clientState, incomingText, sessions);

    } catch (err) {
        logger.error("Typebot", "Erro geral na execução do fluxo do Typebot:", err);
    }
}

async function runFlowExecution(
    sock: WASocket,
    sessionId: string,
    remoteJid: string,
    flow: any,
    clientState: ClientSessionState,
    incomingText: string,
    sessions: Record<string, ClientSessionState>
) {
    const groups: any[] = flow.groups || [];
    const edges: any[] = flow.edges || [];
    const now = Date.now();

    let currentGroup = groups.find((g: any) => g.id === clientState.currentGroupId);
    if (!currentGroup) {
        currentGroup = groups[0];
        clientState.currentGroupId = currentGroup?.id || null;
        clientState.currentBlockIndex = 0;
        clientState.waitingForInput = false;
    }

    if (!currentGroup) return;

    // Se estava aguardando resposta do cliente para um Choice Input ou Text Input
    if (clientState.waitingForInput) {
        const waitingBlock = currentGroup.blocks?.[clientState.currentBlockIndex];
        
        if (waitingBlock) {
            if (waitingBlock.type === "choice input") {
                const items: any[] = waitingBlock.options || waitingBlock.items || [];
                const userChoice = incomingText.trim().toLowerCase();

                // Procura correspondência por índice numérico (1, 2, 3...) ou texto da opção
                let chosenItem = items.find((item: any, idx: number) => {
                    const numberMatch = userChoice === String(idx + 1);
                    const contentText = (item.content || item.label || "").trim().toLowerCase();
                    return numberMatch || userChoice.includes(contentText) || contentText.includes(userChoice);
                });

                if (!chosenItem && items.length > 0) {
                    // Resposta não reconhecida
                    await sock.sendMessage(remoteJid, {
                        text: "⚠️ Opção não reconhecida. Por favor, digite o *número* correspondente à opção desejada."
                    });
                    return;
                }

                if (chosenItem) {
                    // Localiza a aresta (edge) que parte dessa opção
                    const targetEdge = edges.find((e: any) => 
                        (e.from?.blockId === waitingBlock.id && e.from?.pathId === chosenItem.id) ||
                        (e.from?.blockId === waitingBlock.id && e.from?.itemId === chosenItem.id)
                    );

                    if (targetEdge?.to?.groupId) {
                        clientState.currentGroupId = targetEdge.to.groupId;
                        clientState.currentBlockIndex = 0;
                        clientState.waitingForInput = false;
                        currentGroup = groups.find((g: any) => g.id === clientState.currentGroupId);
                    } else {
                        // Avança para o próximo bloco no mesmo grupo se houver
                        clientState.currentBlockIndex++;
                        clientState.waitingForInput = false;
                    }
                }
            } else {
                // Input de texto livre - grava nas variáveis se houver
                if (waitingBlock.options?.variableId) {
                    clientState.collectedVariables[waitingBlock.options.variableId] = incomingText;
                }
                clientState.currentBlockIndex++;
                clientState.waitingForInput = false;
            }
        } else {
            clientState.waitingForInput = false;
            clientState.currentBlockIndex++;
        }
    }

    // Executa os blocos subsequentes até encontrar outro input ou o fim do grupo
    while (currentGroup && clientState.currentBlockIndex < (currentGroup.blocks?.length || 0)) {
        const block = currentGroup.blocks[clientState.currentBlockIndex];
        if (!block) break;

        // Processa tipo de bloco
        if (block.type === "text") {
            let messageText = "";
            if (block.content?.richText) {
                messageText = extractTextFromRichText(block.content.richText);
            } else if (typeof block.content === "string") {
                messageText = block.content;
            }

            if (messageText.trim()) {
                // Substitui variáveis conhecidas
                messageText = messageText.replace(/\{\{nome\}\}|\{\{name\}\}/gi, "Cliente");
                await sock.sendMessage(remoteJid, { text: messageText });
            }
            clientState.currentBlockIndex++;

        } else if (block.type === "image") {
            const url = block.content?.url;
            if (url) {
                await sock.sendMessage(remoteJid, { image: { url } });
            }
            clientState.currentBlockIndex++;

        } else if (block.type === "video") {
            const url = block.content?.url;
            if (url) {
                await sock.sendMessage(remoteJid, { video: { url } });
            }
            clientState.currentBlockIndex++;

        } else if (block.type === "audio") {
            const url = block.content?.url;
            if (url) {
                await sock.sendMessage(remoteJid, { audio: { url } });
            }
            clientState.currentBlockIndex++;

        } else if (block.type === "choice input") {
            const items: any[] = block.options || block.items || [];
            let optionsText = "";
            items.forEach((item: any, idx: number) => {
                const label = item.content || item.label || `Opção ${idx + 1}`;
                optionsText += `*${idx + 1}* - ${label}\n`;
            });

            const promptMessage = "👉 *Por favor, selecione uma das opções abaixo digitando o número desejado:*\n\n" + optionsText.trim();
            await sock.sendMessage(remoteJid, { text: promptMessage });

            clientState.waitingForInput = true;
            break; // Para o loop aguardando a resposta do cliente

        } else if (block.type === "text input") {
            // Pergunta de texto livre
            clientState.waitingForInput = true;
            break; // Para o loop aguardando digitação livre

        } else {
            // Outros tipos de blocos (condicionais, redirects): avança
            clientState.currentBlockIndex++;
        }
    }

    // Se chegou ao fim dos blocos do grupo atual, segue a aresta para o próximo grupo se houver
    if (currentGroup && clientState.currentBlockIndex >= (currentGroup.blocks?.length || 0) && !clientState.waitingForInput) {
        const nextEdge = edges.find((e: any) => e.from?.groupId === currentGroup.id || e.from?.blockId === currentGroup.blocks?.[currentGroup.blocks.length - 1]?.id);
        if (nextEdge?.to?.groupId) {
            clientState.currentGroupId = nextEdge.to.groupId;
            clientState.currentBlockIndex = 0;
            // Executa o próximo grupo recursivamente
            await runFlowExecution(sock, sessionId, remoteJid, flow, clientState, "", sessions);
        }
    }

    clientState.lastInteraction = now;
    sessions[remoteJid] = clientState;
    saveClientSessions(sessionId, sessions);
}
