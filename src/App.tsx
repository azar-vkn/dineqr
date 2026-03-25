import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// Pages
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminQR from "./pages/AdminQR";
import AdminMenu from "./pages/AdminMenu";
import AdminStaff from "./pages/AdminStaff";
import AdminStats from "./pages/AdminStats";
import AdminHistory from "./pages/AdminHistory";
import TrackOrderPage from "./pages/TrackOrderPage";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Navigate to="/admin/qr" replace />} />
          
          {/* Customer Routes */}
          <Route path="/table/:tableId" element={<Layout><MenuPage /></Layout>} />
          <Route path="/cart" element={<Layout><CartPage /></Layout>} />
          <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
          <Route path="/order/:orderId" element={<Layout><TrackOrderPage /></Layout>} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/stats" element={<AdminLayout><AdminStats /></AdminLayout>} />
          <Route path="/admin/menu" element={<AdminLayout><AdminMenu /></AdminLayout>} />
          <Route path="/admin/qr" element={<AdminLayout><AdminQR /></AdminLayout>} />
          <Route path="/admin/staff" element={<AdminLayout><AdminStaff /></AdminLayout>} />
          <Route path="/admin/history" element={<AdminLayout><AdminHistory /></AdminLayout>} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
