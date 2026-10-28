import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { http } from '../../api/http';

const MaterialSessionContext = createContext(null);

export function MaterialSessionProvider({ children }) {
  const [session, setSession] = useState(null);

  const signIn = useCallback((nextSession) => setSession(nextSession), []);
  const clearSession = useCallback(() => setSession(null), []);
  const logout = useCallback(async () => {
    setSession(null);
    try {
      await http.post('/auth/logout');
    } catch {
      // The local session is already cleared even if the server logout fails.
    }
  }, []);

  const value = useMemo(
    () => ({ session, signIn, clearSession, logout }),
    [session, signIn, clearSession, logout],
  );

  return (
    <MaterialSessionContext.Provider value={value}>
      {children}
    </MaterialSessionContext.Provider>
  );
}

export function useMaterialSession() {
  const context = useContext(MaterialSessionContext);
  if (!context) throw new Error('useMaterialSession must be used within MaterialSessionProvider.');
  return context;
}
