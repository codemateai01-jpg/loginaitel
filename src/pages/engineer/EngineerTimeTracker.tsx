import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Play,
  Pause,
  Square,
  Coffee,
  Calendar,
  Timer,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { format, differenceInMinutes, differenceInSeconds, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface TimeEntry {
  id: string;
  engineer_id: string;
  check_in_time: string;
  check_out_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  total_break_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function EngineerTimeTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [checkOutNotes, setCheckOutNotes] = useState("");

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's active entry
  const { data: activeEntry, isLoading: loadingActive } = useQuery({
    queryKey: ["active-time-entry", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("engineer_id", user.id)
        .gte("check_in_time", today.toISOString())
        .in("status", ["active", "on_break"])
        .order("check_in_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch all time entries
  const { data: timeEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["time-entries", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("engineer_id", user.id)
        .order("check_in_time", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!user?.id,
  });

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_entries").insert({
        engineer_id: user?.id,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast({ title: "Checked In!", description: "Your work session has started." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to check in.", variant: "destructive" });
    },
  });

  // Start break mutation
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) throw new Error("No active entry");
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "on_break",
          break_start_time: new Date().toISOString(),
        })
        .eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      toast({ title: "Break Started", description: "Enjoy your break!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start break.", variant: "destructive" });
    },
  });

  // End break mutation
  const endBreakMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry || !activeEntry.break_start_time) throw new Error("No active break");
      const breakMinutes = differenceInMinutes(new Date(), new Date(activeEntry.break_start_time));
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "active",
          break_end_time: new Date().toISOString(),
          total_break_minutes: (activeEntry.total_break_minutes || 0) + breakMinutes,
        })
        .eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      toast({ title: "Break Ended", description: "Welcome back!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to end break.", variant: "destructive" });
    },
  });

  // Check out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!activeEntry) throw new Error("No active entry");
      let totalBreak = activeEntry.total_break_minutes || 0;
      
      // If currently on break, add remaining break time
      if (activeEntry.status === "on_break" && activeEntry.break_start_time) {
        totalBreak += differenceInMinutes(new Date(), new Date(activeEntry.break_start_time));
      }

      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "completed",
          check_out_time: new Date().toISOString(),
          total_break_minutes: totalBreak,
          notes: notes || null,
        })
        .eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      setShowCheckOutDialog(false);
      setCheckOutNotes("");
      toast({ title: "Checked Out!", description: "Great work today!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to check out.", variant: "destructive" });
    },
  });

  // Calculate working time
  const getWorkingTime = () => {
    if (!activeEntry) return { hours: 0, minutes: 0, seconds: 0 };
    
    const checkIn = new Date(activeEntry.check_in_time);
    const now = currentTime;
    let totalSeconds = differenceInSeconds(now, checkIn);
    
    // Subtract break time
    let breakSeconds = (activeEntry.total_break_minutes || 0) * 60;
    if (activeEntry.status === "on_break" && activeEntry.break_start_time) {
      breakSeconds += differenceInSeconds(now, new Date(activeEntry.break_start_time));
    }
    
    totalSeconds -= breakSeconds;
    if (totalSeconds < 0) totalSeconds = 0;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds };
  };

  // Calculate stats
  const calculateStats = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let todayMinutes = 0;
    let weekMinutes = 0;
    let monthMinutes = 0;

    timeEntries.forEach((entry) => {
      const checkIn = new Date(entry.check_in_time);
      const checkOut = entry.check_out_time ? new Date(entry.check_out_time) : now;
      let workMinutes = differenceInMinutes(checkOut, checkIn) - (entry.total_break_minutes || 0);
      if (workMinutes < 0) workMinutes = 0;

      // Today
      if (checkIn.toDateString() === now.toDateString()) {
        todayMinutes += workMinutes;
      }

      // This week
      if (checkIn >= weekStart && checkIn <= weekEnd) {
        weekMinutes += workMinutes;
      }

      // This month
      if (checkIn >= monthStart && checkIn <= monthEnd) {
        monthMinutes += workMinutes;
      }
    });

    return {
      today: `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`,
      week: `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m`,
      month: `${Math.floor(monthMinutes / 60)}h ${monthMinutes % 60}m`,
    };
  };

  const workingTime = getWorkingTime();
  const stats = calculateStats();
  const isOnBreak = activeEntry?.status === "on_break";
  const isWorking = !!activeEntry && !isOnBreak;

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Time Tracker</h1>
          <p className="text-muted-foreground">
            Track your working hours and breaks
          </p>
        </div>

        {/* Current Session */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Timer Display */}
            <div className="flex items-center gap-6">
              <div className={`p-4 border-2 ${activeEntry ? (isOnBreak ? "border-chart-4 bg-chart-4/10" : "border-chart-2 bg-chart-2/10") : "border-border"}`}>
                <Clock className={`h-12 w-12 ${activeEntry ? (isOnBreak ? "text-chart-4" : "text-chart-2") : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {activeEntry ? (isOnBreak ? "On Break" : "Working") : "Not Checked In"}
                </p>
                <p className="text-4xl font-mono font-bold">
                  {String(workingTime.hours).padStart(2, "0")}:
                  {String(workingTime.minutes).padStart(2, "0")}:
                  {String(workingTime.seconds).padStart(2, "0")}
                </p>
                {activeEntry && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Checked in at {format(new Date(activeEntry.check_in_time), "h:mm a")}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!activeEntry ? (
                <Button
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkInMutation.isPending}
                  className="gap-2"
                  size="lg"
                >
                  {checkInMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  Check In
                </Button>
              ) : (
                <>
                  {isOnBreak ? (
                    <Button
                      onClick={() => endBreakMutation.mutate()}
                      disabled={endBreakMutation.isPending}
                      variant="outline"
                      className="gap-2"
                      size="lg"
                    >
                      {endBreakMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                      End Break
                    </Button>
                  ) : (
                    <Button
                      onClick={() => startBreakMutation.mutate()}
                      disabled={startBreakMutation.isPending}
                      variant="outline"
                      className="gap-2"
                      size="lg"
                    >
                      {startBreakMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Coffee className="h-5 w-5" />
                      )}
                      Start Break
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowCheckOutDialog(true)}
                    variant="destructive"
                    className="gap-2"
                    size="lg"
                  >
                    <Square className="h-5 w-5" />
                    Check Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Timer className="h-4 w-4" />
              <span className="text-sm">Today</span>
            </div>
            <p className="text-2xl font-bold">{stats.today}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">This Week</span>
            </div>
            <p className="text-2xl font-bold">{stats.week}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">This Month</span>
            </div>
            <p className="text-2xl font-bold">{stats.month}</p>
          </div>
        </div>

        {/* History */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border">
            <h2 className="font-bold">Recent Time Entries</h2>
          </div>
          {loadingEntries ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold mb-2">No Time Entries</p>
              <p className="text-sm text-muted-foreground">
                Check in to start tracking your time.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Check In</TableHead>
                  <TableHead className="font-bold">Check Out</TableHead>
                  <TableHead className="font-bold">Break</TableHead>
                  <TableHead className="font-bold">Total Work</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => {
                  const checkIn = new Date(entry.check_in_time);
                  const checkOut = entry.check_out_time ? new Date(entry.check_out_time) : null;
                  const totalMinutes = checkOut
                    ? differenceInMinutes(checkOut, checkIn) - (entry.total_break_minutes || 0)
                    : 0;
                  
                  return (
                    <TableRow key={entry.id} className="border-b-2 border-border">
                      <TableCell className="font-medium">
                        {format(checkIn, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{format(checkIn, "h:mm a")}</TableCell>
                      <TableCell>
                        {checkOut ? format(checkOut, "h:mm a") : "—"}
                      </TableCell>
                      <TableCell>{entry.total_break_minutes || 0}m</TableCell>
                      <TableCell className="font-mono">
                        {checkOut
                          ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.status === "completed"
                              ? "border-chart-2 text-chart-2"
                              : entry.status === "on_break"
                              ? "border-chart-4 text-chart-4"
                              : "border-chart-3 text-chart-3"
                          }
                        >
                          {entry.status === "completed"
                            ? "Completed"
                            : entry.status === "on_break"
                            ? "On Break"
                            : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Check Out Dialog */}
        <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
          <DialogContent className="border-2">
            <DialogHeader>
              <DialogTitle>Check Out</DialogTitle>
              <DialogDescription>
                Add any notes about your work session (optional)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="What did you work on today?"
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
                rows={4}
                className="border-2"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCheckOutDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => checkOutMutation.mutate(checkOutNotes)}
                disabled={checkOutMutation.isPending}
              >
                {checkOutMutation.isPending ? "Checking Out..." : "Check Out"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
