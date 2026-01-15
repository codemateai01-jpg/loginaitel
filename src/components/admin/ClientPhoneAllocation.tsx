import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Phone, Users, RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listPhoneNumbers, type PhoneNumber } from "@/lib/aitel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ClientPhoneAllocation {
  id: string;
  client_id: string;
  phone_number: string;
  is_active: boolean;
  allocated_at: string;
  profile?: {
    full_name: string | null;
    email: string;
  };
}

export function ClientPhoneAllocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");

  // Fetch existing allocations
  const { data: allocations, isLoading: loadingAllocations } = useQuery({
    queryKey: ["client-phone-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_phone_numbers")
        .select("*")
        .eq("is_active", true)
        .order("allocated_at", { ascending: false });

      if (error) throw error;

      // Get profiles
      const clientIds = [...new Set((data || []).map((a) => a.client_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", clientIds);

      return (data || []).map((allocation) => ({
        ...allocation,
        profile: profiles?.find((p) => p.user_id === allocation.client_id),
      })) as ClientPhoneAllocation[];
    },
  });

  // Fetch available phone numbers from Bolna
  const { data: phoneNumbers } = useQuery({
    queryKey: ["bolna-phone-numbers"],
    queryFn: async () => {
      const response = await listPhoneNumbers();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-phone-allocation"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      if (!roles?.length) return [];

      const clientIds = roles.map((r) => r.user_id);
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", clientIds);

      if (error) throw error;
      return profiles || [];
    },
  });

  // Allocate mutation
  const allocateMutation = useMutation({
    mutationFn: async ({ clientId, phoneNumber }: { clientId: string; phoneNumber: string }) => {
      const { error } = await supabase
        .from("client_phone_numbers")
        .insert({
          client_id: clientId,
          phone_number: phoneNumber,
          allocated_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phone number allocated successfully");
      queryClient.invalidateQueries({ queryKey: ["client-phone-allocations"] });
      setAllocateDialogOpen(false);
      setSelectedClientId("");
      setSelectedPhoneNumber("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to allocate phone number");
    },
  });

  // Deallocate mutation
  const deallocateMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      const { error } = await supabase
        .from("client_phone_numbers")
        .update({ is_active: false })
        .eq("id", allocationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phone number deallocated");
      queryClient.invalidateQueries({ queryKey: ["client-phone-allocations"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to deallocate");
    },
  });

  // All phone numbers are available for allocation (multiple clients can share numbers)
  const availablePhoneNumbers = phoneNumbers;

  const handleAllocate = () => {
    if (!selectedClientId || !selectedPhoneNumber) return;
    allocateMutation.mutate({
      clientId: selectedClientId,
      phoneNumber: selectedPhoneNumber,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Client Phone Allocations
              </CardTitle>
              <CardDescription>
                Allocate phone numbers to clients for outbound calls
              </CardDescription>
            </div>
            <Button onClick={() => setAllocateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Allocate Number
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAllocations ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allocations && allocations.length > 0 ? (
            <div className="border-2 border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Allocated On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {allocation.profile?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {allocation.profile?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {allocation.phone_number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(allocation.allocated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-chart-2">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deallocateMutation.mutate(allocation.id)}
                          disabled={deallocateMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No phone numbers allocated yet</p>
              <p className="text-sm">Allocate phone numbers to clients to enable outbound calls</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocate Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Phone Number</DialogTitle>
            <DialogDescription>
              Assign a phone number to a client for outbound calls
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Client</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {client.full_name || client.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Phone Number</label>
              <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a phone number" />
                </SelectTrigger>
                <SelectContent>
                  {availablePhoneNumbers?.map((phone) => (
                    <SelectItem key={phone.id} value={phone.phone_number}>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="font-mono">{phone.phone_number}</span>
                        <Badge variant="outline" className="ml-2">
                          {phone.telephony_provider}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availablePhoneNumbers?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All phone numbers have been allocated
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAllocate}
              disabled={!selectedClientId || !selectedPhoneNumber || allocateMutation.isPending}
            >
              {allocateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Allocating...
                </>
              ) : (
                "Allocate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}