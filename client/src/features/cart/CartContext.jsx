import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as accountApi from '../../api/account.js';
import { useAuth } from '../auth/AuthContext.jsx';

const CartContext = createContext(null);

const KEY = 'vr_cart';
export const MAX_LINE_QUANTITY = 10;
const EMPTY = { lines: [], itemCount: 0, subtotal: 0, currency: 'INR' };

const readLocal = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i?.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0) : [];
  } catch {
    return [];
  }
};
const writeLocal = (items) => {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the cart still works until the page is closed
  }
};

/**
 * Cart for guests (kept in this browser, priced by the server on every view) and for signed-in customers
 * (stored on the server). Signing in merges the guest cart into the account. Prices always come from the
 * server's response; the browser only ever stores product ids and quantities.
 */
export function CartProvider({ children }) {
  const { status } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [state, setState] = useState({ loading: false, error: null });
  const guestItems = useRef(readLocal());
  const authed = status === 'authenticated';

  const run = useCallback(async (work) => {
    setState({ loading: true, error: null });
    try {
      const next = await work();
      setCart(next);
      setState({ loading: false, error: null });
      return next;
    } catch (error) {
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  const quoteGuest = useCallback(
    () => run(async () => (guestItems.current.length ? (await accountApi.quoteCart(guestItems.current)).cart : EMPTY)),
    [run],
  );

  // Load (and merge) whenever the sign-in state settles.
  useEffect(() => {
    if (status === 'loading') return;
    const load = async () => {
      if (authed) {
        const local = guestItems.current;
        if (local.length) {
          await run(async () => (await accountApi.mergeCart(local)).cart);
          guestItems.current = [];
          writeLocal([]);
        } else {
          await run(async () => (await accountApi.getCart()).cart);
        }
      } else {
        await quoteGuest();
      }
    };
    load().catch(() => {});
  }, [status, authed, run, quoteGuest]);

  const quantityOf = useCallback((productId) => cart.lines.find((l) => l.productId === productId)?.quantity ?? 0, [cart]);

  const setQuantity = useCallback(
    async (productId, quantity) => {
      const q = Math.max(0, Math.min(quantity, MAX_LINE_QUANTITY));
      if (authed) {
        return run(async () => (q === 0 ? await accountApi.removeCartItem(productId) : await accountApi.setCartItem(productId, q)).cart);
      }
      const others = guestItems.current.filter((i) => i.productId !== productId);
      guestItems.current = q === 0 ? others : [...others, { productId, quantity: q }];
      writeLocal(guestItems.current);
      return quoteGuest();
    },
    [authed, run, quoteGuest],
  );

  const add = useCallback((productId, quantity = 1) => setQuantity(productId, quantityOf(productId) + quantity), [setQuantity, quantityOf]);
  const remove = useCallback((productId) => setQuantity(productId, 0), [setQuantity]);

  const clear = useCallback(async () => {
    if (authed) return run(async () => (await accountApi.clearCart()).cart);
    guestItems.current = [];
    writeLocal([]);
    setCart(EMPTY);
    return EMPTY;
  }, [authed, run]);

  const value = useMemo(
    () => ({ cart, loading: state.loading, error: state.error, count: cart.itemCount, quantityOf, add, setQuantity, remove, clear, reload: () => (authed ? run(async () => (await accountApi.getCart()).cart) : quoteGuest()) }),
    [cart, state, quantityOf, add, setQuantity, remove, clear, authed, run, quoteGuest],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
