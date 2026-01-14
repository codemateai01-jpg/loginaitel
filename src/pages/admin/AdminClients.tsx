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
import {
  Search,
  UserPlus,
  MoreVertical,
  Users,
  Phone,
  Bot,
  CreditCard,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface Client {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  credits: number;
  agents_count: number;
  calls_count: number;
}

export default function AdminClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    email: "",
    full_name: "",
    phone: "",
    password: "",
  });

  // Fetch clients with stats
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      // Get all users with client role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      if (rolesError) throw rolesError;
      const clientIds = roles?.map((r) => r.user_id) || [];

      if (clientIds.length === 0) return [];

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", clientIds);

      if (profilesError) throw profilesError;

      // Get credits
      const { data: credits, error: creditsError } = await supabase
        .from("client_credits")
        .select("client_id, balance")
        .in("client_id", clientIds);

      if (creditsError) throw creditsError;

      // Get agent counts
      const { data: agents, error: agentsError } = await supabase
        .from("aitel_agents" as any)
        .select("client_id")
        .in("client_id", clientIds);

      if (agentsError) throw agentsError;

      // Get call counts
      const { data: calls, error: callsError } = await supabase
        .from("calls")
        .select("client_id")
        .in("client_id", clientIds);

      if (callsError) throw callsError;

      // Combine data
      const clientsData: Client[] = (profiles || []).map((profile) => {
        const credit = credits?.find((c) => c.client_id === profile.user_id);
        const agentCount = (agents as any[] || []).filter((a: any) => a.client_id === profile.user_id).length || 0;
        const callCount = calls?.filter((c) => c.client_id === profile.user_id).length || 0;

        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          created_at: profile.created_at,
          credits: credit?.balance || 0,
          agents_count: agentCount,
          calls_count: callCount,
        };
      });

      return clientsData;
    },
  });

  // Add client mutation
  const addClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClient) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: clientData.email,
          password: clientData.password,
          full_name: clientData.full_name || null,
          phone: clientData.phone || null,
          role: "client",
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Client Created", description: "New client account has been created." });
      setIsAddDialogOpen(false);
      setNewClient({ email: "", full_name: "", phone: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredClients = clients.filter((client) =>
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCredits = clients.reduce((sum, c) => sum + c.credits, 0);
  const totalAgents = clients.reduce((sum, c) => sum + c.agents_count, 0);
  const totalCalls = clients.reduce((sum, c) => sum + c.calls_count, 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Client Management</h1>
            <p className="text-muted-foreground">
              Manage client accounts and monitor their usage
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="border-2">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Create a new client account</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addClientMutation.mutate(newClient);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={newClient.full_name}
                    onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    required
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    className="border-2"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="border-2"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addClientMutation.isPending}>
                    {addClientMutation.isPending ? "Creating..." : "Create Client"}
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
              <span className="text-sm">Total Clients</span>
            </div>
            <p className="text-2xl font-bold">{clients.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Total Credits</span>
            </div>
            <p className="text-2xl font-bold">{totalCredits.toLocaleString()}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bot className="h-4 w-4" />
              <span className="text-sm">Total Agents</span>
            </div>
            <p className="text-2xl font-bold">{totalAgents}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Total Calls</span>
            </div>
            <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
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
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold mb-2">No Clients Found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Add your first client to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Client</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Credits</TableHead>
                  <TableHead className="font-bold">Agents</TableHead>
                  <TableHead className="font-bold">Calls</TableHead>
                  <TableHead className="font-bold">Joined</TableHead>
                  <TableHead className="font-bold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} className="border-b-2 border-border">
                    <TableCell className="font-medium">
                      {client.full_name || "—"}
                    </TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {client.credits.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>{client.agents_count}</TableCell>
                    <TableCell>{client.calls_count.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(client.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Manage Credits</DropdownMenuItem>
                          <DropdownMenuItem>View Agents</DropdownMenuItem>
                          <DropdownMenuItem>View Calls</DropdownMenuItem>
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
