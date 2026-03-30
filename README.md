# GymPal App

GymPal is a premium fitness and training application built with React Native and Expo. It provides dual-role functionality, offering dedicated portals and dashboards for both **Clients** and **Trainers** to manage workouts, track progress, manage intake/lifestyle data, and engage in streaming sessions.

## 🚀 Features
- **Client Dashboard:** Access to Intake forms, Lifestyle tracking, Training plans, and Progress visualization.
- **Trainer Dashboard:** Manage client overviews, create and edit workouts, and enter TV/Streaming mode.
- **Role-Based Authentication:** Secure login flow bridging clients and trainers to their respective environments.
- **Premium UI/UX:** Styled with the signature "GymPal Gold" (`#F6B000`) theme using centralized design tokens, transparent inputs, and sleek dark mode surfaces.

## 🛠 Tech Stack
- **Framework:** [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/)
- **Navigation:** React Navigation (Stack)
- **Networking:** Axios (connecting to a Railway-hosted backend backend)
- **Local Storage:** AsyncStorage for session management
- **UI Architecture:** Custom component library (`ScreenWrapper`, `CustomButton`, `CustomInput`) styled dynamically via a central `Theme.js`.

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd gympal
   ```

2. **Install Dependencies:**
   Make sure you have Node.js installed, then run:
   ```bash
   npm install
   ```

3. **Start the Application:**
   ```bash
   npx expo start
   ```
   This will open the Expo developer tools in your terminal or browser. From there, you can scan the QR code with the Expo Go app on your physical device, or press `i` to run it on an iOS Simulator / `a` for an Android Emulator.

## 📁 Project Structure highlights
- `/components`: Reusable UI elements (`CustomButton`, `CustomInput`, `ScreenWrapper`).
- `/constants`: Global theme (`Theme.js`) for colors, spacing, and typography to maintain visual consistency.
- `/screens`: 
  - `/Client`: All screens specific to the authenticated client experience.
  - `/Trainer`: All screens specific to the authenticated trainer experience.
- `api.js`: Centralized Axios logic handling all backend API requests, token lifecycle, and data fetching.
