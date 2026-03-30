"use client"

import { useEffect, useState } from "react"
import { NavigationContainer } from "@react-navigation/native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import AppNavigator, { isTrainerRole, isClientRole } from "./screens/Navigation"
import ErrorBoundary from "./ErrorBoundary"
import { View, ActivityIndicator, Text } from "react-native"
import { navigationRef } from "./utils/RootNavigation"

const API_URL = "https://gympalbackend-production.up.railway.app/api"

// Define screen access by role
const TRAINER_SCREENS = [
  "TrainerHome",
  "WorkoutsMenu",
  "EditWorkout",
  "CreateWorkout",
  "TrainerScreen",
  "TVScreen",
  "ClientOverview",
  "ProfileScreen",
]

const CLIENT_SCREENS = [
  "ClientHome",
  "IntakeScreen",
  "LifestyleScreen",
  "TrainingScreen",
  "ProgressScreen",
]

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState("")
  const [initialRoute, setInitialRoute] = useState("Login")
  const [loading, setLoading] = useState(true)

  const refreshAuth = async () => {
    try {
      setLoading(true)

      // Get token from storage
      const token = await AsyncStorage.getItem("token")

      // Try to get role from both possible storage keys
      let role = await AsyncStorage.getItem("role")
      if (!role) {
        role = await AsyncStorage.getItem("userRole")
      }

      console.log("🔄 Refreshing auth - Token exists:", !!token)
      console.log("🔄 Refreshing auth - Role:", role)

      if (!token) {
        console.log("❌ No token found, not authenticated")
        setIsAuthenticated(false)
        setUserRole("")
        setInitialRoute("Login")
        return
      }

      // Validate token with server
      try {
        const response = await axios.get(`${API_URL}/users/validate-token`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.status === 200) {
          console.log("✅ Token is valid")
          setIsAuthenticated(true)

          // Make sure we have a valid role
          const validRole = role || "user"

          // Store the role in both storage keys for consistency
          await AsyncStorage.setItem("role", validRole)
          await AsyncStorage.setItem("userRole", validRole)

          setUserRole(validRole)
          console.log("👤 User role set to:", validRole)

          // Determine if user is a trainer
          const isTrainer = isTrainerRole(validRole)
          console.log(`🔍 Role: ${validRole}, isTrainer: ${isTrainer}`)

          // Default home screen based on role
          const defaultHomeScreen = isTrainer ? "TrainerHome" : "ClientHome"
          console.log(`🏠 Default home screen: ${defaultHomeScreen}`)

          // Get last route if available
          const lastRoute = await AsyncStorage.getItem("lastRoute")
          console.log(`🔄 Last route from storage: ${lastRoute || "none"}`)

          // Determine the appropriate initial route
          let newInitialRoute = defaultHomeScreen // Default to appropriate home screen

          if (lastRoute && lastRoute !== "Login") {
            // Check if the last route is appropriate for the user's role
            const canAccessLastRoute = (isTrainer && TRAINER_SCREENS.includes(lastRoute)) || 
                                      (!isTrainer && CLIENT_SCREENS.includes(lastRoute))
            
            if (canAccessLastRoute) {
              newInitialRoute = lastRoute
              console.log(`✅ Last route ${lastRoute} is appropriate for role ${validRole}, using it`)
            } else {
              console.log(`❌ Last route ${lastRoute} is NOT appropriate for role ${validRole}, using ${defaultHomeScreen}`)
              
              // Force clear the inappropriate last route
              await AsyncStorage.removeItem("lastRoute")
            }
          }

          console.log("🧭 Setting initial route to:", newInitialRoute)
          setInitialRoute(newInitialRoute)
        } else {
          throw new Error("Token validation failed")
        }
      } catch (error) {
        console.warn("❌ Token validation failed:", error.message)
        throw new Error("Token validation failed")
      }
    } catch (error) {
      console.warn("❌ Auth refresh failed:", error.message)

      // Clear storage and reset auth state
      await AsyncStorage.removeItem("token")
      await AsyncStorage.removeItem("role")
      await AsyncStorage.removeItem("userRole")
      await AsyncStorage.removeItem("lastRoute") // Also clear last route

      setIsAuthenticated(false)
      setUserRole("")
      setInitialRoute("Login")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAuth()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" }}>
        <ActivityIndicator size="large" color="#3274ba" />
        <Text style={{ marginTop: 20, color: "#3274ba" }}>Loading GymPal...</Text>
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={async (state) => {
          const currentRoute = state.routes[state.index]?.name
          if (currentRoute && currentRoute !== "Login") {
            // Get current role before saving route
            const currentRole = await AsyncStorage.getItem("role") || await AsyncStorage.getItem("userRole") || "user"
            const isCurrentUserTrainer = isTrainerRole(currentRole)
            
            // Only save route if it's appropriate for the user's role
            const isRouteAppropriate = (isCurrentUserTrainer && TRAINER_SCREENS.includes(currentRoute)) ||
                                      (!isCurrentUserTrainer && CLIENT_SCREENS.includes(currentRoute))
            
            if (isRouteAppropriate) {
              await AsyncStorage.setItem("lastRoute", currentRoute)
              console.log("💾 Saved appropriate last route:", currentRoute)
            } else {
              console.log(`⚠️ Not saving inappropriate route ${currentRoute} for role ${currentRole}`)
            }
          }
        }}
      >
        <AppNavigator
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          refreshAuth={refreshAuth}
          initialRoute={initialRoute}
        />
      </NavigationContainer>
    </ErrorBoundary>
  )
}

