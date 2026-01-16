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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchClientsWithStats, type ClientWithStats } from "@/lib/secure-proxy";
import {
  Search,
  UserPlus,
  MoreVertical,
  Users,
  Phone,
  Bot,
  CreditCard,
  Loader2,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type CreateStep = "details" | "otp" | "success";

export default function AdminClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>("details");
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
  });

  // Fetch clients with stats via secure proxy (masked data)
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients-secure"],
    queryFn: fetchClientsWithStats,
  });

  // Format phone for display (10 digits only)
  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 10);
  };

  // Send OTP to client's phone
  const handleSendOtp = async () => {
    if (newClient.phone.length !== 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    setSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: newClient.phone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "OTP Sent",
        description: `Verification code sent to +91 ${newClient.phone}`,
      });
      setCreateStep("otp");
    } catch (error: any) {
      toast({
        title: "Failed to Send OTP",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP and create client account
  const handleVerifyAndCreate = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      // First verify the OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp-admin", {
        body: { 
          phone: newClient.phone, 
          otp,
          full_name: newClient.full_name,
        },
      });

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      toast({
        title: "Client Created",
        description: "Client account has been verified and created successfully",
      });
      
      setCreateStep("success");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired OTP",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: newClient.phone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "OTP Resent",
        description: `New verification code sent to +91 ${newClient.phone}`,
      });
      setOtp("");
    } catch (error: any) {
      toast({
        title: "Failed to Resend",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Reset dialog state
  const handleDialogClose = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setTimeout(() => {
        setCreateStep("details");
        setNewClient({ full_name: "", phone: "" });
        setOtp("");
      }, 200);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.display_email.toLowerCase().includes(search.toLowerCase()) ||
    client.display_name.toLowerCase().includes(search.toLowerCase()) ||
    client.display_phone?.includes(search)
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
          <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="border-2">
              {createStep === "details" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>
                      Enter client details. An OTP will be sent to verify the phone number.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={newClient.full_name}
                        onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                        className="border-2"
                        placeholder="Enter client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-2 border-2 border-border bg-muted text-muted-foreground">
                          <span>+91</span>
                        </div>
                        <Input
                          type="tel"
                          required
                          value={newClient.phone}
                          onChange={(e) => setNewClient({ ...newClient, phone: formatPhoneInput(e.target.value) })}
                          className="border-2 flex-1"
                          placeholder="10-digit mobile number"
                          maxLength={10}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Client will use this number to login via OTP
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSendOtp} 
                        disabled={sendingOtp || newClient.phone.length !== 10}
                      >
                        {sendingOtp ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending OTP...
                          </>
                        ) : (
                          "Send OTP & Verify"
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {createStep === "otp" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Verify Phone Number</DialogTitle>
                    <DialogDescription>
                      Enter the 6-digit OTP sent to +91 {newClient.phone}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-2">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    
                    <div className="flex justify-center gap-4 text-sm">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={sendingOtp}
                        className="text-primary hover:underline disabled:opacity-50"
                      >
                        {sendingOtp ? "Sending..." : "Resend OTP"}
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateStep("details");
                          setOtp("");
                        }}
                        className="text-muted-foreground hover:underline"
                      >
                        Change Number
                      </button>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setCreateStep("details");
                          setOtp("");
                        }}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button 
                        onClick={handleVerifyAndCreate} 
                        disabled={verifyingOtp || otp.length !== 6}
                      >
                        {verifyingOtp ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify & Create Client"
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {createStep === "success" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Client Created Successfully</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center py-6 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{newClient.full_name || "New Client"}</p>
                      <p className="text-muted-foreground">+91 {newClient.phone}</p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      The client can now login using their phone number with OTP verification.
                    </p>
                    <Button onClick={() => handleDialogClose(false)} className="mt-4">
                      Done
                    </Button>
                  </div>
                </>
              )}
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
                  <TableHead className="font-bold">Phone</TableHead>
                  <TableHead className="font-bold">Credits</TableHead>
                  <TableHead className="font-bold">Agents</TableHead>
                  <TableHead className="font-bold">Calls</TableHead>
                  <TableHead className="font-bold">Joined</TableHead>
                  <TableHead className="font-bold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.user_id} className="border-b-2 border-border">
                    <TableCell className="font-medium">
                      {client.display_name || "—"}
                    </TableCell>
                    <TableCell>
                      {client.display_phone ? (
                        <span className="font-mono text-sm">{client.display_phone}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
