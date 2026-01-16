import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Phone, 
  Headphones, 
  ClipboardList, 
  Eye,
  MoreHorizontal,
  Send,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  RefreshCw
} from "lucide-react";
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

interface SubUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "monitoring" | "telecaller" | "lead_manager";
  status: string;
  invited_at: string;
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
    label: "Invite Pending", 
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubUser | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "telecaller" as "monitoring" | "telecaller" | "lead_manager",
  });

  // Fetch client profile for name
  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
      return data as SubUser[];
    },
    enabled: !!user,
  });

  // Add sub-user mutation
  const addSubUser = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create sub-user record
      const { data: subUser, error } = await supabase
        .from("client_sub_users")
        .insert({
          client_id: user!.id,
          email: data.email,
          full_name: data.full_name || null,
          role: data.role,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Send invite email
      const { data: result, error: inviteError } = await supabase.functions.invoke(
        "send-subuser-invite",
        {
          body: {
            subUserId: subUser.id,
            email: data.email,
            fullName: data.full_name,
            role: data.role,
            clientName: clientProfile?.full_name || clientProfile?.email || "Your organization",
          },
        }
      );

      if (inviteError) throw inviteError;

      return { subUser, inviteResult: result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-sub-users"] });
      setIsAddDialogOpen(false);
      setFormData({ email: "", full_name: "", role: "telecaller" });
      toast({
        title: "Team member invited",
        description: `Invitation sent to ${data.subUser.email}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to invite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend invite mutation
  const resendInvite = useMutation({
    mutationFn: async (subUser: SubUser) => {
      const { data, error } = await supabase.functions.invoke("send-subuser-invite", {
        body: {
          subUserId: subUser.id,
          email: subUser.email,
          fullName: subUser.full_name,
          role: subUser.role,
          clientName: clientProfile?.full_name || clientProfile?.email || "Your organization",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, subUser) => {
      toast({
        title: "Invite resent",
        description: `New invitation sent to ${subUser.email}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend",
        description: error.message,
        variant: "destructive",
      });
    },
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

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Team Management
            </h1>
            <p className="text-muted-foreground">
              Manage your sub-users - monitoring team, telecallers, and lead managers
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your team. They'll receive an email to set up their account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="member@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "monitoring" | "telecaller" | "lead_manager") =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {value.icon}
                            <span>{value.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {roleLabels[formData.role]?.description}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => addSubUser.mutate(formData)}
                  disabled={!formData.email || addSubUser.isPending}
                >
                  {addSubUser.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

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
              All your team members and their access levels
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
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subUsers.map((subUser) => (
                    <TableRow key={subUser.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{subUser.full_name || "—"}</div>
                          <div className="text-sm text-muted-foreground">{subUser.email}</div>
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
                        {format(new Date(subUser.invited_at), "MMM d, yyyy")}
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
                            {subUser.status === "pending" && (
                              <DropdownMenuItem
                                onClick={() => resendInvite.mutate(subUser)}
                                disabled={resendInvite.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                            )}
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
                  Invite your first team member to get started
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Team Member
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedUser?.full_name || selectedUser?.email} from
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
    </DashboardLayout>
  );
}
