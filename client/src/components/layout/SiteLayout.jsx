import { ArrowRight, ArrowUpRight, Clock, Heart, Mail, MapPin, Menu, Phone, Search, ShoppingBag, User, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isPlaceholder, mailHref, mainNav, policyLinks, telHref } from '../../config/business.js';
import { useBusiness } from '../../features/business/useBusiness.js';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useWishlist } from '../../features/wishlist/WishlistContext.jsx';
import { cn } from '../../lib/cn.js';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import { Button } from '../ui/Button.jsx';
import { Container } from '../ui/Container.jsx';
import { PageLoader } from '../ui/PageLoader.jsx';
import { Wordmark } from '../ui/Wordmark.jsx';

const linkClass = ({ isActive }) =>
  cn(
    'link-draw py-1 text-[0.95rem] font-medium transition-colors',
    isActive ? 'text-ink [background-size:100%_1px]' : 'text-muted hover:text-ink',
  );

function SearchForm({ className, onDone, id }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
        setValue('');
        onDone?.();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search purifiers"
          className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-4 text-sm placeholder:text-muted/70 transition-all hover:border-ink/40 focus:border-brand-500 focus:shadow-glow focus:outline-none"
        />
      </div>
    </form>
  );
}

/** Icon link with an optional count badge; the count is part of the accessible name. */
function IconLink({ to, label, count, children, className }) {
  return (
    <Link to={to} aria-label={count > 0 ? `${label} (${count})` : label} className={cn('relative grid size-10 place-items-center rounded-lg text-ink transition-colors hover:bg-ink/5', className)}>
      {children}
      {count > 0 && (
        <span key={count} aria-hidden="true" className="pop absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[0.65rem] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>
      )}
    </Link>
  );
}

const CONTACT_ICON = { Phone, Email: Mail, Address: MapPin, Hours: Clock };

function ContactLine({ label, value, href }) {
  if (!value) return null;
  const Icon = CONTACT_ICON[label];
  const placeholder = isPlaceholder(value);
  return (
    <p className="flex items-start gap-3 text-sm">
      {Icon && <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-300" />}
      <span>
        <span className="sr-only">{label}: </span>
        {placeholder ? (
          <span className="italic text-white/60">{value}</span>
        ) : href ? (
          <a href={href} className="link-draw text-white">
            {value}
          </a>
        ) : (
          <span className="text-white/80">{value}</span>
        )}
      </span>
    </p>
  );
}

export function SiteLayout() {
  const business = useBusiness();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, status } = useAuth();
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const accountTo = status === 'authenticated' ? '/account' : '/account/login';
  const accountLabel = status === 'authenticated' ? `Your account (${user?.name})` : 'Sign in';

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {business.isPreview && (
        <div className="bg-ink px-4 py-2 text-center text-xs text-white/80">
          <strong className="font-semibold text-accent-300">Preview site.</strong> Products, testimonials and business details shown here are
          demo content until real information is added.
        </div>
      )}

      <header className={cn('sticky top-0 z-40 bg-paper transition-shadow duration-300', scrolled ? 'shadow-[0_1px_0_var(--color-line),0_14px_24px_-22px_rgb(23_25_28/0.4)]' : 'border-b border-line')}>
        <Container className="flex h-[4.5rem] items-center gap-8">
          <Link to="/" aria-label={`${business.name} home`} className="shrink-0">
            <Wordmark className="h-10" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            {mainNav.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <SearchForm id="header-search" className="mr-2 hidden w-56 lg:block" />
            <IconLink to="/wishlist" label="Wishlist" count={wishCount} className="hidden sm:grid"><Heart size={20} /></IconLink>
            <IconLink to={accountTo} label={accountLabel} className="hidden sm:grid"><User size={20} /></IconLink>
            <IconLink to="/cart" label="Cart" count={cartCount}><ShoppingBag size={20} /></IconLink>
            {/* Wrapped in a div: Button sets its own display, which would fight a `hidden` class on the button itself. */}
            <div className="ml-2 hidden lg:block">
              <Button as={Link} to="/contact" size="sm">
                Enquire
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-ink transition-colors hover:bg-ink/5 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </Container>

        <div id="mobile-menu" hidden={!menuOpen} className="page-enter border-t border-line bg-paper md:hidden">
          <Container className="space-y-6 py-6">
            <SearchForm id="mobile-search" onDone={() => setMenuOpen(false)} />
            <nav aria-label="Mobile" className="flex flex-col">
              {mainNav.map(({ to, label }, i) => (
                <NavLink
                  key={to}
                  to={to}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={({ isActive }) => cn('page-enter flex items-center justify-between border-b border-line py-4 font-display text-2xl font-bold tracking-tight', isActive ? 'text-brand-600' : 'text-ink')}
                >
                  {label}
                  <ArrowRight size={18} aria-hidden="true" className="text-muted" />
                </NavLink>
              ))}
            </nav>
            <ul className="grid grid-cols-2 gap-3 text-sm">
              <li><Link to="/wishlist" className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-ink"><Heart size={16} aria-hidden="true" /> Wishlist{wishCount > 0 && ` (${wishCount})`}</Link></li>
              <li><Link to={accountTo} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-ink"><User size={16} aria-hidden="true" /> {status === 'authenticated' ? 'Account' : 'Sign in'}</Link></li>
            </ul>
            <Button as={Link} to="/contact" className="w-full">
              Enquire about a product
            </Button>
          </Container>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* A failing page shows a message here while the header and footer keep working. */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoader />}>
            <div key={pathname} className="page-enter"><Outlet /></div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="relative overflow-hidden bg-ink text-white">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-accent-500" />
        <Container>
          <div className="grid gap-10 border-b border-white/10 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <p className="font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Pure water<span className="text-accent-400">.</span><br />Better living<span className="text-accent-400">.</span>
            </p>
            <div>
              <p className="max-w-sm leading-relaxed text-white/70">Browse the range, book online and we will contact you to confirm the details.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button as={Link} to="/shop" variant="accent">Explore purifiers <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" /></Button>
                <Button as={Link} to="/contact" variant="onDark">Make an enquiry</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.5fr]">
            <div>
              <Wordmark inverted className="h-11" />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">{business.category} from {business.name}.</p>
            </div>

            <nav aria-label="Shop and company">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">Explore</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {[{ to: '/shop', label: 'All products' }, ...mainNav.filter((n) => n.to !== '/shop')].map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="link-draw text-white/80 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Policies">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">Policies</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {policyLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="link-draw text-white/80 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">Contact</h2>
              <div className="mt-5 space-y-3.5">
                <ContactLine label="Phone" value={business.contact.phone} href={telHref(business.contact.phone)} />
                <ContactLine label="Email" value={business.contact.email} href={mailHref(business.contact.email)} />
                <ContactLine label="Address" value={business.contact.address} />
                <ContactLine label="Hours" value={business.contact.hours} />
              </div>
            </div>
          </div>
        </Container>

        <div className="border-t border-white/10">
          <Container className="flex flex-col gap-1 py-5 text-xs text-white/50 sm:flex-row sm:justify-between">
            <p>
              &copy; {new Date().getFullYear()} {business.name}. All rights reserved.
            </p>
            {business.isPreview && <p>Preview: placeholder content and demo products.</p>}
            <a href="#main" className="link-draw inline-flex items-center gap-1 text-white/60 hover:text-white">Back to top <ArrowUpRight size={12} aria-hidden="true" /></a>
          </Container>
        </div>
      </footer>
    </div>
  );
}
