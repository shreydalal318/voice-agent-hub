import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AdminLayout from "./layouts/AdminLayout";
import ClientLayout from "./layouts/ClientLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminPhoneNumbers from "./pages/admin/AdminPhoneNumbers";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientAgents from "./pages/client/ClientAgents";
import ClientKnowledge from "./pages/client/ClientKnowledge";
import ClientBookings from "./pages/client/ClientBookings";
import ClientPhoneNumbers from "./pages/client/ClientPhoneNumbers";
import ClientSettings from "./pages/client/ClientSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Redirect based on role
  if (role === 'admin') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="phone-numbers" element={<AdminPhoneNumbers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
        </Route>
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  if (role === 'client') {
    return (
      <Routes>
        <Route path="/dashboard" element={<ClientLayout />}>
          <Route index element={<ClientDashboard />} />
          <Route path="agents" element={<ClientAgents />} />
          <Route path="knowledge" element={<ClientKnowledge />} />
          <Route path="bookings" element={<ClientBookings />} />
          <Route path="phone-numbers" element={<ClientPhoneNumbers />} />
          <Route path="settings" element={<ClientSettings />} />
        </Route>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // User has no role assigned yet
  return <NoRoleScreen />;
}

function NoRoleScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">Your account has no role assigned yet.</p>
        <p className="text-sm text-muted-foreground">Please contact your administrator.</p>
        <button onClick={() => signOut()} className="text-primary text-sm underline">Sign out</button>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
