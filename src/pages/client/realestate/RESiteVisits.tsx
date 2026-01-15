import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar as CalendarIcon, 
  User, 
  MapPin,
  Phone,
  CheckCircle,
  Clock,
  Filter
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";

type VisitOutcome = 'pending' | 'liked' | 'budget_mismatch' | 'location_issue' | 'postponed';

interface SiteVisit {
  id: string;
  scheduled_at: string;
  outcome: VisitOutcome;
  outcome_notes: string | null;
  visited_at: string | null;
  real_estate_leads: {
    id: string;
    name: string | null;
    phone_number: string;
  } | null;
  projects: {
    name: string;
  } | null;
  sales_executives: {
    name: string;
  } | null;
}

const outcomeConfig: Record<VisitOutcome, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-gray-500", icon: Clock },
  liked: { label: "Liked", color: "bg-green-500", icon: CheckCircle },
  budget_mismatch: { label: "Budget Issue", color: "bg-orange-500", icon: null },
  location_issue: { label: "Location Issue", color: "bg-yellow-500", icon: MapPin },
  postponed: { label: "Postponed", color: "bg-blue-500", icon: CalendarIcon },
};

export default function RESiteVisits() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("upcoming");
  
  // Outcome dialog
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [outcomeData, setOutcomeData] = useState({
    outcome: "" as VisitOutcome | "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from("site_visits")
        .select("*, real_estate_leads(id, name, phone_number), projects(name), sales_executives(name)")
        .eq("client_id", user.id)
        .order("scheduled_at", { ascending: true });

      if (outcomeFilter !== "all") {
        query = query.eq("outcome", outcomeFilter as any);
      }

      if (timeFilter === "upcoming") {
        query = query.gte("scheduled_at", new Date().toISOString());
      } else if (timeFilter === "past") {
        query = query.lt("scheduled_at", new Date().toISOString());
      } else if (timeFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = query.gte("scheduled_at", today.toISOString()).lt("scheduled_at", tomorrow.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error("Error fetching visits:", error);
      toast({
        title: "Error",
        description: "Failed to fetch site visits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, outcomeFilter, timeFilter, toast]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const handleUpdateOutcome = async () => {
    if (!selectedVisit || !outcomeData.outcome) {
      toast({
        title: "Error",
        description: "Please select an outcome",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Update site visit
      const { error: visitError } = await supabase
        .from("site_visits")
        .update({
          outcome: outcomeData.outcome,
          outcome_notes: outcomeData.notes || null,
          visited_at: outcomeData.outcome !== "pending" && outcomeData.outcome !== "postponed" 
            ? new Date().toISOString() 
            : null,
        })
        .eq("id", selectedVisit.id);

      if (visitError) throw visitError;

      // Update lead stage if visit happened
      if (selectedVisit.real_estate_leads && outcomeData.outcome !== "pending" && outcomeData.outcome !== "postponed") {
        const { error: leadError } = await supabase
          .from("real_estate_leads")
          .update({ stage: "site_visit_done" })
          .eq("id", selectedVisit.real_estate_leads.id);

        if (leadError) console.error("Error updating lead stage:", leadError);
      }

      toast({
        title: "Success",
        description: "Visit outcome updated",
      });

      setOutcomeDialogOpen(false);
      setSelectedVisit(null);
      setOutcomeData({ outcome: "", notes: "" });
      fetchVisits();
    } catch (error) {
      console.error("Error updating outcome:", error);
      toast({
        title: "Error",
        description: "Failed to update outcome",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openOutcomeDialog = (visit: SiteVisit) => {
    setSelectedVisit(visit);
    setOutcomeData({
      outcome: visit.outcome,
      notes: visit.outcome_notes || "",
    });
    setOutcomeDialogOpen(true);
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isPast(date)) return "Overdue";
    return format(date, "MMM d");
  };

  const getDateColor = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isPast(date) && !isToday(date)) return "text-destructive";
    if (isToday(date)) return "text-green-600";
    return "text-muted-foreground";
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Site Visits</h1>
            <p className="text-muted-foreground">
              Manage scheduled property visits
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>

              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  {Object.entries(outcomeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Visits Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Executive</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : visits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No site visits found
                    </TableCell>
                  </TableRow>
                ) : (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${getDateColor(visit.scheduled_at)}`}>
                            {getDateLabel(visit.scheduled_at)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(visit.scheduled_at), "h:mm a")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {visit.real_estate_leads?.name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {visit.real_estate_leads?.phone_number}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {visit.projects?.name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {visit.sales_executives?.name || "Unassigned"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={outcomeConfig[visit.outcome].color}>
                          {outcomeConfig[visit.outcome].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOutcomeDialog(visit)}
                        >
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Dialog */}
      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Visit Outcome</DialogTitle>
            <DialogDescription>
              Record the outcome of the site visit for{" "}
              {selectedVisit?.real_estate_leads?.name || "this lead"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Outcome</Label>
              <Select
                value={outcomeData.outcome}
                onValueChange={(value) => setOutcomeData(prev => ({ ...prev, outcome: value as VisitOutcome }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(outcomeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={outcomeData.notes}
                onChange={(e) => setOutcomeData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about the visit..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOutcome} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
