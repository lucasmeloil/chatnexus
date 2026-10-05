import { prisma } from "@/lib/prisma";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";

export const usePrismaAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    
    // Helper to read JSON with Buffer handling
    const readData = async (type: string, id: string) => {
        try {
            const key = `${type}-${id}`;
            const data = await prisma.authState.findUnique({
                where: { sessionId_key: { sessionId, key } }
            });
            if (data && data.value) {
                return JSON.parse(JSON.stringify(data.value), BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            logger.error("Auth", `Error reading auth state (${type}-${id}):`, error);
            return null;
        }
    };

    // Helper to write data
    const writeData = async (type: string, id: string, data: any) => {
        try {
            const key = `${type}-${id}`;
            const value = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            
            await prisma.authState.upsert({
                where: { sessionId_key: { sessionId, key } },
                create: { sessionId, key, value },
                update: { value }
            });
        } catch (error) {
             logger.error("Auth", `Error writing auth state (${type}-${id}):`, error);
        }
    };

    const removeData = async (type: string, id: string) => {
        try {
            const key = `${type}-${id}`;
            await prisma.authState.deleteMany({
                where: { sessionId, key }
            });
        } catch (error) {
            // ignore
        }
    };

    const creds: AuthenticationCreds = (await readData('creds', 'me')) || initAuthCreds();

    // Debounced and serialized creds saving to prevent concurrent write collisions
    let isSavingCreds = false;
    let credsSaveQueued = false;
    const saveCreds = async () => {
        if (isSavingCreds) {
            credsSaveQueued = true;
            return;
        }
        isSavingCreds = true;
        try {
            await writeData('creds', 'me', creds);
        } finally {
            isSavingCreds = false;
            if (credsSaveQueued) {
                credsSaveQueued = false;
                await saveCreds();
            }
        }
    };

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks: (() => Promise<void>)[] = [];
                    for (const category in data) {
                        const categoryData = data[category as keyof typeof data];
                        if (!categoryData) continue;
                        
                        for (const id in categoryData) {
                            const value = categoryData[id];
                            if (value) {
                                tasks.push(() => writeData(category, id, value));
                            } else {
                                tasks.push(() => removeData(category, id));
                            }
                        }
                    }
                    // Run tasks in small concurrent batches to prevent MySQL deadlocks and pool exhaustion
                    const BATCH_SIZE = 8;
                    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                        await Promise.all(tasks.slice(i, i + BATCH_SIZE).map(fn => fn()));
                    }
                }
            }
        },
        saveCreds
    };
};
