import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Users, 
  UserPlus, 
  Phone, 
  ClipboardList, 
  Eye,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Activity,
  BarChart3,
  Receipt,
} from "lucide-react";
import { SubUserActivityLog } from "@/components/admin/SubUserActivityLog";
import { ActivitySummaryDashboard } from "@/components/admin/ActivitySummaryDashboard";
import { AddSubUserWizard } from "@/components/client/AddSubUserWizard";
import { SeatPaymentHistory } from "@/components/client/SeatPaymentHistory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SEAT_PRICE = 300;

interface SubUser {
  id: string;
  phone?: string | null;
  email?: string | null;
  full_name: string | null;
  role: "monitoring" | "telecaller" | "lead_manager";
  status: string;
  invited_at: string | null;
  created_at: string;
  activated_at: string | null;
}

const roleLabels: Record<string, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  monitoring: { 
    label: "Monitoring Team", 
    icon: <Eye className="h-4 w-4" />, 
    description: "Can view call recordings, transcripts, and analytics",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
  },
  telecaller: { 
    label: "Telecaller", 
    icon: <Phone className="h-4 w-4" />, 
    description: "Can follow up on interested leads and make calls",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  },
  lead_manager: { 
    label: "Lead Manager", 
    icon: <ClipboardList className="h-4 w-4" />, 
    description: "Can manage all leads, assignments, and pipeline",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
  },
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { 
    label: "Pending Login", 
    icon: <Clock className="h-3 w-3" />,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  },
  active: { 
    label: "Active", 
    icon: <CheckCircle className="h-3 w-3" />,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  },
  inactive: { 
    label: "Inactive", 
    icon: <XCircle className="h-3 w-3" />,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  },
};

export default function ClientTeam() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubUser | null>(null);

  // Fetch seat subscription
  const { data: seatSubscription } = useQuery({
    queryKey: ["seat-subscription-team", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_subscriptions" as any)
        .select("*")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data as any;
    },
  });

  // Fetch sub-users
  const { data: subUsers, isLoading } = useQuery({
    queryKey: ["client-sub-users", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SubUser[];
    },
    enabled: !!user,
  });

  // Delete sub-user mutation
  const deleteSubUser = useMutation({
    mutationFn: async (subUser: SubUser) => {
      const { error } = await supabase
        .from("client_sub_users")
        .delete()
        .eq("id", subUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Team member removed",
        description: "The team member has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("client_sub_users")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
      toast({
        title: `Team member ${newStatus === "active" ? "activated" : "deactivated"}`,
      });
    },
  });

  const stats = {
    total: subUsers?.length || 0,
    active: subUsers?.filter((u) => u.status === "active").length || 0,
    pending: subUsers?.filter((u) => u.status === "pending").length || 0,
    monitoring: subUsers?.filter((u) => u.role === "monitoring").length || 0,
    telecaller: subUsers?.filter((u) => u.role === "telecaller").length || 0,
    lead_manager: subUsers?.filter((u) => u.role === "lead_manager").length || 0,
  };

  const subscriptionStatus = seatSubscription
    ? seatSubscription.is_trial
      ? seatSubscription.trial_ends_at && new Date() >= new Date(seatSubscription.trial_ends_at)
        ? "expired"
        : "trial"
      : seatSubscription.autopay_enabled
        ? "active"
        : "pending"
    : null;

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Team Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Add and manage your team members. ₹{SEAT_PRICE}/user/month
            </p>
          </div>
          <div className="flex items-center gap-3">
            {subscriptionStatus && (
              <Badge 
                variant={subscriptionStatus === "active" ? "default" : "outline"}
                className={
                  subscriptionStatus === "active" 
                    ? "bg-green-500" 
                    : subscriptionStatus === "trial"
                      ? "border-primary text-primary"
                      : "border-destructive text-destructive"
                }
              >
                {subscriptionStatus === "active" ? (
                  <><CheckCircle className="h-3 w-3 mr-1" />Autopay Active</>
                ) : subscriptionStatus === "trial" ? (
                  <><Clock className="h-3 w-3 mr-1" />Free Trial</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" />Trial Expired</>
                )}
              </Badge>
            )}
            <Button onClick={() => setIsWizardOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Sub-user
            </Button>
          </div>
        </div>

        {/* Tabs for Team Members and Activity Dashboard */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Billing & Payments
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Activity Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Members</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Monitoring
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monitoring}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telecallers
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.telecaller}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    <div className="flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" /> Lead Managers
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.lead_manager}</div>
                </CardContent>
              </Card>
            </div>

            {/* Role Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(roleLabels).map(([key, value]) => (
                <Card key={key} className="relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${value.color.split(" ")[0]}`} />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {value.icon}
                      {value.label}
                    </CardTitle>
                    <CardDescription>{value.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Team Members Table */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  All your team members and their access levels. They login via Client Login using their phone number.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : subUsers && subUsers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead>First Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subUsers.map((subUser) => (
                        <TableRow key={subUser.id}>
                          <TableCell>
                            <div className="font-medium">{subUser.full_name || "—"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {subUser.phone?.replace("+91", "+91 ") || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={roleLabels[subUser.role]?.color}>
                              <span className="flex items-center gap-1">
                                {roleLabels[subUser.role]?.icon}
                                {roleLabels[subUser.role]?.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig[subUser.status]?.color}>
                              <span className="flex items-center gap-1">
                                {statusConfig[subUser.status]?.icon}
                                {statusConfig[subUser.status]?.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {subUser.invited_at ? format(new Date(subUser.invited_at), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            {subUser.activated_at
                              ? format(new Date(subUser.activated_at), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {subUser.status !== "pending" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toggleStatus.mutate({ id: subUser.id, status: subUser.status })
                                    }
                                  >
                                    {subUser.status === "active" ? (
                                      <>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(subUser);
                                    setActivityLogOpen(true);
                                  }}
                                >
                                  <Activity className="h-4 w-4 mr-2" />
                                  View Activity
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedUser(subUser);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No team members yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add team members to get started
                    </p>
                    <Button onClick={() => setIsWizardOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Sub-user
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <SeatPaymentHistory />
          </TabsContent>

          <TabsContent value="activity">
            {user && <ActivitySummaryDashboard clientId={user.id} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Sub-user Wizard */}
      <AddSubUserWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ["client-sub-users"] })}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedUser?.full_name || selectedUser?.phone} from
              your team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedUser && deleteSubUser.mutate(selectedUser)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Log Dialog */}
      {selectedUser && (
        <SubUserActivityLog
          open={activityLogOpen}
          onOpenChange={setActivityLogOpen}
          subUserId={selectedUser.id}
          subUserName={selectedUser.full_name}
        />
      )}
    </DashboardLayout>
  );
}
