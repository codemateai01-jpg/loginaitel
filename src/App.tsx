import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import LoginSelect from "./pages/auth/LoginSelect";
import ClientLogin from "./pages/auth/ClientLogin";
import EngineerLogin from "./pages/auth/EngineerLogin";
import AdminLogin from "./pages/auth/AdminLogin";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientCalls from "./pages/client/ClientCalls";
import ClientPhoneNumbers from "./pages/client/ClientPhoneNumbers";
import ClientAgents from "./pages/client/ClientAgents";
import ClientBilling from "./pages/client/ClientBilling";
import ClientSettings from "./pages/client/ClientSettings";
import ClientCampaigns from "./pages/client/ClientCampaigns";
import CampaignDetail from "./pages/client/CampaignDetail";
import CampaignAnalytics from "./pages/client/CampaignAnalytics";
import CampaignInterestedLeads from "./pages/client/CampaignInterestedLeads";
import CampaignNotInterestedLeads from "./pages/client/CampaignNotInterestedLeads";
import CampaignPartialLeads from "./pages/client/CampaignPartialLeads";
import EngineerDashboard from "./pages/engineer/EngineerDashboard";
import EngineerTasks from "./pages/engineer/EngineerTasks";
import EngineerLeaderboard from "./pages/engineer/EngineerLeaderboard";
import EngineerAgentsDashboard from "./pages/engineer/EngineerAgentsDashboard";
import AgentConfigEditor from "./pages/engineer/AgentConfigEditor";
import AgentEditor from "./pages/engineer/AgentEditor";
import DemoCallsPage from "./pages/engineer/DemoCallsPage";
import EngineerSettings from "./pages/engineer/EngineerSettings";
import EngineerTimeTracker from "./pages/engineer/EngineerTimeTracker";
import MakeCallPage from "./pages/shared/MakeCallPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminCalls from "./pages/admin/AdminCalls";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminPhoneNumbers from "./pages/admin/AdminPhoneNumbers";
import AdminRealTimeMonitor from "./pages/admin/AdminRealTimeMonitor";
import AdminClients from "./pages/admin/AdminClients";
import AdminEngineers from "./pages/admin/AdminEngineers";
import AdminDemoLogs from "./pages/admin/AdminDemoLogs";
import AdminCredits from "./pages/admin/AdminCredits";
import AdminSettings from "./pages/admin/AdminSettings";

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
              path="/admin/phone-numbers"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminPhoneNumbers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/monitor"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminRealTimeMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/engineers"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminEngineers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/demo-logs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDemoLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/credits"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminCredits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/make-call"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <MakeCallPage role="admin" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
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
                  <EngineerAgentsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/agent-editor"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <AgentEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/agent-config"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <AgentConfigEditor />
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
            <Route
              path="/engineer/agent"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <AgentEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/demo-calls"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <DemoCallsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/settings"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <EngineerSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/time"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <EngineerTimeTracker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/engineer/make-call"
              element={
                <ProtectedRoute allowedRoles={["engineer"]}>
                  <MakeCallPage role="engineer" />
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
              path="/client/agents"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientAgents />
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
              path="/client/phone-numbers"
              element={
                <ProtectedRoute allowedRoles={["client", "admin"]}>
                  <ClientPhoneNumbers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/make-call"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <MakeCallPage role="client" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/billing"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientBilling />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/settings"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientCampaigns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns/:id"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CampaignDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns/:id/analytics"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CampaignAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns/:id/interested"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CampaignInterestedLeads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns/:id/not-interested"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CampaignNotInterestedLeads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/campaigns/:id/partial"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <CampaignPartialLeads />
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
