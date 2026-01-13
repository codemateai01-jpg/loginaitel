import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CreditCard, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface ClientCredit {
  id: string;
  client_id: string;
  balance: number;
  price_per_credit: number;
  created_at: string;
  updated_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

interface CreditTransaction {
  id: string;
  client_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

export function CreditManagement() {
  const [search, setSearch] = useState("");
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [creditAmount, setCreditAmount] = useState("");
  const [pricePerCredit, setPricePerCredit] = useState("3.00");
  const [creditDescription, setCreditDescription] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch client credits with profiles
  const { data: clientCredits, isLoading: creditsLoading } = useQuery({
    queryKey: ["admin-client-credits"],
    queryFn: async () => {
      const { data: credits, error: creditsError } = await supabase
        .from("client_credits")
        .select("*")
        .order("updated_at", { ascending: false });

      if (creditsError) throw creditsError;

      // Get profiles for clients
      const clientIds = credits?.map((c) => c.client_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", clientIds);

      const creditsWithProfiles: ClientCredit[] = (credits || []).map((credit) => ({
        ...credit,
        profile: profiles?.find((p) => p.user_id === credit.client_id),
      }));

      return creditsWithProfiles;
    },
  });

  // Fetch recent transactions
  const { data: transactions } = useQuery({
    queryKey: ["admin-credit-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get profiles
      const clientIds = [...new Set(data?.map((t) => t.client_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", clientIds);

      const transactionsWithProfiles: CreditTransaction[] = (data || []).map((tx) => ({
        ...tx,
        profile: profiles?.find((p) => p.user_id === tx.client_id),
      }));

      return transactionsWithProfiles;
    },
  });

  // Fetch all clients for dropdown
  const { data: allClients } = useQuery({
    queryKey: ["admin-all-clients"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      if (rolesError) throw rolesError;

      const clientIds = roles?.map((r) => r.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", clientIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  // Allocate credits mutation
  const allocateCreditsMutation = useMutation({
    mutationFn: async ({
      clientId,
      amount,
      price,
      description,
    }: {
      clientId: string;
      amount: number;
      price: number;
      description: string;
    }) => {
      // First, check if client has a credit record
      const { data: existing } = await supabase
        .from("client_credits")
        .select("*")
        .eq("client_id", clientId)
        .single();

      if (existing) {
        // Update existing balance and price
        const { error: updateError } = await supabase
          .from("client_credits")
          .update({ 
            balance: existing.balance + amount,
            price_per_credit: price 
          })
          .eq("client_id", clientId);

        if (updateError) throw updateError;
      } else {
        // Create new credit record with price
        const { error: insertError } = await supabase
          .from("client_credits")
          .insert({ 
            client_id: clientId, 
            balance: amount,
            price_per_credit: price 
          });

        if (insertError) throw insertError;
      }

      // Log the transaction
      const { error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          client_id: clientId,
          amount: amount,
          transaction_type: "admin_allocation",
          description: description || `Admin credit allocation (₹${price}/credit)`,
          created_by: user?.id || clientId,
        });

      if (txError) throw txError;

      return { clientId, amount };
    },
    onSuccess: ({ amount }) => {
      toast.success("Credits allocated", {
        description: `${amount} credits have been added successfully`,
      });
      setIsAllocateDialogOpen(false);
      setSelectedClient("");
      setCreditAmount("");
      setCreditDescription("");
      queryClient.invalidateQueries({ queryKey: ["admin-client-credits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-credit-transactions"] });
    },
    onError: (error) => {
      toast.error("Failed to allocate credits", {
        description: error.message,
      });
    },
  });

  // Filter credits
  const filteredCredits = clientCredits?.filter((credit) => {
    const matchesSearch =
      credit.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
      credit.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Stats
  const totalCredits = clientCredits?.reduce((sum, c) => sum + c.balance, 0) || 0;
  const totalClients = clientCredits?.length || 0;
  const lowBalanceClients = clientCredits?.filter((c) => c.balance < 10).length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border-2 border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalCredits.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Credits</p>
        </div>
        <div className="border-2 border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-chart-2">{totalClients}</p>
          <p className="text-sm text-muted-foreground">Clients with Credits</p>
        </div>
        <div className="border-2 border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-chart-4">{lowBalanceClients}</p>
          <p className="text-sm text-muted-foreground">Low Balance</p>
        </div>
        <div className="border-2 border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-chart-1">
            {Math.round(totalCredits / (totalClients || 1))}
          </p>
          <p className="text-sm text-muted-foreground">Avg Balance</p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-2"
          />
        </div>
        <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Allocate Credits
            </Button>
          </DialogTrigger>
          <DialogContent className="border-2">
            <DialogHeader>
              <DialogTitle>Allocate Credits</DialogTitle>
              <DialogDescription>
                Add credits to a client's wallet
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amount = parseInt(creditAmount);
                const price = parseFloat(pricePerCredit);
                if (selectedClient && amount > 0 && price > 0) {
                  allocateCreditsMutation.mutate({
                    clientId: selectedClient,
                    amount,
                    price,
                    description: creditDescription,
                  });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {allClients?.map((client) => (
                      <SelectItem key={client.user_id} value={client.user_id}>
                        {client.full_name || client.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Amount</Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price per Credit (₹)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={pricePerCredit}
                    onChange={(e) => setPricePerCredit(e.target.value)}
                    placeholder="3.00"
                    className="border-2"
                  />
                </div>
              </div>
              {creditAmount && pricePerCredit && (
                <div className="bg-muted/50 p-3 rounded-lg border-2 border-border">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold">
                    ₹{(parseFloat(creditAmount || "0") * parseFloat(pricePerCredit || "0")).toFixed(2)}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={creditDescription}
                  onChange={(e) => setCreditDescription(e.target.value)}
                  placeholder="Reason for allocation..."
                  className="border-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAllocateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !selectedClient ||
                    !creditAmount ||
                    !pricePerCredit ||
                    allocateCreditsMutation.isPending
                  }
                >
                  {allocateCreditsMutation.isPending ? "Allocating..." : "Allocate"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credits Table */}
      <div className="border-2 border-border bg-card">
        <div className="p-4 border-b-2 border-border">
          <h3 className="font-bold">Client Balances</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border hover:bg-transparent">
              <TableHead className="font-bold">Client</TableHead>
              <TableHead className="font-bold">Email</TableHead>
              <TableHead className="font-bold text-right">Balance</TableHead>
              <TableHead className="font-bold text-right">Price/Credit</TableHead>
              <TableHead className="font-bold">Last Updated</TableHead>
              <TableHead className="font-bold w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditsLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredCredits?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No credit records found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredCredits?.map((credit) => (
                <TableRow key={credit.id} className="border-b-2 border-border">
                  <TableCell className="font-medium">
                    {credit.profile?.full_name || "—"}
                  </TableCell>
                  <TableCell>{credit.profile?.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-bold ${
                        credit.balance < 10
                          ? "text-destructive"
                          : credit.balance < 50
                          ? "text-chart-4"
                          : "text-chart-2"
                      }`}
                    >
                      {credit.balance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{credit.price_per_credit?.toFixed(2) || "3.00"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(credit.updated_at), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedClient(credit.client_id);
                        setIsAllocateDialogOpen(true);
                      }}
                    >
                      Add Credits
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Recent Transactions */}
      <div className="border-2 border-border bg-card">
        <div className="p-4 border-b-2 border-border">
          <h3 className="font-bold">Recent Transactions</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border hover:bg-transparent">
              <TableHead className="font-bold">Client</TableHead>
              <TableHead className="font-bold">Type</TableHead>
              <TableHead className="font-bold text-right">Amount</TableHead>
              <TableHead className="font-bold">Description</TableHead>
              <TableHead className="font-bold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.slice(0, 10).map((tx) => (
              <TableRow key={tx.id} className="border-b-2 border-border">
                <TableCell className="font-medium">
                  {tx.profile?.full_name || tx.profile?.email || "—"}
                </TableCell>
                <TableCell>
                  <span className="text-xs font-medium capitalize">
                    {tx.transaction_type.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-mono font-bold inline-flex items-center gap-1 ${
                      tx.amount > 0 ? "text-chart-2" : "text-destructive"
                    }`}
                  >
                    {tx.amount > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {tx.description || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(tx.created_at), "MMM d, HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
