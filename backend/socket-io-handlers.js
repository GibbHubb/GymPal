// Socket.IO event handlers for GymPal
// Covers:
//   1. TV/group session (trainer → TV screen) — original handlers
//   2. Client live session (trainer → individual client phone) — G1 addition
//   3. Push notifications via Expo — G2 addition
const { sendToUser } = require('./services/push_service');

module.exports = (io) => {
  // ── State ──────────────────────────────────────────────────────────────
  const trainerSessions = new Map()   // socketId → session data
  const sessionViewers  = new Map()   // trainerSocketId → Set<viewerSocketId>
  const clientSessions  = new Map()   // clientId → trainerSocketId

  const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)

  // ── Connection ─────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    log(`Connected: ${socket.id}`)

    socket.emit("connectionAck", {
      socketId: socket.id,
      message:  "Connection established with server",
    })

    // ── User room registration (client phones) ──────────────────────────
    // Client emits this on connect so trainer can target them by userId
    socket.on("register_user", ({ userId } = {}) => {
      if (!userId) return
      socket.join(`user:${userId}`)
      log(`User ${userId} joined room user:${userId} (socket ${socket.id})`)
    })

    // ── Trainer registration (TV sessions) ─────────────────────────────
    socket.on("registerTrainer", (data) => {
      log(`Trainer registration: ${data.sessionName} (${socket.id})`)
      try {
        trainerSessions.set(socket.id, {
          sessionId:        socket.id,
          sessionName:      data.sessionName      || "Unnamed Session",
          workoutName:      data.workoutName      || "Unnamed Workout",
          participantCount: data.participantCount || 0,
          userId:           data.userId           || "unknown",
          connectedAt:      new Date().toISOString(),
        })
        if (!sessionViewers.has(socket.id)) sessionViewers.set(socket.id, new Set())

        socket.emit("trainerRegistered", {
          sessionId:   socket.id,
          sessionName: data.sessionName || "Unnamed Session",
          success:     true,
        })
        broadcastAvailableSessions()
      } catch (err) {
        socket.emit("registrationError", { message: "Registration failed: " + err.message })
      }
    })

    socket.on("unregisterTrainer", (data) => {
      log(`Trainer unregistered: ${data.sessionName} (${socket.id})`)
      trainerSessions.delete(socket.id)
      if (sessionViewers.has(socket.id)) {
        sessionViewers.get(socket.id).forEach((viewerId) => {
          io.sockets.sockets.get(viewerId)?.emit("trainerSessionRemoved", socket.id)
        })
        sessionViewers.delete(socket.id)
      }
      broadcastAvailableSessions()
    })

    // ── TV screen join/leave ────────────────────────────────────────────
    socket.on("joinSession", ({ sessionId } = {}) => {
      log(`TV ${socket.id} joining session ${sessionId}`)
      if (sessionViewers.has(sessionId)) {
        sessionViewers.get(sessionId).add(socket.id)
        io.sockets.sockets.get(sessionId)?.emit("tvJoined", { tvId: socket.id })
      } else {
        socket.emit("sessionError", { message: "Session not found or no longer active" })
      }
    })

    socket.on("leaveSession", ({ sessionId } = {}) => {
      sessionViewers.get(sessionId)?.delete(socket.id)
    })

    socket.on("getAvailableSessions", () => {
      socket.emit("availableSessions", Array.from(trainerSessions.values()))
    })

    // ── Workout update (trainer → TV) ───────────────────────────────────
    socket.on("workoutUpdate", (data) => {
      if (!trainerSessions.has(socket.id)) {
        socket.emit("registrationRequired", { message: "Please register as a trainer first" })
        return
      }
      if (data.workout?.participants) {
        const s = trainerSessions.get(socket.id)
        s.participantCount = data.workout.participants.length
        trainerSessions.set(socket.id, s)
        io.emit("trainerSessionUpdate", s)
      }
      sessionViewers.get(socket.id)?.forEach((viewerId) => {
        io.sockets.sockets.get(viewerId)?.emit("workoutUpdate", data)
      })
    })

    socket.on("tvSync", (data) => {
      if (!trainerSessions.has(socket.id)) return
      sessionViewers.get(socket.id)?.forEach((viewerId) => {
        io.sockets.sockets.get(viewerId)?.emit("tvSync", data)
      })
    })

    socket.on("trainerWorkoutUpdate", (data) => {
      if (!trainerSessions.has(socket.id)) return
      sessionViewers.get(socket.id)?.forEach((viewerId) => {
        io.sockets.sockets.get(viewerId)?.emit("trainerWorkoutUpdate", data)
      })
    })

    socket.on("trainerTVSync", (data) => {
      if (!trainerSessions.has(socket.id)) return
      sessionViewers.get(socket.id)?.forEach((viewerId) => {
        io.sockets.sockets.get(viewerId)?.emit("trainerTVSync", data)
      })
    })

    socket.on("requestWorkoutData", ({ sessionId, tvId } = {}) => {
      if (sessionId) {
        const trainerSocket = io.sockets.sockets.get(sessionId)
        if (trainerSocket) {
          trainerSocket.emit("requestWorkoutData", { tvId: socket.id })
        } else {
          socket.emit("trainerNotAvailable", { sessionId })
        }
      }
    })

    // ── Client live session (trainer → individual client phone) ─────────

    // Trainer starts a live session for a specific client
    socket.on("start_client_session", ({ clientId } = {}) => {
      if (!clientId) return
      log(`Trainer ${socket.id} starting client session for ${clientId}`)

      const roomName = `client_session:${clientId}`
      socket.join(roomName)
      clientSessions.set(clientId, socket.id)

      // Notify the client (they must be in room user:{clientId})
      io.to(`user:${clientId}`).emit("session_started", {
        trainerSocketId: socket.id,
        clientId,
      })

      // G2 — push notification (reaches client even if app is backgrounded)
      sendToUser(clientId, 'Live Session Started 📡', 'Your trainer has started a live session — join now.', {
        screen: 'TrainingScreen',
      })

      socket.emit("client_session_ack", { clientId, started: true })
    })

    // Trainer pushes an exercise to the active client session
    socket.on("push_exercise", ({ clientId, exercise } = {}) => {
      if (!clientId || !exercise) return
      log(`Trainer ${socket.id} pushing exercise to client ${clientId}`)

      io.to(`client_session:${clientId}`).emit("exercise_pushed", { exercise })
    })

    // Trainer ends the client session
    socket.on("end_client_session", ({ clientId } = {}) => {
      if (!clientId) return
      log(`Trainer ${socket.id} ending client session for ${clientId}`)

      io.to(`client_session:${clientId}`).emit("session_ended", { clientId })
      socket.leave(`client_session:${clientId}`)
      clientSessions.delete(clientId)

      socket.emit("client_session_ack", { clientId, started: false })
    })

    // Client joins their own session room (so they receive exercise pushes)
    socket.on("join_client_session", ({ clientId } = {}) => {
      if (!clientId) return
      socket.join(`client_session:${clientId}`)
      log(`Client ${clientId} joined client_session room`)
    })

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      log(`Disconnected: ${socket.id}`)

      if (trainerSessions.has(socket.id)) {
        sessionViewers.get(socket.id)?.forEach((viewerId) => {
          io.sockets.sockets.get(viewerId)?.emit("trainerSessionRemoved", socket.id)
        })
        sessionViewers.delete(socket.id)
        trainerSessions.delete(socket.id)
        broadcastAvailableSessions()
      }

      // Clean up any client sessions this trainer owned
      for (const [clientId, trainerSocketId] of clientSessions.entries()) {
        if (trainerSocketId === socket.id) {
          io.to(`client_session:${clientId}`).emit("session_ended", { clientId })
          clientSessions.delete(clientId)
        }
      }

      sessionViewers.forEach((viewers) => viewers.delete(socket.id))
    })
  })

  // ── Helpers ────────────────────────────────────────────────────────────
  function broadcastAvailableSessions() {
    const sessions = Array.from(trainerSessions.values())
    log(`Broadcasting ${sessions.length} available sessions`)
    io.emit("availableSessions", sessions)
  }

  setInterval(broadcastAvailableSessions, 10_000)

  // Stale session cleanup (>12 h)
  setInterval(() => {
    const now = new Date()
    let cleaned = 0
    trainerSessions.forEach((session, socketId) => {
      if ((now - new Date(session.connectedAt)) / 3_600_000 > 12) {
        trainerSessions.delete(socketId)
        sessionViewers.delete(socketId)
        cleaned++
      }
    })
    if (cleaned > 0) {
      log(`Cleaned ${cleaned} stale sessions`)
      broadcastAvailableSessions()
    }
  }, 3_600_000)
}
