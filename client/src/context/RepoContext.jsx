import React, { createContext, useContext, useState } from 'react';

const RepoContext = createContext();

export function useRepo() {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error('useRepo must be used within RepoProvider');
  }
  return context;
}

export function RepoProvider({ children }) {
  const [selectedRepo, setSelectedRepo] = useState(null);

  function selectRepo(repo) {
    setSelectedRepo(repo);
  }

  function clearRepo() {
    setSelectedRepo(null);
  }

  return (
    <RepoContext.Provider
      value={{
        selectedRepo,
        selectRepo,
        clearRepo,
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}
