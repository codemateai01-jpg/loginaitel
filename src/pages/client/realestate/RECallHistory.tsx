import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Phone, 
  Clock,
  Play,
  FileText,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

type CallDisposition = 'answered' | 'not_answered' | 'busy' | 'voicemail' | 'wrong_number' | 'callback_requested';

interface RECall {
  id: string;
  created_at: string;
  disposition: CallDisposition | null;
  ai_summary: string | null;
  objections_detected: string[] | null;
  interest_score: number | null;
  notes: string | null;
  real_estate_leads: {
    name: string | null;
    phone_number: string;
    stage: string;
  } | null;
  calls: {
    duration_seconds: number | null;
    recording_url: string | null;
    status: string;
    transcript: string | null;
  } | null;
}

const dispositionConfig: Record<CallDisposition, { label: string; color: string }> = {
  answered: { label: "Answered", color: "bg-green-500" },
  not_answered: { label: "Not Answered", color: "bg-gray-500" },
  busy: { label: "Busy", color: "bg-yellow-500" },
  voicemail: { label: "Voicemail", color: "bg-blue-500" },
  wrong_number: { label: "Wrong Number", color: "bg-red-500" },
  callback_requested: { label: "Callback", color: "bg-purple-500" },
};

export default function RECallHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [calls, setCalls] = useState<RECall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<string>("all");
  
  // Details dialog
  const [selectedCall, setSelectedCall] = useState<RECall | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from("real_estate_calls")
        .select("*, real_estate_leads(name, phone_number, stage), calls(duration_seconds, recording_url, status, transcript)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (dispositionFilter !== "all") {
        query = query.eq("disposition", dispositionFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search if needed
      let filteredData = data || [];
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        filteredData = filteredData.filter(call => 
          call.real_estate_leads?.name?.toLowerCase().includes(lowerSearch) ||
          call.real_estate_leads?.phone_number.includes(searchQuery)
        );
      }

      setCalls(filteredData);
    } catch (error) {
      console.error("Error fetching calls:", error);
      toast({
        title: "Error",
        description: "Failed to fetch call history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, dispositionFilter, searchQuery, toast]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleViewDetails = (call: RECall) => {
    setSelectedCall(call);
    setDetailsOpen(true);
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Call History</h1>
            <p className="text-muted-foreground">
              View AI call summaries and recordings
            </p>
          </div>
          <Button variant="outline" onClick={fetchCalls}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={dispositionFilter} onValueChange={setDispositionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Disposition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dispositions</SelectItem>
                  {Object.entries(dispositionConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Calls Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : calls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No call history found
                    </TableCell>
                  </TableRow>
                ) : (
                  calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(call.created_at), "MMM d, h:mm a")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {call.real_estate_leads?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {call.real_estate_leads?.phone_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatDuration(call.calls?.duration_seconds || null)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.disposition ? (
                          <Badge className={dispositionConfig[call.disposition].color}>
                            {dispositionConfig[call.disposition].label}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {call.interest_score !== null ? (
                          <Badge variant={call.interest_score >= 70 ? "default" : call.interest_score >= 40 ? "secondary" : "outline"}>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {call.interest_score}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                          {call.ai_summary || "No summary available"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(call)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {call.calls?.recording_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(call.calls!.recording_url!, "_blank")}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Call Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6">
              {/* Lead Info */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-lg">
                    {selectedCall.real_estate_leads?.name || "Unknown"}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedCall.real_estate_leads?.phone_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedCall.created_at), "PPP 'at' p")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(selectedCall.calls?.duration_seconds || null)}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Disposition</p>
                  {selectedCall.disposition ? (
                    <Badge className={dispositionConfig[selectedCall.disposition].color}>
                      {dispositionConfig[selectedCall.disposition].label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Interest Score</p>
                  {selectedCall.interest_score !== null ? (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">{selectedCall.interest_score}%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not analyzed</span>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">AI Summary</p>
                <p className="text-sm">
                  {selectedCall.ai_summary || "No summary available for this call."}
                </p>
              </div>

              {/* Objections */}
              {selectedCall.objections_detected && selectedCall.objections_detected.length > 0 && (
                <div className="p-4 border rounded-lg border-orange-200 bg-orange-50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-800">Objections Detected</p>
                  </div>
                  <ul className="space-y-1">
                    {selectedCall.objections_detected.map((objection, i) => (
                      <li key={i} className="text-sm text-orange-700">• {objection}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recording */}
              {selectedCall.calls?.recording_url && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Recording</p>
                  <audio controls className="w-full">
                    <source src={selectedCall.calls.recording_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.calls?.transcript && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Transcript</p>
                  <div className="max-h-60 overflow-y-auto text-sm whitespace-pre-wrap">
                    {selectedCall.calls.transcript}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCall.notes && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm">{selectedCall.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
