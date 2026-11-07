import { Server } from "socket.io";
import { logger } from "../lib/logger";

export function setupSocket(io: Server) {
  io.on("connection", (socket) => {
    logger.info("Socket", "Client connected:", socket.id);

    // Track active call rooms for clean disconnection
    const callRooms = new Set<string>();

    socket.on("disconnect", () => {
      logger.info("Socket", "Client disconnected:", socket.id);
      for (const roomId of callRooms) {
        socket.to(`call:${roomId}`).emit("call:peer-left", { socketId: socket.id });
      }
      callRooms.clear();
    });

    // Handle joining room for specific WA session
    socket.on("join-session", (sessionId: string) => {
        socket.join(sessionId);
        logger.debug("Socket", `Socket ${socket.id} joined session room: ${sessionId}`);
    });

    // Handle joining user-specific room for notifications
    socket.on("join-user-room", (userId: string) => {
        socket.join(`user:${userId}`);
        logger.debug("Socket", `Socket ${socket.id} joined user room: user:${userId}`);
    });

    // WebRTC Voice Call Signaling
    socket.on("call:join", (data: { roomId: string; role: "agent" | "client"; name?: string }) => {
        const { roomId, role, name } = data || {};
        if (!roomId) return;
        const roomKey = `call:${roomId}`;
        socket.join(roomKey);
        callRooms.add(roomId);
        logger.info("Socket", `Socket ${socket.id} (${role} - ${name || "Sem nome"}) joined call room: ${roomId}`);

        // Notify other peer in the room
        socket.to(roomKey).emit("call:peer-joined", {
            socketId: socket.id,
            role,
            name: name || (role === "agent" ? "Atendente" : "Cliente")
        });
    });

    socket.on("call:signal", (data: { roomId: string; signal: any; targetSocketId?: string }) => {
        const { roomId, signal, targetSocketId } = data || {};
        if (!roomId || !signal) return;
        const roomKey = `call:${roomId}`;

        if (targetSocketId) {
            io.to(targetSocketId).emit("call:signal", {
                fromSocketId: socket.id,
                signal
            });
        } else {
            socket.to(roomKey).emit("call:signal", {
                fromSocketId: socket.id,
                signal
            });
        }
    });

    socket.on("call:end", (data: { roomId: string; reason?: string }) => {
        const { roomId, reason } = data || {};
        if (!roomId) return;
        const roomKey = `call:${roomId}`;
        socket.to(roomKey).emit("call:ended", {
            bySocketId: socket.id,
            reason: reason || "Chamada finalizada"
        });
        socket.leave(roomKey);
        callRooms.delete(roomId);
    });
  });
}
