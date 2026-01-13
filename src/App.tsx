import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import LoginSelect from "./pages/auth/LoginSelect";
import AdminLogin from "./pages/auth/AdminLogin";
import EngineerLogin from "./pages/auth/EngineerLogin";
import ClientLogin from "./pages/auth/ClientLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminCalls from "./pages/admin/AdminCalls";
import EngineerDashboard from "./pages/engineer/EngineerDashboard";
import AgentEditor from "./pages/engineer/AgentEditor";
import EngineerLeaderboard from "./pages/engineer/EngineerLeaderboard";
import EngineerTasks from "./pages/engineer/EngineerTasks";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientLeads from "./pages/client/ClientLeads";
import ClientCalls from "./pages/client/ClientCalls";
import ClientBatches from "./pages/client/ClientBatches";
import ClientPhoneNumbers from "./pages/client/ClientPhoneNumbers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            
            {/* Auth Routes */}
            <Route path="/login" element={<LoginSelect />} />
            <Route path="/login/admin" element={<AdminLogin />} />
            <Route path="/login/engineer" element={<EngineerLogin />} />
            <Route path="/login/client" element={<ClientLogin />} />
            
            {/* Admin Routes - Protected */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agents"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAgents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/calls"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminCalls />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/batches"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ClientBatches />
                </ProtectedRoute>
              }
            />
            
            {/* Engineer Routes - Protected */}
            <Route
              path="/engineer"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <EngineerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/agents"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <AgentEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/leaderboard"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <EngineerLeaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/tasks"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <EngineerTasks />
                </ProtectedRoute>
              }
            />
            
            {/* Client Routes - Protected */}
            <Route
              path="/client"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/leads"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientLeads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/calls"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientCalls />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/batches"
              element={
                <ProtectedRoute allowedRoles={["client", "admin"]}>
                  <ClientBatches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/phone-numbers"
              element={
                <ProtectedRoute allowedRoles={["client", "admin"]}>
                  <ClientPhoneNumbers />
                </ProtectedRoute>
              }
            />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
