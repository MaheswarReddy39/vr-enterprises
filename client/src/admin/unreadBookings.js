import { useEffect, useState } from 'react';
import * as bookingsApi from '../api/bookings.js';

const EVENT = 'vr:bookings-changed';
const POLL_MS = 30_000;

/** Pages call this after reading or changing a booking so the alert badge updates straight away. */
export const refreshUnreadBookings = () => window.dispatchEvent(new Event(EVENT));

/** Number of unread ("new") bookings: loaded on mount, refreshed every 30 seconds and after changes. */
export function useUnreadBookings() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => bookingsApi.getUnreadCount().then((r) => alive && setCount(r.unreadCount)).catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(EVENT, load);
    };
  }, []);
  return count;
}
