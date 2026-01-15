import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  Users, 
  Phone, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface DashboardStats {
  totalProjects: number;
  totalLeads: number;
  leadsToday: number;
  callsToday: number;
  siteVisitsScheduled: number;
  leadsInterested: number;
  leadsClosed: number;
  leadsLost: number;
}

interface RecentActivity {
  id: string;
  type: 'call' | 'visit' | 'stage_change';
  leadName: string;
  description: string;
  timestamp: string;
}

export default function RealEstateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalLeads: 0,
    leadsToday: 0,
    callsToday: 0,
    siteVisitsScheduled: 0,
    leadsInterested: 0,
    leadsClosed: 0,
    leadsLost: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch projects count
      const { count: projectsCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id);

      // Fetch leads stats
      const { data: leads } = await supabase
        .from("real_estate_leads")
        .select("stage, created_at")
        .eq("client_id", user.id);

      const leadsToday = leads?.filter(l => new Date(l.created_at) >= today).length || 0;
      const leadsInterested = leads?.filter(l => l.stage === 'interested').length || 0;
      const leadsClosed = leads?.filter(l => l.stage === 'closed').length || 0;
      const leadsLost = leads?.filter(l => l.stage === 'lost').length || 0;

      // Fetch site visits count
      const { count: visitsCount } = await supabase
        .from("site_visits")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .gte("scheduled_at", new Date().toISOString())
        .eq("outcome", "pending");

      // Fetch calls today count
      const { count: callsCount } = await supabase
        .from("real_estate_calls")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .gte("created_at", today.toISOString());

      setStats({
        totalProjects: projectsCount || 0,
        totalLeads: leads?.length || 0,
        leadsToday,
        callsToday: callsCount || 0,
        siteVisitsScheduled: visitsCount || 0,
        leadsInterested,
        leadsClosed,
        leadsLost,
      });

      // Fetch recent leads
      const { data: recentLeadsData } = await supabase
        .from("real_estate_leads")
        .select("*, projects(name)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentLeads(recentLeadsData || []);

      // Fetch upcoming visits
      const { data: visitsData } = await supabase
        .from("site_visits")
        .select("*, real_estate_leads(name, phone_number), projects(name), sales_executives(name)")
        .eq("client_id", user.id)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      setUpcomingVisits(visitsData || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stageColors: Record<string, string> = {
    new: "bg-gray-500",
    contacted: "bg-blue-500",
    interested: "bg-green-500",
    site_visit_done: "bg-purple-500",
    negotiation: "bg-orange-500",
    token_paid: "bg-yellow-500",
    closed: "bg-emerald-600",
    lost: "bg-red-500",
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Real Estate CRM</h1>
            <p className="text-muted-foreground">Manage your property leads and sales</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/client/re/projects/new")}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
            <Button variant="outline" onClick={() => navigate("/client/re/leads")}>
              <Users className="h-4 w-4 mr-2" />
              View Leads
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalProjects}</p>
                  <p className="text-xs text-muted-foreground">Active Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalLeads}</p>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.leadsInterested}</p>
                  <p className="text-xs text-muted-foreground">Interested</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.siteVisitsScheduled}</p>
                  <p className="text-xs text-muted-foreground">Visits Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Phone className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.callsToday}</p>
                  <p className="text-xs text-muted-foreground">Calls Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.leadsToday}</p>
                  <p className="text-xs text-muted-foreground">New Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.leadsClosed}</p>
                  <p className="text-xs text-muted-foreground">Closed Won</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.leadsLost}</p>
                  <p className="text-xs text-muted-foreground">Lost</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Leads</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/client/re/leads")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : recentLeads.length === 0 ? (
                <p className="text-muted-foreground text-sm">No leads yet</p>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{lead.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.projects?.name || "No project"} • {lead.source || "Unknown source"}
                        </p>
                      </div>
                      <Badge className={stageColors[lead.stage] || "bg-gray-500"}>
                        {lead.stage?.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Site Visits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Upcoming Site Visits</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/client/re/visits")}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : upcomingVisits.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming visits</p>
              ) : (
                <div className="space-y-3">
                  {upcomingVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{visit.real_estate_leads?.name || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {visit.projects?.name} • {visit.sales_executives?.name || "Unassigned"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(visit.scheduled_at), "MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(visit.scheduled_at), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lead Pipeline Quick View */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Lead Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["new", "contacted", "interested", "site_visit_done", "negotiation", "token_paid", "closed", "lost"].map((stage) => {
                const count = recentLeads.filter(l => l.stage === stage).length;
                return (
                  <div
                    key={stage}
                    className="flex-1 min-w-[100px] p-3 border rounded-lg text-center cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate(`/client/re/leads?stage=${stage}`)}
                  >
                    <Badge className={`${stageColors[stage]} mb-2`}>
                      {stage.replace("_", " ")}
                    </Badge>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
