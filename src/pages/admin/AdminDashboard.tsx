import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CreditCard, ClipboardList, BarChart3 } from "lucide-react";
import { UserManagement } from "@/components/admin/UserManagement";
import { CreditManagement } from "@/components/admin/CreditManagement";
import { TaskManagement } from "@/components/admin/TaskManagement";
import { SystemAnalytics } from "@/components/admin/SystemAnalytics";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.email?.split("@")[0] || "Admin"}
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="border-2 border-border bg-card p-1 h-auto flex-wrap">
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4" />
              Credits
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
              Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <SystemAnalytics />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="credits">
            <CreditManagement />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
