import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Wordmark } from '../components/ui/Wordmark.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { cn } from '../lib/cn.js';
import { adminNav } from './nav.js';
import { useUnreadBookings } from './unreadBookings.js';

const SIDEBAR_ID = 'admin-sidebar';

/** Responsive admin shell: a fixed sidebar from `lg` up, and an off-canvas drawer below it. */
export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const unread = useUnreadBookings();

  // The unread count also shows in the browser tab title, so a new booking is noticed even from another tab.
  useEffect(() => {
    const previous = document.title;
    document.title = unread > 0 ? `(${unread}) New bookings | VR Enterprises Admin` : 'VR Enterprises Admin';
    return () => { document.title = previous; };
  }, [unread]);
  const toast = useToast();
  const current = adminNav.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const signOut = async () => {
    try {
      await logout();
    } catch {
      toast.error('Could not reach the server, but you have been signed out on this device.');
    }
  };

  return (
    <div className="min-h-dvh bg-paper lg:flex">
      {open && <div className="fixed inset-0 z-40 bg-brand-950/60 lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}

      <aside
        id={SIDEBAR_ID}
        aria-label="Admin navigation"
        className={cn(
          'bg-navy-glow fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col text-brand-100 shadow-soft transition-transform duration-300 ease-out',
          'lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0',
          open ? 'translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full',
        )}
      >
        <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Wordmark inverted className="h-10" />
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-brand-200 hover:bg-white/10 lg:hidden" aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {adminNav.filter((item) => !item.adminOnly || user?.role === 'admin').map(({ to, label, icon: Icon, end, milestone, alert }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                  isActive ? 'bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-400' : 'text-brand-200 hover:bg-white/[0.07] hover:text-white',
                  milestone && !isActive && 'opacity-60',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
              {alert && unread > 0 && (
                <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-xs font-bold text-white">
                  {unread}<span className="sr-only"> unread bookings</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center gap-3 border-b border-line bg-paper px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-2 rounded-lg p-2 text-brand-900 hover:bg-brand-50 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls={SIDEBAR_ID}
          >
            <Menu size={22} />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-tight">{current?.label ?? 'Admin'}</h1>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <Link to="/admin/bookings?unread=true" className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-sm font-semibold text-accent-700 ring-1 ring-accent-200 transition-colors hover:bg-accent-200" aria-label={`${unread} new bookings`}>
                <Bell size={14} aria-hidden="true" /> {unread} new
              </Link>
            )}
            <span className="hidden text-sm text-muted sm:block">{user?.name}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div key={pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
