import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './Login';
import ClientHome from './Client/ClientHome';
import TrainerHome from './Trainer/TrainerHome';
import WorkoutsMenu from './Trainer/WorkoutsMenu';
import EditWorkoutScreen from './Trainer/EditWorkout';
import TrainerScreen from './Trainer/TrainerScreen';
import TVScreen from './Trainer/TVScreen';
import CreateWorkout from './Trainer/CreateWorkout';
import IntakeScreen from './Client/IntakeScreen';
import LifestyleScreen from './Client/LifestyleScreen';
import TrainingScreen from './Client/TrainingScreen';
import ProgressScreen from './Client/ProgressScreen';
import ClientOverview from './Trainer/ClientOverview';
import ProfileScreen from './Trainer/ProfileScreen';

const Stack = createStackNavigator();

export default function AppNavigator({ isAuthenticated, userRole, refreshAuth, initialRoute }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} refreshAuth={refreshAuth} />}
      </Stack.Screen>

      <Stack.Screen name="ClientHome" component={ClientHome} />
      <Stack.Screen name="TrainerHome" component={TrainerHome} />

      {isAuthenticated ? (
        userRole === 'client' || userRole === 'user' ? (
          <>
            <Stack.Screen name="IntakeScreen" component={IntakeScreen} />
            <Stack.Screen name="LifestyleScreen" component={LifestyleScreen} />
            <Stack.Screen name="TrainingScreen" component={TrainingScreen} />
            <Stack.Screen name="ProgressScreen" component={ProgressScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="WorkoutsMenu" component={WorkoutsMenu} />
            <Stack.Screen name="EditWorkout" component={EditWorkoutScreen} options={{ headerShown: true }} />
            <Stack.Screen name="CreateWorkout" component={CreateWorkout} />
            <Stack.Screen name="TrainerScreen" component={TrainerScreen} />
            <Stack.Screen name="TVScreen" component={TVScreen} />
            <Stack.Screen name="ClientOverview" component={ClientOverview} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          </>
        )
      ) : null}
    </Stack.Navigator>
  );
}
