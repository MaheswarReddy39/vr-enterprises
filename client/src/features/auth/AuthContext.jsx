import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as accountApi from '../../api/account.js';
import * as adminApi from '../../api/admin.js';
import { refreshAccessToken, setAccessToken, setAuthLostHandler } from '../../api/client.js';

const AuthContext = createContext(null);

export const ADMIN_ROLES = ['admin', 'staff'];

// A non-sensitive "this browser was signed in" flag. Without it we do not even ask the server for a session,
// so anonymous shoppers never trigger a pointless (and noisy 401) refresh request on every page load.
const HINT_KEY = 'vr_session';
const hint = {
  has: () => {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: (on) => {
    try {
      if (on) localStorage.setItem(HINT_KEY, '1');
      else localStorage.removeItem(HINT_KEY);
    } catch {
      // storage unavailable (private mode): the session still works for this page view
    }
  },
};

const signedOut = (expired = false) => ({ status: 'unauthenticated', user: null, expired });

export function AuthProvider({ children }) {
  // status: 'loading' (checking for an existing session) | 'authenticated' | 'unauthenticated'
  const [state, setState] = useState(() => (hint.has() ? { status: 'loading', user: null, expired: false } : signedOut()));

  useEffect(() => {
    setAuthLostHandler(() => {
      hint.set(false);
      setState(signedOut(true));
    });
    if (hint.has()) {
      refreshAccessToken()
        .then(({ user }) => setState({ status: 'authenticated', user, expired: false }))
        .catch(() => {
          hint.set(false);
          setState(signedOut());
        });
    }
    return () => setAuthLostHandler(() => {});
  }, []);

  const adopt = useCallback(({ accessToken, user }) => {
    setAccessToken(accessToken);
    hint.set(true);
    setState({ status: 'authenticated', user, expired: false });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } finally {
      setAccessToken(null);
      hint.set(false);
      setState(signedOut());
    }
  }, []);

  /** `adminOnly` is used by the admin sign-in page: a customer account is signed straight back out. */
  const login = useCallback(
    async (email, password, { adminOnly = false } = {}) => {
      const session = await adminApi.login(email, password);
      if (adminOnly && !ADMIN_ROLES.includes(session.user.role)) {
        await adminApi.logout().catch(() => {});
        const error = new Error('This account does not have access to the admin dashboard.');
        error.status = 403;
        throw error;
      }
      return adopt(session);
    },
    [adopt],
  );

  const register = useCallback(async (details) => adopt(await accountApi.register(details)), [adopt]);
  const replaceSession = useCallback((session) => adopt(session), [adopt]);
  const setUser = useCallback((user) => setState((s) => ({ ...s, user })), []);

  const value = useMemo(
    () => ({ ...state, isAdmin: ADMIN_ROLES.includes(state.user?.role), login, register, logout, replaceSession, setUser }),
    [state, login, register, logout, replaceSession, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
