import {
  Boxes,
  Image,
  MessageCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ClipboardList,
  Star,
  Tag,
  Tags,
  Users,
} from 'lucide-react';

// Items with a `milestone` are placeholders for modules that are not built yet.
export const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/brands', label: 'Brands', icon: Tag },
  { to: '/admin/featured', label: 'Featured products', icon: Star },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare },
  { to: '/admin/banners', label: 'Homepage banners', icon: Image },
  { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList, alert: true },
  { to: '/admin/notifications', label: 'WhatsApp messages', icon: MessageCircle },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/settings', label: 'Store settings', icon: Settings, adminOnly: true },
];
