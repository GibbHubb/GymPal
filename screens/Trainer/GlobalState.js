// GlobalState.js
import React, { createContext, useState } from 'react';

export const GlobalStateContext = createContext();

export const GlobalStateProvider = ({ children }) => {
  const [exerciseOffset, setExerciseOffset] = useState(0);

  return (
    <GlobalStateContext.Provider value={{ exerciseOffset, setExerciseOffset }}>
      {children}
    </GlobalStateContext.Provider>
  );
};
