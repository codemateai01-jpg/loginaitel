import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ClickToCallButton } from "@/components/telecaller/ClickToCallButton";
import { 
  PhoneCall,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  RefreshCw
} from "lucide-react";

interface AssignedLead {
  id: string;
  lead_id: string;
  campaign_id: string;
  status: string;
  priority: number;
  notes: string | null;
  follow_up_at: string | null;
  created_at: string;
  lead: {
    id: string;
    name: string;
    phone_number: string;
    email: string | null;
    interest_level: string | null;
    call_summary: string | null;
    call_sentiment: string | null;
    stage: string;
    notes: string | null;
  };
  campaign: {
    id: string;
    name: string;
    agent_id: string | null;
  };
}

const statusColors: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  transferred: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const stageOptions = [
  { value: "contacted", label: "Contacted" },
  { value: "follow_up_scheduled", label: "Follow-up Scheduled" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiating", label: "Negotiating" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

export default function TelecallerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<AssignedLead | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: "",
    stage: "",
    notes: "",
    follow_up_at: "",
  });

  // Get sub-user info
  const { data: subUserInfo } = useQuery({
    queryKey: ["sub-user-info", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("id, role, client_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch assigned leads
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["telecaller-assignments", subUserInfo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_assignments")
        .select(`
          *,
          lead:campaign_leads!lead_id(
            id, name, phone_number, email, interest_level, 
            call_summary, call_sentiment, stage, notes
          ),
          campaign:campaigns!campaign_id(id, name, agent_id)
        `)
        .eq("assigned_to", subUserInfo!.id)
        .neq("status", "completed")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as unknown as AssignedLead[];
    },
    enabled: !!subUserInfo?.id,
  });

  // Update lead mutation
  const updateLead = useMutation({
    mutationFn: async ({
      assignmentId,
      leadId,
      data,
    }: {
      assignmentId: string;
      leadId: string;
      data: typeof updateData;
    }) => {
      // Update assignment status
      if (data.status) {
        await supabase
          .from("lead_assignments")
          .update({
            status: data.status,
            notes: data.notes || null,
            follow_up_at: data.follow_up_at || null,
            last_action_at: new Date().toISOString(),
          })
          .eq("id", assignmentId);
      }

      // Update lead stage
      if (data.stage) {
        await supabase
          .from("campaign_leads")
          .update({
            stage: data.stage,
            notes: data.notes || null,
          })
          .eq("id", leadId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telecaller-assignments"] });
      setUpdateDialogOpen(false);
      setSelectedLead(null);
      setUpdateData({ status: "", stage: "", notes: "", follow_up_at: "" });
      toast({
        title: "Lead updated",
        description: "The lead has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCallLead = async (lead: AssignedLead) => {
    // Open phone dialer
    window.open(`tel:${lead.lead.phone_number}`, "_self");
    
    // Mark as in progress
    await supabase
      .from("lead_assignments")
      .update({ status: "in_progress", last_action_at: new Date().toISOString() })
      .eq("id", lead.id);
    
    queryClient.invalidateQueries({ queryKey: ["telecaller-assignments"] });
  };

  const openUpdateDialog = (lead: AssignedLead) => {
    setSelectedLead(lead);
    setUpdateData({
      status: lead.status,
      stage: lead.lead.stage,
      notes: lead.notes || lead.lead.notes || "",
      follow_up_at: lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : "",
    });
    setUpdateDialogOpen(true);
  };

  const stats = {
    total: assignments?.length || 0,
    new: assignments?.filter((a) => a.status === "assigned").length || 0,
    inProgress: assignments?.filter((a) => a.status === "in_progress").length || 0,
    followUp: assignments?.filter((a) => a.follow_up_at && new Date(a.follow_up_at) <= new Date()).length || 0,
  };

  if (!subUserInfo || subUserInfo.role !== "telecaller") {
    return (
      <DashboardLayout role="client">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md text-center p-6">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This dashboard is only available for telecaller team members.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PhoneCall className="h-6 w-6" />
            Telecaller Dashboard
          </h1>
          <p className="text-muted-foreground">
            Follow up on your assigned interested leads
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned Leads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New (To Call)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Follow-up Due</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.followUp}</div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Assigned Leads</CardTitle>
            <CardDescription>
              Leads that have shown interest and need follow-up calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : assignments && assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Summary</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{assignment.lead.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.lead.phone_number}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{assignment.campaign.name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[assignment.status]}>
                          {assignment.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {assignment.lead.call_summary || "No summary available"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {assignment.follow_up_at ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(assignment.follow_up_at), "MMM d, h:mm a")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ClickToCallButton
                            phoneNumber={assignment.lead.phone_number}
                            leadId={assignment.lead.id}
                            leadName={assignment.lead.name}
                            assignmentId={assignment.id}
                            subUserId={subUserInfo!.id}
                            clientId={subUserInfo!.client_id}
                            onCallStarted={() => {
                              queryClient.invalidateQueries({ queryKey: ["telecaller-assignments"] });
                            }}
                            onCallEnded={() => {
                              queryClient.invalidateQueries({ queryKey: ["telecaller-assignments"] });
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUpdateDialog(assignment)}
                          >
                            Update
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground">
                  No leads assigned to you at the moment. New interested leads will appear here automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead: {selectedLead?.lead.name}</DialogTitle>
            <DialogDescription>
              Update the status and add notes for this lead
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={updateData.status}
                onValueChange={(value) => setUpdateData({ ...updateData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pipeline Stage</label>
              <Select
                value={updateData.stage}
                onValueChange={(value) => setUpdateData({ ...updateData, stage: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule Follow-up</label>
              <Input
                type="datetime-local"
                value={updateData.follow_up_at}
                onChange={(e) => setUpdateData({ ...updateData, follow_up_at: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Add notes about the conversation..."
                value={updateData.notes}
                onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedLead &&
                updateLead.mutate({
                  assignmentId: selectedLead.id,
                  leadId: selectedLead.lead.id,
                  data: updateData,
                })
              }
              disabled={updateLead.isPending}
            >
              {updateLead.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
