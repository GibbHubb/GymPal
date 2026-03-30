"use client"

import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from "react-native"
import { io } from "socket.io-client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { finishGroupWorkout } from "../../utils/api"

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

export default function TrainerScreen({ route, navigation }) {
  const { workoutId, workoutDetails } = route.params || {}
  const [workout, setWorkout] = useState(
    workoutDetails || {
      name: "Sample Workout",
      exercises: [
        { exercise_id: "1", exercise_name: "Squats" },
        { exercise_id: "2", exercise_name: "Push-ups" },
      ],
      participants: [],
    },
  )
  const [exerciseOffset, setExerciseOffset] = useState(0)
  const [timer, setTimer] = useState(3000)
  const [timerRunning, setTimerRunning] = useState(false)
  const [newParticipant, setNewParticipant] = useState("")
  const [userId, setUserId] = useState(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [sessionName, setSessionName] = useState("")
  const [sessionActive, setSessionActive] = useState(false)
  const [serverUrl, setServerUrl] = useState("https://gympalbackend-production.up.railway.app")
  const [debugMessages, setDebugMessages] = useState([])

  // Add debug message helper
  const addDebugMessage = (message) => {
    console.log(message)
    setDebugMessages((prev) => [message, ...prev.slice(0, 9)])
  }

  // Calculate participant groups
  const numParticipants = workout.participants.length
  const numGroups = Math.min(4, Math.max(1, numParticipants)) // Ensure we have at least 1 group and max 4
  const baseGroupSize = Math.floor(numParticipants / numGroups)
  const extraMembers = numParticipants % numGroups

  const groupColors = ["#fcc0d8", "#fc6e4c", "#f7bf0b", "#8ebce6"]

  const groupSizes = new Array(numGroups).fill(baseGroupSize)
  for (let i = 0; i < extraMembers; i++) groupSizes[i]++

  const participantGroups = []
  let index = 0
  for (let i = 0; i < numGroups; i++) {
    participantGroups.push([])
    for (let j = 0; j < groupSizes[i]; j++) {
      if (index < numParticipants) {
        participantGroups[i].push(workout.participants[index].user_id)
        index++
      }
    }
  }

  const participantToGroupMap = {}
  participantGroups.forEach((group, groupIndex) => {
    group.forEach((userId) => {
      participantToGroupMap[userId] = groupIndex
    })
  })

  // Initialize socket connection
  useEffect(() => {
    // Create socket connection
    socket = createSocket(serverUrl)

    // Set up connection status listeners
    socket.on("connect", () => {
      setSocketConnected(true)
      addDebugMessage("Socket connected")

      // Immediately emit workout data when connected
      setTimeout(() => {
        // Send initial workout data
        broadcastWorkoutData()

        // Try to register as a trainer after connection
        registerAsTrainer()
      }, 1000)
    })

    socket.on("disconnect", () => {
      setSocketConnected(false)
      setSessionActive(false)
      addDebugMessage("Socket disconnected")
    })

    socket.on("connect_error", (error) => {
      addDebugMessage(`Connection error: ${error.message}`)
    })

    // Listen for registration confirmation
    socket.on("trainerRegistered", (data) => {
      setSessionActive(true)
      addDebugMessage("Trainer registered successfully")

      // Broadcast initial data after successful registration
      setTimeout(() => {
        broadcastWorkoutData()
      }, 500)
    })

    // Listen for data requests from TV screens
    socket.on("requestWorkoutData", (data) => {
      addDebugMessage("Received request for workout data")
      broadcastWorkoutData()
    })

    socket.on("getTrainerData", (data) => {
      addDebugMessage("Received getTrainerData request")
      broadcastWorkoutData()
    })

    socket.on("getWorkoutData", () => {
      addDebugMessage("Received getWorkoutData request")
      broadcastWorkoutData()
    })

    socket.on("requestTrainerData", () => {
      addDebugMessage("Received requestTrainerData")
      broadcastWorkoutData()
    })

    // Clean up on unmount
    return () => {
      // Unregister trainer session when leaving
      if (socketConnected && sessionActive) {
        socket.emit("unregisterTrainer", {
          sessionId: socket.id,
          sessionName: sessionName || "Unnamed Session",
        })
      }

      // Remove all listeners
      socket.off()

      // Disconnect socket
      socket.disconnect()
    }
  }, [serverUrl]) // Recreate socket when server URL changes

  // Get user ID and set initial session name
  useEffect(() => {
    AsyncStorage.getItem("userId").then((id) => {
      if (id) {
        setUserId(id)

        // Set default session name based on workout name and user ID
        const defaultName = `${workout?.name || "Workout"} (${id.substring(0, 4)})`
        setSessionName(defaultName)
      }
    })
  }, [])

  useEffect(() => {
    if (workoutDetails) setWorkout(workoutDetails)
  }, [workoutDetails])

  // This effect syncs ALL workout data whenever it changes
  useEffect(() => {
    if (socketConnected) {
      broadcastWorkoutData()
    }
  }, [workout, socketConnected])

  // This effect handles the timer and emits updates every second
  useEffect(() => {
    if (timerRunning && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          const newTime = prev > 0 ? prev - 1 : 0
          emitSyncData(newTime)
          return newTime
        })
      }, 1000)
      return () => clearInterval(interval)
    } else if (timerRunning && timer === 0) {
      setTimerRunning(false)
      // Auto-advance to next exercise when timer hits zero
      handleNextExercise()
    }
  }, [timerRunning, timer, participantGroups, exerciseOffset])

  // This effect emits sync data whenever exercise offset changes
  useEffect(() => {
    if (socketConnected) {
      emitSyncData()
    }
  }, [exerciseOffset, socketConnected])

  // Register this trainer session with the server
  const registerAsTrainer = () => {
    if (!socket || !socketConnected) {
      return
    }

    addDebugMessage("Registering as trainer")

    const sessionData = {
      sessionId: socket.id,
      sessionName: sessionName || `Workout ${workout?.name || ""}`,
      workoutName: workout?.name || "Unnamed Workout",
      participantCount: workout?.participants?.length || 0,
      userId: userId || "unknown",
      timestamp: Date.now(),
    }

    socket.emit("registerTrainer", sessionData)
  }

  // Function to broadcast all workout data
  const broadcastWorkoutData = () => {
    if (!socket || !socketConnected) {
      return
    }

    addDebugMessage(`Broadcasting workout data with ${workout.exercises?.length || 0} exercises`)

    if (!sessionActive) {
      registerAsTrainer()
    }

    // Send workout data
    socket.emit("workoutUpdate", {
      sessionId: socket.id,
      workout,
      timestamp: Date.now(),
    })

    // Also send using the trainerWorkoutUpdate event for compatibility
    socket.emit("trainerWorkoutUpdate", workout)

    // Send sync data
    emitSyncData()
  }

  // Comprehensive function to emit all necessary data to TV screen
  const emitSyncData = (currentTimer = timer) => {
    if (!socket || !socketConnected) {
      return
    }

    addDebugMessage("Emitting sync data")

    const highlights = {}
    workout.participants.forEach((participant) => {
      const groupIndex = participantToGroupMap[participant.user_id]
      if (groupIndex !== undefined) {
        const exercisesPerGroup = Math.ceil(workout.exercises.length / numGroups)
        const highlightIndex = (exerciseOffset + groupIndex * exercisesPerGroup) % workout.exercises.length
        highlights[participant.user_id] = highlightIndex
      }
    })

    const syncData = {
      sessionId: socket.id,
      timer: currentTimer,
      highlights,
      participantGroups,
      exerciseOffset,
      workout, // Send the entire workout object to ensure complete sync
      timerRunning, // Send timer state
      timestamp: Date.now(),
    }

    // Send using both event types for compatibility
    socket.emit("tvSync", syncData)
    socket.emit("trainerTVSync", {
      timer: currentTimer,
      highlights,
      participantGroups,
      exerciseOffset,
      workout,
      timerRunning,
    })
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  const handleAddParticipant = () => {
    if (!newParticipant.trim()) {
      Alert.alert("Error", "Please enter a valid participant name.")
      return
    }

    setWorkout((prev) => ({
      ...prev,
      participants: [
        ...prev.participants,
        {
          user_id: Date.now().toString(), // Ensure user_id is a string for consistency
          participant_name: newParticipant,
          weights: {},
          reps: {},
        },
      ],
    }))
    setNewParticipant("")
  }

  const handleUpdateValue = (userId, exerciseId, field, value) => {
    setWorkout((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.user_id === userId ? { ...p, [field]: { ...p[field], [exerciseId]: value } } : p,
      ),
    }))
  }

  const getStartingExercise = (userId) => {
    const groupIndex = participantGroups.findIndex((group) => group.includes(userId))
    if (groupIndex === -1) return 0
    const exercisesPerGroup = Math.ceil(workout.exercises.length / numGroups)
    return (exerciseOffset + groupIndex * exercisesPerGroup) % workout.exercises.length
  }

  const handleNextExercise = () => {
    const newOffset = (exerciseOffset + 1) % workout.exercises.length
    setExerciseOffset(newOffset)
  }

  const handleStartTimer = () => {
    setTimerRunning(true)
    emitSyncData() // Immediately emit to update TV screen
  }

  const handlePauseTimer = () => {
    setTimerRunning(false)
    emitSyncData() // Immediately emit to update TV screen
  }

  const handleResetTimer = () => {
    setTimer(3000) // Reset to 50 minutes
    setTimerRunning(false)
    emitSyncData(3000) // Immediately emit with reset timer
  }

  const handleFinishWorkout = async () => {
    if (!userId) {
      Alert.alert("❌ Error", "User ID not found. Please log in again.")
      return
    }

    try {
      setIsFinishing(true)
      await finishGroupWorkout(workoutId, userId, 3, 10, 50)
      Alert.alert("✅ Workout Completed!", "Successfully completed workout!")
      navigation.goBack()
    } catch (error) {
      Alert.alert("❌ Error", "Failed to complete workout.")
      console.error("Error finishing workout:", error)
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* Session name input */}
      <View style={styles.sessionContainer}>
        <Text style={styles.sessionLabel}>Session Name:</Text>
        <TextInput
          style={styles.sessionInput}
          value={sessionName}
          onChangeText={setSessionName}
          placeholder="Enter session name"
          placeholderTextColor="#555"
        />
        <TouchableOpacity
          style={[
            styles.sessionStatusButton,
            sessionActive ? styles.sessionActiveButton : styles.sessionInactiveButton,
          ]}
          onPress={registerAsTrainer}
        >
          <Text style={styles.sessionStatusText}>{sessionActive ? "Broadcasting" : "Start Broadcasting"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.header}>{workout?.name || "Trainer View"}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter participant name"
          placeholderTextColor="#555"
          value={newParticipant}
          onChangeText={setNewParticipant}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.firstColumn} />
            {workout.participants.map((p, i) => {
              const groupIndex = participantToGroupMap[p.user_id]
              return (
                <View
                  key={i}
                  style={[
                    styles.headerCellContainer,
                    { backgroundColor: groupColors[groupIndex % groupColors.length] },
                  ]}
                >
                  <Text style={styles.headerCell}>{p.participant_name}</Text>
                </View>
              )
            })}
          </View>

          <View style={styles.subHeaderRow}>
            <View style={styles.firstColumn} />
            {workout.participants.map((_, index) => (
              <View key={index} style={styles.subHeaderContainer}>
                <Text style={styles.subHeaderText}>Weight</Text>
                <Text style={styles.subHeaderText}>Reps</Text>
              </View>
            ))}
          </View>

          <ScrollView>
            {workout.exercises.map((exercise, exIdx) => (
              <View key={exIdx} style={styles.row}>
                <View style={styles.exerciseCell}>
                  <Text style={styles.exerciseText}>{exercise.exercise_name}</Text>
                </View>
                {workout.participants.map((participant, idx) => {
                  const groupIndex = participantToGroupMap[participant.user_id]
                  const isCurrent = exIdx === getStartingExercise(participant.user_id)
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.inputRow,
                        { backgroundColor: isCurrent ? groupColors[groupIndex % groupColors.length] : "#EAEAEA" },
                      ]}
                    >
                      <View style={styles.dataBox}>
                        <TextInput
                          style={styles.dataText}
                          value={String(participant.weights?.[exercise.exercise_id] || "")}
                          onChangeText={(text) =>
                            handleUpdateValue(participant.user_id, exercise.exercise_id, "weights", text)
                          }
                          keyboardType="numeric"
                          textAlign="center"
                          placeholder="0"
                        />
                      </View>
                      <View style={styles.dataBox}>
                        <TextInput
                          style={styles.dataText}
                          value={String(participant.reps?.[exercise.exercise_id] || "")}
                          onChangeText={(text) =>
                            handleUpdateValue(participant.user_id, exercise.exercise_id, "reps", text)
                          }
                          keyboardType="numeric"
                          textAlign="center"
                          placeholder="0"
                        />
                      </View>
                    </View>
                  )
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(timer)}</Text>
        </View>
        <View style={styles.timerControls}>
          {!timerRunning ? (
            <TouchableOpacity style={styles.startButton} onPress={handleStartTimer}>
              <Text style={styles.startButtonText}>Start Timer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.pauseButton} onPress={handlePauseTimer}>
              <Text style={styles.pauseButtonText}>Pause</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.resetButton} onPress={handleResetTimer}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.nextButton} onPress={handleNextExercise}>
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.finishButton} onPress={handleFinishWorkout} disabled={isFinishing}>
        <Text style={styles.finishButtonText}>{isFinishing ? "Saving..." : "Finish Workout"}</Text>
      </TouchableOpacity>

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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#FFFFFF" },
  logo: { width: 150, height: 80, resizeMode: "contain", marginBottom: 10, alignSelf: "center" },
  header: { fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#3274ba", marginBottom: 16 },
  backButton: { marginBottom: 10 },
  backButtonText: { color: "#3274ba", fontSize: 16 },
  sessionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 4,
  },
  sessionLabel: { fontSize: 14, fontWeight: "bold", color: "#333", marginRight: 8 },
  sessionInput: {
    flex: 1,
    padding: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    backgroundColor: "#fff",
    color: "#333",
    fontSize: 14,
  },
  sessionStatusButton: {
    marginLeft: 8,
    paddingGymPaltal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  sessionActiveButton: {
    backgroundColor: "#d4edda",
  },
  sessionInactiveButton: {
    backgroundColor: "#f8d7da",
  },
  sessionStatusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  headerRow: { flexDirection: "row", paddingVertical: 8 },
  firstColumn: { width: 120 },
  headerCellContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  headerCell: { fontWeight: "bold", fontSize: 16, color: "#fff", textAlign: "center" },
  subHeaderRow: { flexDirection: "row", backgroundColor: "#d4e5f7", paddingVertical: 5 },
  subHeaderContainer: { flexDirection: "row", justifyContent: "space-evenly", flex: 1 },
  subHeaderText: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A", flex: 1, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  exerciseCell: { width: 120, paddingVertical: 12, paddingGymPaltal: 10, backgroundColor: "#8ebce6" },
  exerciseText: { fontSize: 16, fontWeight: "bold", color: "#fff", textAlign: "center" },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 6 },
  dataBox: {
    backgroundColor: "#f8f8f8",
    paddingVertical: 6,
    paddingGymPaltal: 12,
    borderWidth: 1,
    borderColor: "#8ebce6",
    borderRadius: 8,
    marginGymPaltal: 4,
    minWidth: 60,
  },
  dataText: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A", textAlign: "center" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#fff",
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  timerContainer: { backgroundColor: "#3274ba", padding: 14, borderRadius: 8, width: "25%", alignItems: "center" },
  timerText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  timerControls: { flexDirection: "row", width: "50%", justifyContent: "space-between" },
  startButton: { backgroundColor: "#f7bf0b", padding: 14, borderRadius: 8, width: "48%", alignItems: "center" },
  startButtonText: { color: "#1A1A1A", fontWeight: "bold", fontSize: 14 },
  pauseButton: { backgroundColor: "#fc6e4c", padding: 14, borderRadius: 8, width: "48%", alignItems: "center" },
  pauseButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  resetButton: { backgroundColor: "#8ebce6", padding: 14, borderRadius: 8, width: "48%", alignItems: "center" },
  resetButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  nextButton: { backgroundColor: "#3274ba", padding: 14, borderRadius: 8, width: "25%", alignItems: "center" },
  nextButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  inputContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  input: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#8ebce6",
    borderRadius: 8,
    backgroundColor: "#f8f8f8",
    color: "#1A1A1A",
  },
  addButton: { marginLeft: 8, backgroundColor: "#f7bf0b", paddingVertical: 10, paddingGymPaltal: 16, borderRadius: 8 },
  buttonText: { color: "#1A1A1A", fontWeight: "bold", fontSize: 16 },
  finishButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#f7bf0b",
    paddingVertical: 14,
    paddingGymPaltal: 18,
    borderRadius: 10,
    elevation: 5,
  },
  finishButtonText: { color: "#1A1A1A", fontWeight: "bold", fontSize: 16 },
  debugContainer: {
    position: "absolute",
    bottom: 70,
    left: 10,
    right: 10,
    maxHeight: 100,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: 5,
  },
  debugText: {
    fontSize: 10,
    color: "#fff",
    marginBottom: 2,
  },
})
