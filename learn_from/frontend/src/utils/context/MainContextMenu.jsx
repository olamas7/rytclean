import React, { createContext, useContext } from 'react';

const MainContext = createContext();
export const useMainContext = () => useContext(MainContext);

export const MainProvider = ({ children }) => {
  // Utility functions to update states and storage
  const updatePatId = (newPatId) => {
    setPatientId(newPatId);
    sessionStorage.setItem('patientId', newPatId);
  };

  return (
    <MainContext.Provider
      value={{
        updatePatId
      }}
    >
      {children}
    </MainContext.Provider>
  );
};
