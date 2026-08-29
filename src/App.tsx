import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { ErrorBoundary, RouteErrorBoundary } from "./components/ErrorBoundary";
import NetworkStatus from "./components/NetworkStatus";

// Shared layouts (always loaded)
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";

// ─── Lazy-loaded Pages (code-split per route) ────────────────
const MenuPage = lazy(() => import("./pages/MenuPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const TrackOrderPage = lazy(() => import("./pages/TrackOrderPage"));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminQR = lazy(() => import("./pages/AdminQR"));
const AdminMenu = lazy(() => import("./pages/AdminMenu"));
const AdminStaff = lazy(() => import("./pages/AdminStaff"));
const AdminStats = lazy(() => import("./pages/AdminStats"));
const AdminHistory = lazy(() => import("./pages/AdminHistory"));
const AdminBilling = lazy(() => import("./pages/AdminBilling"));
const KitchenDisplay = lazy(() => import("./pages/KitchenDisplay"));
const AdminPos = lazy(() => import("./pages/AdminPos"));
const AdminPurchases = lazy(() => import("./pages/AdminPurchases"));

// ─── Loading Fallback ────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
      <p className="text-stone-500 font-medium">Loading...</p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkStatus />
      <HashRouter>
        <Toaster position="top-center" richColors />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/qr" replace />} />
            
            {/* Customer Routes — public, no auth required */}
            <Route path="/table/:tableId" element={
              <RouteErrorBoundary routeName="Menu">
                <Layout><MenuPage /></Layout>
              </RouteErrorBoundary>
            } />
            <Route path="/cart" element={
              <RouteErrorBoundary routeName="Cart">
                <Layout><CartPage /></Layout>
              </RouteErrorBoundary>
            } />
            <Route path="/checkout" element={
              <RouteErrorBoundary routeName="Checkout">
                <Layout><CheckoutPage /></Layout>
              </RouteErrorBoundary>
            } />
            <Route path="/order/:orderId" element={
              <RouteErrorBoundary routeName="Order Tracking">
                <Layout><TrackOrderPage /></Layout>
              </RouteErrorBoundary>
            } />
            <Route path="/receipt/:orderId" element={
              <RouteErrorBoundary routeName="Receipt">
                <Layout><ReceiptPage /></Layout>
              </RouteErrorBoundary>
            } />
            
            {/* Admin Routes — auth guard via AdminLayout */}
            <Route path="/admin" element={
              <RouteErrorBoundary routeName="Live Orders">
                <AdminLayout><AdminDashboard /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/stats" element={
              <RouteErrorBoundary routeName="Statistics">
                <AdminLayout><AdminStats /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/pos" element={
              <RouteErrorBoundary routeName="POS & Tables">
                <AdminLayout><AdminPos /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/purchases" element={
              <RouteErrorBoundary routeName="Invoices & Purchases">
                <AdminLayout><AdminPurchases /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/menu" element={
              <RouteErrorBoundary routeName="Menu Management">
                <AdminLayout><AdminMenu /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/qr" element={
              <RouteErrorBoundary routeName="QR Codes">
                <AdminLayout><AdminQR /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/staff" element={
              <RouteErrorBoundary routeName="Staff Management">
                <AdminLayout><AdminStaff /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/history" element={
              <RouteErrorBoundary routeName="Order History">
                <AdminLayout><AdminHistory /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/billing" element={
              <RouteErrorBoundary routeName="Billing">
                <AdminLayout><AdminBilling /></AdminLayout>
              </RouteErrorBoundary>
            } />
            <Route path="/admin/kitchen" element={
              <RouteErrorBoundary routeName="Kitchen Display">
                <AdminLayout><KitchenDisplay /></AdminLayout>
              </RouteErrorBoundary>
            } />
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
