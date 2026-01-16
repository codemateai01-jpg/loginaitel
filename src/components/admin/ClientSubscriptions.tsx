import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Package, Phone, TrendingUp, Loader2, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface ClientSubscription {
  id: string;
  client_id: string;
  package_id: string;
  calls_remaining: number;
  calls_used: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  pricing_packages: {
    name: string;
    slug: string;
    calls_included: number;
  };
  profiles: {
    email: string;
    full_name: string | null;
  };
}

interface PricingPackage {
  id: string;
  name: string;
  slug: string;
  calls_included: number;
  display_order: number;
}

export function ClientSubscriptions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [upgradeData, setUpgradeData] = useState<{
    subscription: ClientSubscription | null;
    newPackageId: string;
    carryOverCalls: boolean;
  }>({
    subscription: null,
    newPackageId: "",
    carryOverCalls: true,
  });

  const { data: subscriptions, isLoading: loadingSubscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select(`
          *,
          pricing_packages (name, slug, calls_included),
          profiles!client_subscriptions_client_id_fkey (email, full_name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as ClientSubscription[];
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_packages")
        .select("id, name, slug, calls_included, display_order")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data as PricingPackage[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-without-subscription"],
    queryFn: async () => {
      // Get all clients
      const { data: allClients, error: clientsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      
      if (clientsError) throw clientsError;

      // Get clients with active subscriptions
      const { data: activeSubscriptions } = await supabase
        .from("client_subscriptions")
        .select("client_id")
        .eq("status", "active");

      const subscribedClientIds = new Set(activeSubscriptions?.map(s => s.client_id) || []);
      const unsubscribedClientIds = allClients
        ?.filter(c => !subscribedClientIds.has(c.user_id))
        .map(c => c.user_id) || [];

      if (unsubscribedClientIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", unsubscribedClientIds);
      
      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ clientId, packageId }: { clientId: string; packageId: string }) => {
      const pkg = packages?.find(p => p.id === packageId);
      if (!pkg) throw new Error("Package not found");

      // Create subscription
      const { error: subError } = await supabase.from("client_subscriptions").insert({
        client_id: clientId,
        package_id: packageId,
        calls_remaining: pkg.calls_included,
        calls_used: 0,
        status: "active",
      });
      if (subError) throw subError;

      // Log history
      const { error: historyError } = await supabase.from("subscription_history").insert({
        client_id: clientId,
        to_package_id: packageId,
        action: "initial",
        created_by: user?.id,
      });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["clients-without-subscription"] });
      toast.success("Package assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedClient(null);
      setSelectedPackage("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (!upgradeData.subscription || !upgradeData.newPackageId) return;

      const oldSub = upgradeData.subscription;
      const newPkg = packages?.find(p => p.id === upgradeData.newPackageId);
      if (!newPkg) throw new Error("Package not found");

      const callsCarriedOver = upgradeData.carryOverCalls ? oldSub.calls_remaining : 0;
      const newCallsRemaining = newPkg.calls_included + callsCarriedOver;

      // Update existing subscription to expired
      const { error: updateError } = await supabase
        .from("client_subscriptions")
        .update({ status: "expired" })
        .eq("id", oldSub.id);
      if (updateError) throw updateError;

      // Create new subscription
      const { error: createError } = await supabase.from("client_subscriptions").insert({
        client_id: oldSub.client_id,
        package_id: upgradeData.newPackageId,
        calls_remaining: newCallsRemaining,
        calls_used: 0,
        status: "active",
      });
      if (createError) throw createError;

      // Log history
      const { error: historyError } = await supabase.from("subscription_history").insert({
        client_id: oldSub.client_id,
        from_package_id: oldSub.package_id,
        to_package_id: upgradeData.newPackageId,
        action: "upgrade",
        calls_carried_over: callsCarriedOver,
        created_by: user?.id,
      });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-history"] });
      toast.success("Subscription upgraded successfully");
      setIsUpgradeDialogOpen(false);
      setUpgradeData({ subscription: null, newPackageId: "", carryOverCalls: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredSubscriptions = subscriptions?.filter(sub => {
    const searchLower = searchTerm.toLowerCase();
    return (
      sub.profiles?.email?.toLowerCase().includes(searchLower) ||
      sub.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      sub.pricing_packages?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleUpgrade = (subscription: ClientSubscription) => {
    // Get only packages that are higher tier (based on display_order)
    const currentPkg = packages?.find(p => p.id === subscription.package_id);
    if (!currentPkg) return;

    setUpgradeData({
      subscription,
      newPackageId: "",
      carryOverCalls: true,
    });
    setIsUpgradeDialogOpen(true);
  };

  const getUpgradeablePackages = () => {
    if (!upgradeData.subscription || !packages) return [];
    const currentPkg = packages.find(p => p.id === upgradeData.subscription?.package_id);
    if (!currentPkg) return [];
    return packages.filter(p => p.display_order > currentPkg.display_order);
  };

  if (loadingSubscriptions) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsAssignDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Package
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Calls Used / Total</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions?.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{sub.profiles?.full_name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{sub.profiles?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-primary" />
                      {sub.pricing_packages?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {sub.calls_used.toLocaleString()} / {sub.pricing_packages?.calls_included.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.calls_remaining > 1000 ? "default" : "destructive"}>
                      {sub.calls_remaining.toLocaleString()} remaining
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(sub.started_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {sub.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => handleUpgrade(sub)}>
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Upgrade
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredSubscriptions?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No subscriptions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Package Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Package to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient || ""} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients?.length === 0 && (
                <p className="text-xs text-muted-foreground">All clients already have active subscriptions</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Select Package</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a package" />
                </SelectTrigger>
                <SelectContent>
                  {packages?.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.calls_included.toLocaleString()} calls)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedClient && selectedPackage) {
                    assignMutation.mutate({ clientId: selectedClient, packageId: selectedPackage });
                  }
                }}
                disabled={!selectedClient || !selectedPackage || assignMutation.isPending}
              >
                {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign Package
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Current: <strong>{upgradeData.subscription?.pricing_packages?.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Remaining calls: {upgradeData.subscription?.calls_remaining.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Upgrade To</Label>
              <Select
                value={upgradeData.newPackageId}
                onValueChange={(value) => setUpgradeData({ ...upgradeData, newPackageId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new package" />
                </SelectTrigger>
                <SelectContent>
                  {getUpgradeablePackages().map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.calls_included.toLocaleString()} calls)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getUpgradeablePackages().length === 0 && (
                <p className="text-xs text-muted-foreground">Client is already on the highest package</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="carryOver"
                checked={upgradeData.carryOverCalls}
                onChange={(e) => setUpgradeData({ ...upgradeData, carryOverCalls: e.target.checked })}
                className="rounded border-input"
              />
              <Label htmlFor="carryOver" className="text-sm">
                Carry over remaining calls ({upgradeData.subscription?.calls_remaining.toLocaleString()})
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsUpgradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => upgradeMutation.mutate()}
                disabled={!upgradeData.newPackageId || upgradeMutation.isPending}
              >
                {upgradeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Upgrade
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
