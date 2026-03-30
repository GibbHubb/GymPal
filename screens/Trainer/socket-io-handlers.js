// Socket.IO event handlers for gym application
module.exports = (io) => {
  // Track active trainer sessions
  const trainerSessions = new Map()

  // Track TV viewers for each trainer session
  const sessionViewers = new Map()

  // Debug helper function
  const logDebug = (message) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${message}`)
  }

  io.on("connection", (socket) => {
    logDebug(`Client connected: ${socket.id}`)

    // Send immediate connection acknowledgment
    socket.emit("connectionAck", {
      socketId: socket.id,
      message: "Connection established with server",
    })

    // Handle trainer registration
    socket.on("registerTrainer", (data) => {
      logDebug(`Trainer registration attempt: ${data.sessionName} (${socket.id})`)

      try {
        // Store trainer session data
        trainerSessions.set(socket.id, {
          sessionId: socket.id,
          sessionName: data.sessionName || "Unnamed Session",
          workoutName: data.workoutName || "Unnamed Workout",
          participantCount: data.participantCount || 0,
          userId: data.userId || "unknown",
          connectedAt: new Date().toISOString(),
        })

        // Initialize empty viewers list for this session
        if (!sessionViewers.has(socket.id)) {
          sessionViewers.set(socket.id, new Set())
        }

        // Confirm registration to the trainer - CRITICAL STEP
        logDebug(`Sending trainerRegistered confirmation to ${socket.id}`)
        socket.emit("trainerRegistered", {
          sessionId: socket.id,
          sessionName: data.sessionName || "Unnamed Session",
          success: true,
        })

        // Broadcast updated sessions list to all clients
        broadcastAvailableSessions()
      } catch (error) {
        logDebug(`Error in registerTrainer: ${error.message}`)
        socket.emit("registrationError", {
          message: "Registration failed: " + error.message,
        })
      }
    })

    // Handle trainer unregistration
    socket.on("unregisterTrainer", (data) => {
      logDebug(`Trainer unregistered: ${data.sessionName} (${socket.id})`)

      // Remove trainer session
      trainerSessions.delete(socket.id)

      // Notify all viewers that this session is gone
      if (sessionViewers.has(socket.id)) {
        const viewers = sessionViewers.get(socket.id)
        viewers.forEach((viewerId) => {
          const viewer = io.sockets.sockets.get(viewerId)
          if (viewer) {
            viewer.emit("trainerSessionRemoved", socket.id)
          }
        })

        // Clean up viewers list
        sessionViewers.delete(socket.id)
      }

      // Broadcast updated sessions list to all clients
      broadcastAvailableSessions()
    })

    // Handle TV screen joining a session
    socket.on("joinSession", (data) => {
      const { sessionId } = data
      logDebug(`TV joined session: ${sessionId} (TV: ${socket.id})`)

      // Add this TV to the session's viewers
      if (sessionViewers.has(sessionId)) {
        sessionViewers.get(sessionId).add(socket.id)

        // Notify the trainer that a TV joined
        const trainerSocket = io.sockets.sockets.get(sessionId)
        if (trainerSocket) {
          trainerSocket.emit("tvJoined", { tvId: socket.id })
        }
      } else {
        logDebug(`Warning: TV tried to join non-existent session: ${sessionId}`)
        socket.emit("sessionError", {
          message: "Session not found or no longer active",
        })
      }
    })

    // Handle TV screen leaving a session
    socket.on("leaveSession", (data) => {
      const { sessionId } = data
      logDebug(`TV left session: ${sessionId} (TV: ${socket.id})`)

      // Remove this TV from the session's viewers
      if (sessionViewers.has(sessionId)) {
        sessionViewers.get(sessionId).delete(socket.id)
      }
    })

    // Handle request for available sessions
    socket.on("getAvailableSessions", () => {
      logDebug(`Sessions requested by: ${socket.id}`)

      // Get current sessions
      const sessions = Array.from(trainerSessions.values())
      logDebug(`Sending ${sessions.length} available sessions to ${socket.id}`)

      // Send available sessions to this client
      socket.emit("availableSessions", sessions)
    })

    // Handle workout updates from trainers
    socket.on("workoutUpdate", (data) => {
      logDebug(`Workout update from trainer: ${socket.id}`)

      // Only process if this is a registered trainer
      if (trainerSessions.has(socket.id)) {
        // Update participant count in session data
        if (data.workout && data.workout.participants) {
          const sessionData = trainerSessions.get(socket.id)
          sessionData.participantCount = data.workout.participants.length
          trainerSessions.set(socket.id, sessionData)

          // Broadcast updated session info
          io.emit("trainerSessionUpdate", sessionData)
        }

        // Forward to all viewers of this session
        if (sessionViewers.has(socket.id)) {
          const viewers = sessionViewers.get(socket.id)
          logDebug(`Forwarding workout update to ${viewers.size} viewers`)

          viewers.forEach((viewerId) => {
            const viewer = io.sockets.sockets.get(viewerId)
            if (viewer) {
              viewer.emit("workoutUpdate", data)
            }
          })
        }
      } else {
        logDebug(`Warning: Workout update from unregistered trainer: ${socket.id}`)
        // Re-register the trainer if they're trying to send updates but aren't registered
        socket.emit("registrationRequired", { message: "Please register as a trainer first" })
      }
    })

    // Handle TV sync data from trainers
    socket.on("tvSync", (data) => {
      logDebug(`TV sync from trainer: ${socket.id}`)

      // Only process if this is a registered trainer
      if (trainerSessions.has(socket.id)) {
        // Forward to all viewers of this session
        if (sessionViewers.has(socket.id)) {
          const viewers = sessionViewers.get(socket.id)
          viewers.forEach((viewerId) => {
            const viewer = io.sockets.sockets.get(viewerId)
            if (viewer) {
              viewer.emit("tvSync", data)
            }
          })
        }
      } else {
        logDebug(`Warning: TV sync from unregistered trainer: ${socket.id}`)
      }
    })

    // Handle request for workout data from TV screens
    socket.on("requestWorkoutData", (data) => {
      const { sessionId } = data || {}
      logDebug(`Workout data requested by: ${socket.id} for session: ${sessionId}`)

      // If sessionId is provided, forward request to that specific trainer
      if (sessionId) {
        const trainerSocket = io.sockets.sockets.get(sessionId)
        if (trainerSocket) {
          trainerSocket.emit("requestWorkoutData", { tvId: socket.id })
        } else {
          logDebug(`Trainer socket not found for session: ${sessionId}`)
          // Notify the TV that the trainer is not available
          socket.emit("trainerNotAvailable", { sessionId })
        }
      }
    })

    // Handle disconnection
    socket.on("disconnect", () => {
      logDebug(`Client disconnected: ${socket.id}`)

      // If this was a trainer, clean up their session
      if (trainerSessions.has(socket.id)) {
        logDebug(`Trainer session cleanup for: ${socket.id}`)

        // Notify all viewers that this session is gone
        if (sessionViewers.has(socket.id)) {
          const viewers = sessionViewers.get(socket.id)
          viewers.forEach((viewerId) => {
            const viewer = io.sockets.sockets.get(viewerId)
            if (viewer) {
              viewer.emit("trainerSessionRemoved", socket.id)
            }
          })

          // Clean up viewers list
          sessionViewers.delete(socket.id)
        }

        // Remove trainer session
        trainerSessions.delete(socket.id)

        // Broadcast updated sessions list to all clients
        broadcastAvailableSessions()
      }

      // Remove this client from any session viewers lists
      sessionViewers.forEach((viewers, sessionId) => {
        if (viewers.has(socket.id)) {
          viewers.delete(socket.id)
        }
      })
    })
  })

  // Helper function to broadcast available sessions to all clients
  function broadcastAvailableSessions() {
    const sessions = Array.from(trainerSessions.values())
    logDebug(`Broadcasting ${sessions.length} available sessions to all clients`)
    io.emit("availableSessions", sessions)
  }

  // Set up a periodic refresh of available sessions
  setInterval(() => {
    broadcastAvailableSessions()
  }, 10000)

  // Set up a periodic check for stale sessions (cleanup)
  setInterval(() => {
    const now = new Date()
    let cleanupCount = 0

    trainerSessions.forEach((session, socketId) => {
      const sessionTime = new Date(session.connectedAt)
      const hoursSinceConnection = (now - sessionTime) / (1000 * 60 * 60)

      // If session is more than 12 hours old, clean it up
      if (hoursSinceConnection > 12) {
        logDebug(`Cleaning up stale session: ${session.sessionName} (${socketId})`)
        trainerSessions.delete(socketId)
        if (sessionViewers.has(socketId)) {
          sessionViewers.delete(socketId)
        }
        cleanupCount++
      }
    })

    if (cleanupCount > 0) {
      logDebug(`Cleaned up ${cleanupCount} stale sessions`)
      broadcastAvailableSessions()
    }
  }, 3600000) // Check every hour
}
