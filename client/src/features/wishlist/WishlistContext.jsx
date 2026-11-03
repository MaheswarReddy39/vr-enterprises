import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as accountApi from '../../api/account.js';
import { useAuth } from '../auth/AuthContext.jsx';

const WishlistContext = createContext(null);
const KEY = 'vr_wishlist';

const readLocal = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};
const writeLocal = (ids) => {
  try {
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the list still works until the page is closed
  }
};

/** Saved products. Guests keep ids in this browser; signed-in customers keep them on the server (guest ids are merged on sign-in). */
export function WishlistProvider({ children }) {
  const { status } = useAuth();
  const authed = status === 'authenticated';
  const [ids, setIds] = useState(readLocal);
  const guestIds = useRef(readLocal());

  useEffect(() => {
    if (status === 'loading') return;
    if (!authed) {
      guestIds.current = readLocal();
      setIds(guestIds.current);
      return;
    }
    const local = guestIds.current;
    const load = local.length ? accountApi.mergeWishlist(local) : accountApi.getWishlist();
    load
      .then((res) => {
        setIds(res.ids);
        guestIds.current = [];
        writeLocal([]);
      })
      .catch(() => {});
  }, [status, authed]);

  const has = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(
    async (id) => {
      const saved = ids.includes(id);
      if (authed) {
        const res = await (saved ? accountApi.removeWishlist(id) : accountApi.addWishlist(id));
        setIds(res.ids);
        return !saved;
      }
      const next = saved ? ids.filter((x) => x !== id) : [...ids, id];
      guestIds.current = next;
      writeLocal(next);
      setIds(next);
      return !saved;
    },
    [ids, authed],
  );

  const value = useMemo(() => ({ ids, count: ids.length, has, toggle }), [ids, has, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return context;
}
