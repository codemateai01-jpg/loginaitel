import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  ClipboardList, 
  Users,
  Phone,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Target
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  interest_level: string | null;
  stage: string;
  call_summary: string | null;
  campaign_id: string;
  campaign: { name: string };
  assignment?: {
    id: string;
    assigned_to: string | null;
    status: string;
    telecaller?: { id: string; full_name: string | null; email: string };
  };
}

interface Telecaller {
  id: string;
  full_name: string | null;
  email: string;
  status: string;
  assigned_count?: number;
}

export default function LeadManagerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedTelecaller, setSelectedTelecaller] = useState<string>("");

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

  // Fetch interested leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["lead-manager-leads", subUserInfo?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_leads")
        .select(`
          *,
          campaign:campaigns!campaign_id(name)
        `)
        .eq("client_id", subUserInfo!.client_id)
        .eq("interest_level", "interested")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;

      // Fetch assignments for these leads
      const leadIds = data.map((l: any) => l.id);
      const { data: assignments } = await supabase
        .from("lead_assignments")
        .select(`
          id, lead_id, assigned_to, status,
          telecaller:client_sub_users!assigned_to(id, full_name, email)
        `)
        .in("lead_id", leadIds);

      // Merge assignments with leads
      return data.map((lead: any) => ({
        ...lead,
        assignment: assignments?.find((a: any) => a.lead_id === lead.id),
      })) as Lead[];
    },
    enabled: !!subUserInfo?.client_id,
  });

  // Fetch telecallers
  const { data: telecallers } = useQuery({
    queryKey: ["telecallers", subUserInfo?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("id, full_name, email, status")
        .eq("client_id", subUserInfo!.client_id)
        .eq("role", "telecaller")
        .eq("status", "active");
      
      if (error) throw error;

      // Get assignment counts
      const { data: counts } = await supabase
        .from("lead_assignments")
        .select("assigned_to")
        .eq("client_id", subUserInfo!.client_id)
        .neq("status", "completed");

      const countMap: Record<string, number> = {};
      counts?.forEach((c: any) => {
        countMap[c.assigned_to] = (countMap[c.assigned_to] || 0) + 1;
      });

      return data.map((t: any) => ({
        ...t,
        assigned_count: countMap[t.id] || 0,
      })) as Telecaller[];
    },
    enabled: !!subUserInfo?.client_id,
  });

  // Assign lead mutation
  const assignLead = useMutation({
    mutationFn: async ({ leadId, telecallerId, campaignId }: { leadId: string; telecallerId: string; campaignId: string }) => {
      const { error } = await supabase
        .from("lead_assignments")
        .upsert({
          lead_id: leadId,
          campaign_id: campaignId,
          client_id: subUserInfo!.client_id,
          assigned_to: telecallerId,
          assigned_by: subUserInfo!.id,
          assignment_type: "manual",
          status: "assigned",
        }, { onConflict: "lead_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-manager-leads"] });
      queryClient.invalidateQueries({ queryKey: ["telecallers"] });
      setAssignDialogOpen(false);
      setSelectedLead(null);
      setSelectedTelecaller("");
      toast({
        title: "Lead assigned",
        description: "The lead has been assigned to the telecaller",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openAssignDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setSelectedTelecaller(lead.assignment?.assigned_to || "");
    setAssignDialogOpen(true);
  };

  const unassignedLeads = leads?.filter((l) => !l.assignment?.assigned_to) || [];
  const assignedLeads = leads?.filter((l) => l.assignment?.assigned_to) || [];

  if (!subUserInfo || subUserInfo.role !== "lead_manager") {
    return (
      <DashboardLayout role="client">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md text-center p-6">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This dashboard is only available for lead manager team members.
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
            <ClipboardList className="h-6 w-6" />
            Lead Manager Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage lead assignments and monitor telecaller workload
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Interested</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unassigned</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{unassignedLeads.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{assignedLeads.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Telecallers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{telecallers?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Telecaller Workload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Telecaller Workload
            </CardTitle>
            <CardDescription>
              Current lead distribution across telecallers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {telecallers && telecallers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-3">
                {telecallers.map((telecaller) => (
                  <Card key={telecaller.id} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {telecaller.full_name || telecaller.email}
                            </p>
                            <p className="text-xs text-muted-foreground">{telecaller.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{telecaller.assigned_count}</p>
                          <p className="text-xs text-muted-foreground">leads</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active telecallers available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Tabs */}
        <Tabs defaultValue="unassigned">
          <TabsList>
            <TabsTrigger value="unassigned">
              Unassigned ({unassignedLeads.length})
            </TabsTrigger>
            <TabsTrigger value="assigned">
              Assigned ({assignedLeads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unassigned">
            <Card>
              <CardHeader>
                <CardTitle>Unassigned Leads</CardTitle>
                <CardDescription>
                  Interested leads waiting to be assigned to telecallers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : unassignedLeads.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>AI Summary</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unassignedLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lead.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {lead.phone_number}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{lead.campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.stage}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm text-muted-foreground truncate">
                              {lead.call_summary || "No summary"}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => openAssignDialog(lead)}>
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">All leads are assigned!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assigned">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Leads</CardTitle>
                <CardDescription>
                  Leads currently being handled by telecallers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : assignedLeads.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lead.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {lead.phone_number}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{lead.campaign.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {lead.assignment?.telecaller?.full_name || 
                               lead.assignment?.telecaller?.email || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {lead.assignment?.status || "assigned"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDialog(lead)}
                            >
                              Reassign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No assigned leads yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
            <DialogDescription>
              Select a telecaller to assign {selectedLead?.name} to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium">{selectedLead?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedLead?.phone_number}</p>
              <p className="text-sm mt-2">{selectedLead?.call_summary || "No summary available"}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Telecaller</label>
              <Select value={selectedTelecaller} onValueChange={setSelectedTelecaller}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a telecaller" />
                </SelectTrigger>
                <SelectContent>
                  {telecallers?.map((telecaller) => (
                    <SelectItem key={telecaller.id} value={telecaller.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{telecaller.full_name || telecaller.email}</span>
                        <Badge variant="outline" className="ml-2">
                          {telecaller.assigned_count} leads
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedLead &&
                selectedTelecaller &&
                assignLead.mutate({
                  leadId: selectedLead.id,
                  telecallerId: selectedTelecaller,
                  campaignId: selectedLead.campaign_id,
                })
              }
              disabled={!selectedTelecaller || assignLead.isPending}
            >
              {assignLead.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Lead"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
