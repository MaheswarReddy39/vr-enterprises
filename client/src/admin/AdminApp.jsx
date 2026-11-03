import { Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { RequireAdmin } from '../features/auth/RequireAdmin.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import { AdminLayout } from './AdminLayout.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import BannersPage from './pages/BannersPage.jsx';
import { CustomerDetailPage, CustomersPage } from './pages/CustomersPages.jsx';
import BrandsPage from './pages/BrandsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import EnquiriesPage from './pages/EnquiriesPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ModulePlaceholderPage from './pages/ModulePlaceholderPage.jsx';
import { AdminBookingDetailPage, AdminBookingsPage } from './pages/BookingsAdminPages.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import ProductFormPage from './pages/ProductFormPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

/** Everything under /admin. Code-split from the storefront, which never loads it. */
export default function AdminApp() {
  return (
    <ToastProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id/edit" element={<ProductFormPage />} />
              <Route path="featured" element={<ProductsPage featuredOnly />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="banners" element={<BannersPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="bookings/:id" element={<AdminBookingDetailPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="enquiries" element={<EnquiriesPage />} />
              <Route path=":module" element={<ModulePlaceholderPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
    </ToastProvider>
  );
}
