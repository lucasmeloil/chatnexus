import { Server } from "socket.io";
import { logger } from "../lib/logger";

export function setupSocket(io: Server) {
  io.on("connection", (socket) => {
    logger.info("Socket", "Client connected:", socket.id);

    // Track active call rooms and role for clean disconnection
    const callRooms = new Set<string>();
    let socketCallRole: "agent" | "client" | null = null;
    let socketCallName: string | null = null;

    socket.on("disconnect", () => {
      logger.info("Socket", "Client disconnected:", socket.id);
      for (const roomId of callRooms) {
        const defaultReason = socketCallRole === "agent" 
          ? "Atendimento finalizado pelo atendente" 
          : "Chamada finalizada pelo cliente";
        socket.to(`call:${roomId}`).emit("call:ended", {
          bySocketId: socket.id,
          by: socketCallRole || "client",
          reason: defaultReason
        });
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
        socketCallRole = role;
        socketCallName = name || null;
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

    socket.on("call:end", (data: { roomId: string; reason?: string; by?: "agent" | "client" }) => {
        const { roomId, reason, by } = data || {};
        if (!roomId) return;
        const roomKey = `call:${roomId}`;
        const senderRole = by || socketCallRole || "client";
        socket.to(roomKey).emit("call:ended", {
            bySocketId: socket.id,
            by: senderRole,
            reason: reason || (senderRole === "agent" ? "Atendimento finalizado pelo atendente" : "Chamada finalizada pelo cliente")
        });
        socket.leave(roomKey);
        callRooms.delete(roomId);
    });
  });
}
