import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/layout/AdminLayout";
import { Spinner } from "@/components/ui/Spinner";

// Route-level code splitting: each page ships as its own chunk, loaded on demand.
const Login = lazy(() => import("@/pages/Login"));
const DashboardHome = lazy(() => import("@/pages/DashboardHome"));
const Orders = lazy(() => import("@/pages/Orders"));
const Shipping = lazy(() => import("@/pages/Shipping"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerProfile = lazy(() => import("@/pages/CustomerProfile"));
const Products = lazy(() => import("@/pages/Products"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Served at the site root in dev (Vite) and under /admin in production. The base
// path is injected at build time by Vite `define` (see admin/vite.config.ts).
const BASENAME = typeof __ADMIN_BASENAME__ !== "undefined" ? __ADMIN_BASENAME__ : "/";

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="h-8 w-8 text-brand" />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={BASENAME}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected area */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/shipping" element={<Shipping />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/marketing" element={<Marketing />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
