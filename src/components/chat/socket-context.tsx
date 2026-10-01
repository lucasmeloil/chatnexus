"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type SocketContextValue = {
    socket: Socket | null;
    ready: boolean;
    getSocket: () => Socket | null;
    joinSession: (sessionId: string) => void;
};

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    ready: false,
    getSocket: () => null,
    joinSession: () => {},
});

export function useSocket() {
    return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const s = io({
            path: "/api/socket/io",
            addTrailingSlash: false,
            transports: ["websocket", "polling"],
        });

        s.on("connect", () => {
            setReady(true);
        });

        s.on("disconnect", () => {
            setReady(false);
        });

        socketRef.current = s;
        setSocket(s);

        return () => {
            s.disconnect();
            socketRef.current = null;
            setSocket(null);
            setReady(false);
        };
    }, []);

    const getSocket = () => socketRef.current;

    const joinSession = (sessionId: string) => {
        const s = socketRef.current;
        if (s?.connected) {
            s.emit("join-session", sessionId);
        }
    };

    return (
        <SocketContext.Provider value={{ socket, ready, getSocket, joinSession }}>
            {children}
        </SocketContext.Provider>
    );
}
