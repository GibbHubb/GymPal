"use client"

import { useState, useEffect } from "react"
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList } from "react-native"
import { io } from "socket.io-client"

// Create socket connection
let socket = null

// Function to create and configure socket
const createSocket = (serverUrl) => {
  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect()
  }

  // Create new socket
  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true,
    autoConnect: true,
  })

  return socket
}

const groupColors = ["#fcc0d8", "#fc6e4c", "#f7bf0b", "#8ebce6"]

const TVScreen = () => {
  const [availableSessions, setAvailableSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [timer, setTimer] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [participantGroups, setParticipantGroups] = useState([])
  const [exerciseOffset, setExerciseOffset] = useState(0)
  const [highlights, setHighlights] = useState({})
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [connectionStatus, setConnectionStatus] = useState("Connecting...")
  const [serverUrl, setServerUrl] = useState("https://gympalbackend-production.up.railway.app")
  const [debugMessages, setDebugMessages] = useState([])

  // Add debug message helper
  const addDebugMessage = (message) => {
    console.log(message)
    setDebugMessages((prev) => [message, ...prev.slice(0, 9)])
  }

  // Set up socket listeners
  useEffect(() => {
    // Create socket connection
    socket = createSocket(serverUrl)

    // Connection status listeners
    socket.on("connect", () => {
      setConnectionStatus("Connected")
      addDebugMessage("Socket connected")

      // Request available trainer sessions
      socket.emit("getAvailableSessions")
    })

    socket.on("disconnect", () => {
      setConnectionStatus("Disconnected")
      addDebugMessage("Socket disconnected")

      // Clear selected session if disconnected
      if (selectedSession) {
        setSelectedSession(null)
        setWorkout(null)
      }
    })

    socket.on("connect_error", (error) => {
      setConnectionStatus(`Connection Error: ${error.message}`)
      addDebugMessage(`Connection error: ${error.message}`)
    })

    // Listen for available sessions
    socket.on("availableSessions", (sessions) => {
      addDebugMessage(`Received ${sessions.length} sessions`)
      setAvailableSessions(sessions)

      // If we have a selected session, check if it's still available
      if (selectedSession) {
        const sessionStillExists = sessions.some((s) => s.sessionId === selectedSession.sessionId)
        if (!sessionStillExists) {
          setSelectedSession(null)
          setWorkout(null)
        }
      }
    })

    // Listen for workout data updates - support both event types
    socket.on("workoutUpdate", (data) => {
      addDebugMessage(`Received workoutUpdate: ${data ? "has data" : "no data"}`)

      // Accept data regardless of session ID for testing
      if (data && data.workout) {
        addDebugMessage(`workoutUpdate has workout with ${data.workout.exercises?.length || 0} exercises`)
        setWorkout(data.workout)
        setLastUpdate(Date.now())
      }
    })

    socket.on("trainerWorkoutUpdate", (data) => {
      addDebugMessage(`Received trainerWorkoutUpdate: ${data ? "has data" : "no data"}`)

      // Accept any workout data for now
      if (data) {
        addDebugMessage(`trainerWorkoutUpdate has ${data.exercises?.length || 0} exercises`)
        setWorkout(data)
        setLastUpdate(Date.now())
      }
    })

    // Listen for sync data (timer, highlights, etc.) - support both event types
    socket.on("tvSync", (data) => {
      addDebugMessage(`Received tvSync: ${data ? "has data" : "no data"}`)

      // Accept data regardless of session ID for testing
      if (data.timer !== undefined) setTimer(data.timer)
      if (data.timerRunning !== undefined) setTimerRunning(data.timerRunning)
      if (data.participantGroups) setParticipantGroups(data.participantGroups || [])
      if (data.exerciseOffset !== undefined) setExerciseOffset(data.exerciseOffset || 0)
      if (data.highlights) setHighlights(data.highlights || {})
      if (data.workout) {
        addDebugMessage(`tvSync has workout with ${data.workout.exercises?.length || 0} exercises`)
        setWorkout(data.workout)
      }
      setLastUpdate(Date.now())
    })

    socket.on("trainerTVSync", (data) => {
      addDebugMessage(`Received trainerTVSync: ${data ? "has data" : "no data"}`)

      // Accept any sync data for now
      if (data.timer !== undefined) setTimer(data.timer)
      if (data.timerRunning !== undefined) setTimerRunning(data.timerRunning)
      if (data.participantGroups) setParticipantGroups(data.participantGroups || [])
      if (data.exerciseOffset !== undefined) setExerciseOffset(data.exerciseOffset || 0)
      if (data.highlights) setHighlights(data.highlights || {})
      if (data.workout) {
        addDebugMessage(`trainerTVSync has workout with ${data.workout.exercises?.length || 0} exercises`)
        setWorkout(data.workout)
      }
      setLastUpdate(Date.now())
    })

    // Clean up listeners on unmount
    return () => {
      // Leave the selected session if we have one
      if (selectedSession) {
        socket.emit("leaveSession", { sessionId: selectedSession.sessionId })
      }

      // Remove all listeners
      socket.off()

      // Disconnect socket
      socket.disconnect()
    }
  }, [serverUrl]) // Recreate socket when server URL changes

  // Handle timer countdown locally if it's running
  useEffect(() => {
    let interval
    if (timerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning, timer])

  // Join a trainer session
  const joinSession = (session) => {
    addDebugMessage(`Joining session: ${session.sessionName}`)
    setSelectedSession(session)

    // Notify the server we're joining this session
    socket.emit("joinSession", { sessionId: session.sessionId })

    // Request initial workout data
    socket.emit("requestWorkoutData", { sessionId: session.sessionId })

    // Also request data using the trainer-specific event
    socket.emit("getTrainerData", { sessionId: session.sessionId })
  }

  // Leave the current session
  const leaveSession = () => {
    if (selectedSession) {
      // Notify the server we're leaving this session
      socket.emit("leaveSession", { sessionId: selectedSession.sessionId })

      setSelectedSession(null)
      setWorkout(null)
    }
  }

  // Force refresh available sessions
  const refreshSessions = () => {
    // Request available sessions
    socket.emit("getAvailableSessions")
  }

  // Request workout data from the selected session
  const requestWorkoutData = () => {
    addDebugMessage("Requesting workout data")

    if (selectedSession) {
      socket.emit("requestWorkoutData", { sessionId: selectedSession.sessionId })
      socket.emit("getTrainerData", { sessionId: selectedSession.sessionId })
    }

    // Also try direct events for testing
    socket.emit("getWorkoutData")
    socket.emit("requestTrainerData")
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Get group for a participant
  const getParticipantGroup = (userId) => {
    for (let i = 0; i < participantGroups.length; i++) {
      if (participantGroups[i].includes(userId)) {
        return i
      }
    }
    return 0
  }

  // Session selection screen
  if (!selectedSession) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Available Sessions</Text>
        <Text style={styles.connectionStatus}>Status: {connectionStatus}</Text>

        {/* Available sessions list */}
        <View style={styles.sessionsContainer}>
          {availableSessions.length === 0 ? (
            <Text style={styles.noSessionsText}>No active trainer sessions found</Text>
          ) : (
            <FlatList
              data={availableSessions}
              keyExtractor={(item) => item.sessionId}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.sessionItem} onPress={() => joinSession(item)}>
                  <Text style={styles.sessionName}>{item.sessionName}</Text>
                  <Text style={styles.sessionDetails}>
                    Workout: {item.workoutName || "Unknown"} | Participants: {item.participantCount || 0}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshSessions}>
            <Text style={styles.refreshButtonText}>Refresh Sessions</Text>
          </TouchableOpacity>
        </View>

        {/* Debug messages */}
        <ScrollView style={styles.debugContainer}>
          {debugMessages.map((msg, idx) => (
            <Text key={idx} style={styles.debugText}>
              {msg}
            </Text>
          ))}
        </ScrollView>
      </View>
    )
  }

  // Loading state while waiting for workout data
  if (!workout || !workout.exercises || !workout.participants) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Waiting for trainer data...</Text>
        <Text style={styles.sessionInfoText}>Connected to: {selectedSession.sessionName}</Text>
        <Text style={styles.connectionStatus}>Status: {connectionStatus}</Text>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.refreshButton} onPress={requestWorkoutData}>
            <Text style={styles.refreshButtonText}>Request Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveButton} onPress={leaveSession}>
            <Text style={styles.leaveButtonText}>Leave Session</Text>
          </TouchableOpacity>
        </View>

        {/* Debug messages */}
        <ScrollView style={styles.debugContainer}>
          {debugMessages.map((msg, idx) => (
            <Text key={idx} style={styles.debugText}>
              {msg}
            </Text>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.fullScreen}>
      {/* Session info bar */}
      <View style={styles.sessionInfoBar}>
        <Text style={styles.sessionInfoName}>{selectedSession.sessionName}</Text>
        <TouchableOpacity style={styles.leaveSessionButton} onPress={leaveSession}>
          <Text style={styles.leaveSessionText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tvHeader}>
        <Text
          style={[
            styles.timerDisplay,
            timerRunning ? styles.timerRunning : null,
            timer < 10 ? styles.timerWarning : null,
          ]}
        >
          Timer: {formatTime(timer)}
        </Text>
        <View style={styles.groupLegend}>
          {participantGroups.map((group, idx) => (
            <View key={idx} style={styles.groupBox}>
              <View style={[styles.colorCircle, { backgroundColor: groupColors[idx % groupColors.length] }]} />
              <Text style={styles.groupLabel}>Group {idx + 1}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.scrollContent} style={styles.scrollViewStyle}>
        <View>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.firstColumn}>
              <Text style={styles.headerCell}>Exercise</Text>
            </View>
            {workout.participants.map((participant, index) => {
              const groupIndex = getParticipantGroup(participant.user_id)
              return (
                <View
                  key={index}
                  style={[styles.headerCellWrapper, { backgroundColor: groupColors[groupIndex % groupColors.length] }]}
                >
                  <Text style={styles.headerCellText}>{participant.participant_name}</Text>
                </View>
              )
            })}
          </View>

          {/* Exercise Rows */}
          {workout.exercises.map((exercise, exerciseIndex) => (
            <View
              key={exerciseIndex}
              style={[styles.exerciseRow, exerciseOffset === exerciseIndex ? styles.newExerciseRow : null]}
            >
              <View style={styles.firstColumn}>
                <Text style={styles.exerciseText}>{exercise.exercise_name}</Text>
              </View>

              {workout.participants.map((participant, index) => {
                const isCurrent = highlights[participant.user_id] === exerciseIndex

                return (
                  <View key={index} style={[styles.dataCell, isCurrent ? styles.highlightedCell : null]}>
                    <Text style={styles.dataText}>
                      {participant.weights?.[exercise.exercise_id] || "-"} kg /{" "}
                      {participant.reps?.[exercise.exercise_id] || "-"} reps
                    </Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Corner refresh button */}
      <TouchableOpacity style={styles.cornerRefreshButton} onPress={requestWorkoutData}>
        <Text style={styles.cornerRefreshText}>↻</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  scrollContent: { paddingHorizontal: 5, paddingBottom: 40, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 20 },
  loadingText: { fontSize: 24, fontWeight: "bold", color: "#3274ba", marginBottom: 20 },
  sessionInfoText: { fontSize: 18, color: "#333", marginBottom: 15 },
  connectionStatus: { fontSize: 16, color: "#666", marginBottom: 10 },
  sessionsContainer: {
    width: "100%",
    maxHeight: 300,
    marginVertical: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  noSessionsText: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginVertical: 20,
    fontStyle: "italic",
  },
  sessionItem: {
    backgroundColor: "#e9ecef",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#3274ba",
  },
  sessionName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3274ba",
    marginBottom: 5,
  },
  sessionDetails: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 5,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  refreshButton: {
    backgroundColor: "#f7bf0b",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 2,
    flex: 1,
  },
  refreshButtonText: {
    color: "#1A1A1A",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  leaveButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 2,
    flex: 1,
  },
  leaveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  sessionInfoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#3274ba",
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sessionInfoName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  leaveSessionButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  leaveSessionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  tvHeader: { alignItems: "center", marginBottom: 20 },
  timerDisplay: { fontSize: 28, fontWeight: "bold", marginBottom: 10, color: "#3274ba", padding: 10 },
  timerRunning: { backgroundColor: "#e6f7ff", borderRadius: 8 },
  timerWarning: { color: "#ff4d4f", backgroundColor: "#fff1f0" },
  groupLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  groupBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 8, marginBottom: 4 },
  colorCircle: { width: 16, height: 16, borderRadius: 8, marginRight: 6 },
  groupLabel: { fontSize: 14, color: "#1A1A1A" },
  headerRow: { flexDirection: "row", marginBottom: 8 },
  firstColumn: {
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#8ebce6",
    borderRadius: 6,
    marginRight: 4,
  },
  headerCell: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  headerCellWrapper: {
    paddingVertical: 16,
    width: 140,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    marginHorizontal: 2,
  },
  headerCellText: {
    color: "#1A1A1A",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
  exerciseRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 6,
  },
  newExerciseRow: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#91caff",
  },
  exerciseText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  dataCell: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
    marginHorizontal: 2,
  },
  dataText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A1A1A",
    textAlign: "center",
  },
  highlightedCell: {
    backgroundColor: "#f0f9ff",
    borderColor: "#91caff",
    borderWidth: 2,
    elevation: 2,
  },
  cornerRefreshButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#3274ba",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  cornerRefreshText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  debugContainer: {
    marginTop: 20,
    maxHeight: 150,
    width: "100%",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 10,
  },
  debugText: {
    fontSize: 12,
    color: "#333",
    marginBottom: 4,
  },
  scrollViewStyle: {
    flex: 1,
    width: "100%",
  },
})

export default TVScreen
