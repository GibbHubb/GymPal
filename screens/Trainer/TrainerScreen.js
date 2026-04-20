"use client"

import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from "react-native"
import { io } from "socket.io-client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Theme } from "../../constants/Theme"
import ScreenWrapper from "../../components/ScreenWrapper"
import CustomButton from "../../components/CustomButton"
import { finishGroupWorkout, fetchTemplates, createTemplate, deleteTemplate } from "../../utils/api"

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
  const [showDebug, setShowDebug] = useState(false)
  // G1 — client live session state
  const [liveClientId, setLiveClientId] = useState("")
  const [clientSessionActive, setClientSessionActive] = useState(false)
  const [pushExerciseName, setPushExerciseName] = useState("")
  // G7 — workout templates
  const [templates, setTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Add debug message helper
  const addDebugMessage = (message) => {
    console.log(message)
    setDebugMessages((prev) => [message, ...prev.slice(0, 9)])
  }

  // G7 — template handlers
  const loadTemplates = async () => {
    try {
      const data = await fetchTemplates()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading templates:", err)
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return Alert.alert("Error", "Template name is required.")
    try {
      await createTemplate(templateName.trim(), workout.exercises)
      setTemplateName("")
      setShowSaveModal(false)
      loadTemplates()
      Alert.alert("Saved", `Template "${templateName.trim()}" saved.`)
    } catch (err) {
      Alert.alert("Error", "Failed to save template.")
    }
  }

  const handleLoadTemplate = (template) => {
    setWorkout((prev) => ({ ...prev, exercises: template.exercises }))
    addDebugMessage(`Loaded template: ${template.name}`)
  }

  const handleDeleteTemplate = async (id) => {
    try {
      await deleteTemplate(id)
      loadTemplates()
    } catch (err) {
      Alert.alert("Error", "Failed to delete template.")
    }
  }

  useEffect(() => {
    if (showTemplates && templates.length === 0) loadTemplates()
  }, [showTemplates])

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

  // This effect syncs ALL workout data whenever it changes (debounced)
  useEffect(() => {
    if (socketConnected) {
      const handler = setTimeout(() => {
        broadcastWorkoutData()
      }, 500)
      return () => clearTimeout(handler)
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

  const handleAddTime = (amount) => {
    setTimer((prev) => {
      const newTime = Math.max(0, prev + amount)
      emitSyncData(newTime)
      return newTime
    })
  }

  // G1 — start/end client live session
  const handleStartClientSession = () => {
    if (!socket || !liveClientId.trim()) return
    socket.emit("start_client_session", { clientId: liveClientId.trim() })
    setClientSessionActive(true)
    addDebugMessage(`Client session started for ${liveClientId}`)
  }

  const handleEndClientSession = () => {
    if (!socket || !liveClientId.trim()) return
    socket.emit("end_client_session", { clientId: liveClientId.trim() })
    setClientSessionActive(false)
    addDebugMessage(`Client session ended for ${liveClientId}`)
  }

  const handlePushExercise = () => {
    if (!socket || !liveClientId.trim() || !pushExerciseName.trim()) return
    socket.emit("push_exercise", {
      clientId: liveClientId.trim(),
      exercise: { name: pushExerciseName.trim() },
    })
    setPushExerciseName("")
    addDebugMessage(`Pushed exercise "${pushExerciseName}" to ${liveClientId}`)
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
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <View style={styles.topLogoRow}>
          <Image source={require("../../assets/GymPal.png")} style={styles.logo} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Session name input */}
        <View style={styles.sessionContainer}>
          <Text style={styles.sessionLabel}>Session:</Text>
          <TextInput
            style={styles.sessionInput}
            value={sessionName}
            onChangeText={setSessionName}
            placeholder="Name..."
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[
              styles.sessionStatusButton,
              sessionActive ? styles.sessionActiveButton : styles.sessionInactiveButton,
            ]}
            onPress={registerAsTrainer}
          >
            <Text style={styles.sessionStatusText}>{sessionActive ? "Live" : "Go Live"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.header}>{workout?.name || "Trainer View"}</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add Participant..."
            placeholderTextColor="#888"
            value={newParticipant}
            onChangeText={setNewParticipant}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                  <Text style={styles.subHeaderText}>WT</Text>
                  <Text style={styles.subHeaderText}>RP</Text>
                </View>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
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
                          { backgroundColor: isCurrent ? groupColors[groupIndex % groupColors.length] + '33' : "transparent" },
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
                            placeholderTextColor="#555"
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
                            placeholderTextColor="#555"
                          />
                        </View>
                      </View>
                    )
                  })}
                </View>
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(timer)}</Text>
            <View style={styles.timerAdjustRow}>
              <TouchableOpacity onPress={() => handleAddTime(-60)} style={styles.timeAdjustBtn}>
                <Text style={styles.timeAdjustText}>-1m</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleAddTime(60)} style={styles.timeAdjustBtn}>
                <Text style={styles.timeAdjustText}>+1m</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.timerControls}>
            {!timerRunning ? (
              <TouchableOpacity style={styles.startButton} onPress={handleStartTimer}>
                <Text style={styles.startButtonText}>Start</Text>
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

        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.debugToggle} onPress={() => setShowDebug(!showDebug)}>
            <Text style={styles.debugToggleText}>🐛</Text>
          </TouchableOpacity>
          
          <CustomButton 
            title={isFinishing ? "Saving..." : "Finish Workout"} 
            onPress={handleFinishWorkout} 
            disabled={isFinishing}
            style={styles.finishBtnSize}
          />
        </View>

        {/* G1 — Client live session panel */}
        <View style={styles.liveSessionPanel}>
          <Text style={styles.liveSessionTitle}>📡 Client Live Session</Text>
          <View style={styles.liveSessionRow}>
            <TextInput
              style={styles.liveSessionInput}
              placeholder="Client user ID..."
              placeholderTextColor="#888"
              value={liveClientId}
              onChangeText={setLiveClientId}
              editable={!clientSessionActive}
            />
            <TouchableOpacity
              style={[styles.liveSessionBtn, clientSessionActive ? styles.liveSessionBtnEnd : styles.liveSessionBtnStart]}
              onPress={clientSessionActive ? handleEndClientSession : handleStartClientSession}
            >
              <Text style={styles.liveSessionBtnText}>{clientSessionActive ? "End" : "Start"}</Text>
            </TouchableOpacity>
          </View>
          {clientSessionActive && (
            <View style={styles.liveSessionRow}>
              <TextInput
                style={styles.liveSessionInput}
                placeholder="Exercise name to push..."
                placeholderTextColor="#888"
                value={pushExerciseName}
                onChangeText={setPushExerciseName}
              />
              <TouchableOpacity style={styles.liveSessionBtnPush} onPress={handlePushExercise}>
                <Text style={styles.liveSessionBtnText}>Push</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* G7 — Workout Templates */}
        <View style={styles.liveSessionPanel}>
          <TouchableOpacity onPress={() => setShowTemplates(!showTemplates)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.liveSessionTitle}>📋 Templates</Text>
            <Text style={{ color: Theme.colors.primary, fontSize: 12 }}>{showTemplates ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showTemplates && (
            <View>
              {/* Save current workout as template */}
              {!showSaveModal ? (
                <TouchableOpacity
                  style={[styles.liveSessionBtn, styles.liveSessionBtnStart, { marginBottom: 8, alignSelf: 'flex-start' }]}
                  onPress={() => setShowSaveModal(true)}
                >
                  <Text style={styles.liveSessionBtnText}>Save as Template</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.liveSessionRow, { marginBottom: 8 }]}>
                  <TextInput
                    style={styles.liveSessionInput}
                    placeholder="Template name..."
                    placeholderTextColor="#888"
                    value={templateName}
                    onChangeText={setTemplateName}
                  />
                  <TouchableOpacity style={[styles.liveSessionBtn, styles.liveSessionBtnStart]} onPress={handleSaveTemplate}>
                    <Text style={styles.liveSessionBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.liveSessionBtn, styles.liveSessionBtnEnd]} onPress={() => setShowSaveModal(false)}>
                    <Text style={styles.liveSessionBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Template list */}
              {templates.length === 0 ? (
                <Text style={{ color: '#888', fontSize: 12 }}>No saved templates yet.</Text>
              ) : (
                templates.map((t) => (
                  <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Theme.colors.glassBorder }}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handleLoadTemplate(t)}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{t.name}</Text>
                      <Text style={{ color: '#888', fontSize: 11 }}>{t.exercises.length} exercises</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTemplate(t.id)}>
                      <Text style={{ color: Theme.colors.error, fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Debug messages */}
        {showDebug && (
          <ScrollView style={styles.debugContainer}>
            {debugMessages.map((msg, idx) => (
              <Text key={idx} style={styles.debugText}>
                {msg}
              </Text>
            ))}
          </ScrollView>
        )}
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: Theme.colors.background },
  topLogoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15, marginTop: 10 },
  logo: { width: 120, height: 60, resizeMode: "contain" },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.glassBorder },
  backBtnText: { color: "#fff", fontSize: 13, fontWeight: '700' },
  header: { ...Theme.typography.title, textAlign: "center", color: Theme.colors.primary, marginBottom: 15 },
  sessionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: Theme.colors.surface,
    padding: 10,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  sessionLabel: { ...Theme.typography.caption, color: Theme.colors.primary, marginRight: 10 },
  sessionInput: {
    flex: 1,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 14,
  },
  sessionStatusButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sessionActiveButton: { backgroundColor: Theme.colors.success },
  sessionInactiveButton: { backgroundColor: Theme.colors.primary },
  sessionStatusText: { fontSize: 11, fontWeight: "900", color: "#000", textTransform: 'uppercase' },
  headerRow: { flexDirection: "row", marginBottom: 5 },
  firstColumn: { width: 100 },
  headerCellContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, width: 120, borderRadius: 4, marginHorizontal: 2 },
  headerCell: { fontWeight: "900", fontSize: 12, color: "#1A1A1A", textAlign: "center", textTransform: 'uppercase' },
  subHeaderRow: { flexDirection: "row", marginBottom: 5 },
  subHeaderContainer: { flexDirection: "row", justifyContent: "space-evenly", width: 120, marginHorizontal: 2 },
  subHeaderText: { fontSize: 10, fontWeight: "bold", color: Theme.colors.textSecondary, width: 50, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  exerciseCell: { width: 100, paddingVertical: 15, paddingRight: 10 },
  exerciseText: { fontSize: 14, fontWeight: "700", color: Theme.colors.text },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 5, width: 120, marginHorizontal: 2 },
  dataBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    marginHorizontal: 2,
    width: 50,
  },
  dataText: { fontSize: 14, fontWeight: "900", color: "#fff", textAlign: "center" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    backgroundColor: Theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    position: "absolute",
    bottom: 0,
    width: "105%", // Adjust for container padding
    left: 0,
    paddingHorizontal: 16,
  },
  timerContainer: { backgroundColor: Theme.colors.surface, padding: 8, borderRadius: Theme.borderRadius.m, width: "25%", alignItems: "center", borderWidth: 1, borderColor: Theme.colors.primary },
  timerText: { color: Theme.colors.primary, fontWeight: "900", fontSize: 18 },
  timerAdjustRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 4 },
  timeAdjustBtn: { backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  timeAdjustText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  timerControls: { flexDirection: "row", width: "50%", justifyContent: "space-between" },
  startButton: { backgroundColor: Theme.colors.primary, paddingVertical: 12, borderRadius: Theme.borderRadius.m, width: "48%", alignItems: "center" },
  startButtonText: { color: "#000", fontWeight: "900", fontSize: 12, textTransform: 'uppercase' },
  pauseButton: { backgroundColor: Theme.colors.error, paddingVertical: 12, borderRadius: Theme.borderRadius.m, width: "48%", alignItems: "center" },
  pauseButtonText: { color: "#fff", fontWeight: "900", fontSize: 12, textTransform: 'uppercase' },
  resetButton: { backgroundColor: Theme.colors.surface, paddingVertical: 12, borderRadius: Theme.borderRadius.m, width: "48%", alignItems: "center", borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  resetButtonText: { color: "#fff", fontWeight: "900", fontSize: 12, textTransform: 'uppercase' },
  nextButton: { backgroundColor: Theme.colors.primary, paddingVertical: 12, borderRadius: Theme.borderRadius.m, width: "20%", alignItems: "center" },
  nextButtonText: { color: "#000", fontWeight: "900", fontSize: 12, textTransform: 'uppercase' },
  inputContainer: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  input: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
    color: "#fff",
  },
  addButton: { marginLeft: 10, backgroundColor: Theme.colors.primary, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  buttonText: { color: "#000", fontWeight: "900", fontSize: 14 },
  bottomControls: {
    position: "absolute",
    bottom: 90,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  debugToggle: {
    backgroundColor: Theme.colors.surface,
    padding: 12,
    borderRadius: Theme.borderRadius.round,
    marginRight: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  debugToggleText: { fontSize: 16 },
  finishBtnSize: { width: 160 },
  debugContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    maxHeight: 150,
    width: 250,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  debugText: {
    fontSize: 9,
    color: Theme.colors.primary,
    marginBottom: 2,
  },
  liveSessionPanel: {
    marginTop: 12,
    padding: 10,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.m,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
  },
  liveSessionTitle: {
    color: Theme.colors.primary,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  liveSessionInput: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: Theme.colors.glassBorder,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 13,
  },
  liveSessionBtn: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  liveSessionBtnStart: { backgroundColor: Theme.colors.primary },
  liveSessionBtnEnd:   { backgroundColor: Theme.colors.error },
  liveSessionBtnPush:  { marginLeft: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: "#5c7cfa" },
  liveSessionBtnText:  { color: "#000", fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
})
