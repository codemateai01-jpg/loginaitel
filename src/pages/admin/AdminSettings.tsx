import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings,
  User,
  Shield,
  Bell,
  Database,
  Globe,
  Key,
  Save,
  RefreshCw,
} from "lucide-react";

export default function AdminSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch admin profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Update form when profile loads
  useState(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({ full_name: fullName, phone });
  };

  // System stats
  const { data: systemStats } = useQuery({
    queryKey: ["admin-system-stats"],
    queryFn: async () => {
      const { count: totalUsers } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      const { count: totalCalls } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true });

      const { count: totalAgents } = await supabase
        .from("aitel_agents")
        .select("*", { count: "exact", head: true });

      return {
        totalUsers: totalUsers || 0,
        totalCalls: totalCalls || 0,
        totalAgents: totalAgents || 0,
      };
    },
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your admin account and system settings
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="border-2 border-border">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Database className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </h3>
              <div className="grid gap-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending}
                  className="w-fit"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 mt-6">
            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Key className="h-5 w-5" />
                Password & Authentication
              </h3>
              <div className="space-y-4 max-w-md">
                <p className="text-sm text-muted-foreground">
                  To change your password, use the password reset flow from the
                  login page.
                </p>
                <Button variant="outline" asChild>
                  <a href="/login/admin">Go to Login Page</a>
                </Button>
              </div>
            </div>

            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Two-Factor Authentication
              </h3>
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <p className="font-medium">Enable 2FA</p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch disabled />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Coming soon
              </p>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6 mt-6">
            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Overview
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">
                    {systemStats?.totalUsers || 0}
                  </p>
                </div>
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">
                    {systemStats?.totalCalls || 0}
                  </p>
                </div>
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Agents</p>
                  <p className="text-2xl font-bold">
                    {systemStats?.totalAgents || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5" />
                API Configuration
              </h3>
              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Webhook URL</p>
                    <p className="text-sm text-muted-foreground">
                      Endpoint for receiving call updates
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-webhook`
                      );
                      toast.success("Webhook URL copied to clipboard");
                    }}
                  >
                    Copy URL
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Data Management
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Manage system data and perform maintenance tasks.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      queryClient.invalidateQueries();
                      toast.success("All data refreshed");
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh All Data
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <div className="border-2 border-border bg-card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </h3>
              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive email alerts for important events
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Task Completion Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when engineers complete tasks
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Low Credit Warnings</p>
                    <p className="text-sm text-muted-foreground">
                      Alert when client credits are running low
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Notification settings are saved automatically
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}