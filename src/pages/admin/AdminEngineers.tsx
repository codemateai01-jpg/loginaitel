import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEngineersWithStats, type EngineerWithStats } from "@/lib/secure-proxy";
import {
  Search,
  UserPlus,
  MoreVertical,
  Users,
  Trophy,
  ClipboardList,
  Clock,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function AdminEngineers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEngineer, setNewEngineer] = useState({
    email: "",
    full_name: "",
    phone: "",
    password: "",
  });

  // Fetch engineers with stats via secure proxy (masked data)
  const { data: engineers = [], isLoading } = useQuery({
    queryKey: ["admin-engineers-secure"],
    queryFn: fetchEngineersWithStats,
  });

  // Add engineer mutation
  const addEngineerMutation = useMutation({
    mutationFn: async (engineerData: typeof newEngineer) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: engineerData.email,
          password: engineerData.password,
          full_name: engineerData.full_name || null,
          phone: engineerData.phone || null,
          role: "engineer",
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Engineer Created", description: "New engineer account has been created." });
      setIsAddDialogOpen(false);
      setNewEngineer({ email: "", full_name: "", phone: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-engineers"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredEngineers = engineers.filter((engineer) =>
    engineer.display_email.toLowerCase().includes(search.toLowerCase()) ||
    engineer.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = engineers.reduce((sum, e) => sum + e.total_points, 0);
  const totalTasksCompleted = engineers.reduce((sum, e) => sum + e.tasks_completed, 0);
  const totalHours = engineers.reduce((sum, e) => sum + e.hours_this_month, 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Prompt Engineers</h1>
            <p className="text-muted-foreground">
              Manage engineer accounts and track their performance
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Engineer
              </Button>
            </DialogTrigger>
            <DialogContent className="border-2">
              <DialogHeader>
                <DialogTitle>Add New Engineer</DialogTitle>
                <DialogDescription>Create a new prompt engineer account</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addEngineerMutation.mutate(newEngineer);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    value={newEngineer.email}
                    onChange={(e) => setNewEngineer({ ...newEngineer, email: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={newEngineer.full_name}
                    onChange={(e) => setNewEngineer({ ...newEngineer, full_name: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    required
                    value={newEngineer.password}
                    onChange={(e) => setNewEngineer({ ...newEngineer, password: e.target.value })}
                    className="border-2"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newEngineer.phone}
                    onChange={(e) => setNewEngineer({ ...newEngineer, phone: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addEngineerMutation.isPending}>
                    {addEngineerMutation.isPending ? "Creating..." : "Create Engineer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Engineers</span>
            </div>
            <p className="text-2xl font-bold">{engineers.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Total Points</span>
            </div>
            <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm">Tasks Completed</span>
            </div>
            <p className="text-2xl font-bold">{totalTasksCompleted}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Hours This Month</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(totalHours)}h</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search engineers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-2"
          />
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEngineers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold mb-2">No Engineers Found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Add your first engineer to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Rank</TableHead>
                  <TableHead className="font-bold">Engineer</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Points</TableHead>
                  <TableHead className="font-bold">Tasks</TableHead>
                  <TableHead className="font-bold">Hours (Month)</TableHead>
                  <TableHead className="font-bold">Joined</TableHead>
                  <TableHead className="font-bold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEngineers.map((engineer, index) => (
                  <TableRow key={engineer.user_id} className="border-b-2 border-border">
                    <TableCell>
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 font-bold border-2 ${
                          index === 0
                            ? "bg-chart-4/20 border-chart-4 text-chart-4"
                            : index === 1
                            ? "bg-muted border-muted-foreground"
                            : index === 2
                            ? "bg-chart-5/20 border-chart-5 text-chart-5"
                            : "border-border"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {engineer.display_name || "—"}
                    </TableCell>
                    <TableCell>{engineer.display_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono gap-1">
                        <Trophy className="h-3 w-3" />
                        {engineer.total_points.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-chart-2">{engineer.tasks_completed} done</span>
                        {engineer.tasks_in_progress > 0 && (
                          <span className="text-muted-foreground">
                            / {engineer.tasks_in_progress} active
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {engineer.hours_this_month}h
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {engineer.created_at ? format(new Date(engineer.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>View Tasks</DropdownMenuItem>
                          <DropdownMenuItem>View Time Logs</DropdownMenuItem>
                          <DropdownMenuItem>Assign Agent</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
