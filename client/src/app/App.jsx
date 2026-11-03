import { lazy, Suspense } from 'react';
import { PageLoader } from '../components/ui/PageLoader.jsx';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary, lazyWithRetry } from '../components/ErrorBoundary.jsx';
import { SiteLayout } from '../components/layout/SiteLayout.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { RequireSignedIn } from '../features/auth/RequireAdmin.jsx';
import { CartProvider } from '../features/cart/CartContext.jsx';
import { WishlistProvider } from '../features/wishlist/WishlistContext.jsx';
import HomePage from '../pages/HomePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

// Everything except the home page is code-split, and the admin area is never downloaded by shoppers.
const page = (load) => lazy(lazyWithRetry(load));
const named = (load, name) => page(() => load().then((m) => ({ default: m[name] })));

const AdminApp = page(() => import('../admin/AdminApp.jsx'));
const ShopPage = page(() => import('../pages/ShopPage.jsx'));
const ProductPage = page(() => import('../pages/ProductPage.jsx'));
const ContactPage = page(() => import('../pages/ContactPage.jsx'));
const FaqPage = page(() => import('../pages/FaqPage.jsx'));
const ContentPage = page(() => import('../pages/ContentPage.jsx'));
const CartPage = page(() => import('../pages/CartPage.jsx'));
const WishlistPage = page(() => import('../pages/WishlistPage.jsx'));
const accountModule = () => import('../pages/AccountPages.jsx');
const AccountLoginPage = named(accountModule, 'AccountLoginPage');
const AccountRegisterPage = named(accountModule, 'AccountRegisterPage');
const AccountPage = named(accountModule, 'AccountPage');
const BookingPage = page(() => import('../pages/BookingPage.jsx'));
const bookingsModule = () => import('../pages/BookingsPages.jsx');
const BookingsPage = named(bookingsModule, 'BookingsPage');
const BookingDetailPage = named(bookingsModule, 'BookingDetailPage');
const DesignSystemPage = page(() => import('../pages/DesignSystemPage.jsx'));

const Loading = PageLoader;

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<SiteLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="shop" element={<ShopPage />} />
                  <Route path="product/:slug" element={<ProductPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="wishlist" element={<WishlistPage />} />
                  <Route path="account/login" element={<AccountLoginPage />} />
                  <Route path="account/register" element={<AccountRegisterPage />} />
                  <Route element={<RequireSignedIn />}>
                    <Route path="account" element={<AccountPage />} />
                    <Route path="account/bookings" element={<BookingsPage />} />
                    <Route path="account/bookings/:id" element={<BookingDetailPage />} />
                    <Route path="book" element={<BookingPage />} />
                  </Route>
                  <Route path="about" element={<ContentPage pageKey="about" />} />
                  <Route path="contact" element={<ContactPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="shipping-policy" element={<ContentPage pageKey="shipping-policy" />} />
                  <Route path="return-refund-policy" element={<ContentPage pageKey="return-refund-policy" />} />
                  <Route path="privacy-policy" element={<ContentPage pageKey="privacy-policy" />} />
                  <Route path="terms-and-conditions" element={<ContentPage pageKey="terms-and-conditions" />} />
                  {import.meta.env.DEV && <Route path="design-system" element={<DesignSystemPage />} />}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="/admin/*" element={<AdminApp />} />
              </Routes>
            </Suspense>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
