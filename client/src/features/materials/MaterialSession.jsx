import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { http } from '../../api/http';

const MaterialSessionContext = createContext(null);

export function MaterialSessionProvider({ children }) {
  const [session, setSession] = useState(null);

  const signIn = useCallback((nextSession) => setSession(nextSession), []);
  const clearSession = useCallback((token) => {
    setSession((current) => !token || current?.token === token ? null : current);
  }, []);
  const logout = useCallback(async () => {
    setSession(null);
    try {
      await http.post('/auth/logout');
      return true;
    } catch {
      return false;
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

export function useOptionalMaterialSession() {
  return useContext(MaterialSessionContext);
}

export function useMaterialSession() {
  const context = useOptionalMaterialSession();
  if (!context) throw new Error('useMaterialSession must be used within MaterialSessionProvider.');
  return context;
}
