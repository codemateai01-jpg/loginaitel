import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import LoginSelect from "./pages/auth/LoginSelect";
import AdminLogin from "./pages/auth/AdminLogin";
import EngineerLogin from "./pages/auth/EngineerLogin";
import ClientLogin from "./pages/auth/ClientLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTasks from "./pages/admin/AdminTasks";
import EngineerDashboard from "./pages/engineer/EngineerDashboard";
import AgentBuilder from "./pages/engineer/AgentBuilder";
import EngineerLeaderboard from "./pages/engineer/EngineerLeaderboard";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientLeads from "./pages/client/ClientLeads";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<LoginSelect />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/engineer" element={<EngineerLogin />} />
          <Route path="/login/client" element={<ClientLogin />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/tasks" element={<AdminTasks />} />
          
          {/* Engineer Routes */}
          <Route path="/engineer" element={<EngineerDashboard />} />
          <Route path="/engineer/agents" element={<AgentBuilder />} />
          <Route path="/engineer/leaderboard" element={<EngineerLeaderboard />} />
          
          {/* Client Routes */}
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/leads" element={<ClientLeads />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
