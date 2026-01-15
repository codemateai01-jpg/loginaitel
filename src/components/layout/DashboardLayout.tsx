import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Bot,
  ClipboardList,
  CreditCard,
  Phone,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Trophy,
  Clock,
  Upload,
  Building2,
  CalendarCheck,
  UserCheck,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "engineer" | "client";
}

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Prompt Engineers", href: "/admin/engineers" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: ClipboardList, label: "Tasks", href: "/admin/tasks" },
  { icon: Bot, label: "Agents", href: "/admin/agents" },
  { icon: Upload, label: "Leads", href: "/admin/leads" },
  { icon: Phone, label: "Make Call", href: "/admin/make-call" },
  { icon: Phone, label: "Calls", href: "/admin/calls" },
  { icon: Phone, label: "Phone Numbers", href: "/admin/phone-numbers" },
  { icon: CreditCard, label: "Credits", href: "/admin/credits" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

const engineerNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/engineer" },
  { icon: ClipboardList, label: "My Tasks", href: "/engineer/tasks" },
  { icon: Bot, label: "My Workspace", href: "/engineer/agents" },
  { icon: Settings, label: "Agent Config", href: "/engineer/agent-config" },
  { icon: Upload, label: "Leads", href: "/engineer/leads" },
  { icon: Phone, label: "Make Call", href: "/engineer/make-call" },
  { icon: Trophy, label: "Leaderboard", href: "/engineer/leaderboard" },
  { icon: Clock, label: "Time Tracker", href: "/engineer/time" },
  { icon: Settings, label: "Settings", href: "/engineer/settings" },
];

const clientNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/client" },
  { icon: Bot, label: "My Agents", href: "/client/agents" },
  { icon: Phone, label: "Make Call", href: "/client/make-call" },
  { icon: Phone, label: "Call History", href: "/client/calls" },
  { icon: Upload, label: "Leads", href: "/client/leads" },
  { icon: Phone, label: "Phone Numbers", href: "/client/phone-numbers" },
  { icon: CreditCard, label: "Credits & Billing", href: "/client/billing" },
  { icon: Settings, label: "Settings", href: "/client/settings" },
];

// Real Estate CRM navigation
const realEstateNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/client/realestate" },
  { icon: Building2, label: "Projects", href: "/client/realestate/projects" },
  { icon: Users, label: "Leads", href: "/client/realestate/leads" },
  { icon: CalendarCheck, label: "Site Visits", href: "/client/realestate/site-visits" },
  { icon: UserCheck, label: "Sales Team", href: "/client/realestate/sales-team" },
  { icon: History, label: "Call History", href: "/client/realestate/call-history" },
  { icon: Bot, label: "My Agents", href: "/client/agents" },
  { icon: CreditCard, label: "Credits & Billing", href: "/client/billing" },
  { icon: Settings, label: "Settings", href: "/client/settings" },
];

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  // Fetch user's CRM type for clients
  const { data: profile } = useQuery({
    queryKey: ["profile-crm-type", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("crm_type")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id && role === "client",
  });

  const isRealEstateCRM = profile?.crm_type === "real_estate";

  const navItems =
    role === "admin"
      ? adminNavItems
      : role === "engineer"
      ? engineerNavItems
      : isRealEstateCRM
      ? realEstateNavItems
      : clientNavItems;

  const roleLabel =
    role === "admin"
      ? "Admin Portal"
      : role === "engineer"
      ? "Engineer Portal"
      : "Client Portal";

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b-2 border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Aitel" className="h-6 w-6 rounded" />
          <span className="font-bold">Telecalling Console</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-background border-r-2 border-border transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b-2 border-border">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Aitel" className="h-8 w-8 rounded" />
              <div>
                <span className="font-bold text-lg block">Telecalling Console</span>
                <span className="text-xs text-muted-foreground">{roleLabel}</span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium border-2 transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-transparent hover:bg-accent hover:border-border"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t-2 border-border">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
