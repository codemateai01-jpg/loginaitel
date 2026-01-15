import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Search,
  Loader2,
  RefreshCw,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface Payment {
  id: string;
  client_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  credits: number;
  status: string;
  refund_id: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
  client_email?: string;
  client_name?: string;
}

export default function AdminPayments() {
  const [search, setSearch] = useState("");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get client profiles
      const clientIds = [...new Set((data || []).map((p) => p.client_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", clientIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return (data || []).map((payment) => ({
        ...payment,
        client_email: profileMap.get(payment.client_id)?.email,
        client_name: profileMap.get(payment.client_id)?.full_name,
      })) as Payment[];
    },
  });

  const refundMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("razorpay-refund", {
        body: { paymentId, reason },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Refund processed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      setRefundDialogOpen(false);
      setSelectedPayment(null);
      setRefundReason("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process refund");
    },
  });

  const stats = {
    totalPayments: payments?.length || 0,
    completedPayments: payments?.filter((p) => p.status === "completed").length || 0,
    totalRevenue: payments
      ?.filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0) || 0,
    totalRefunds: payments?.filter((p) => p.status === "refunded").length || 0,
    refundedAmount: payments
      ?.filter((p) => p.status === "refunded")
      .reduce((sum, p) => sum + (p.refund_amount || p.amount), 0) || 0,
  };

  const filteredPayments = payments?.filter(
    (p) =>
      p.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.razorpay_order_id?.toLowerCase().includes(search.toLowerCase()) ||
      p.razorpay_payment_id?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRefund = (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundDialogOpen(true);
  };

  const confirmRefund = () => {
    if (!selectedPayment || !refundReason.trim()) {
      toast.error("Please provide a reason for the refund");
      return;
    }
    refundMutation.mutate({
      paymentId: selectedPayment.id,
      reason: refundReason,
    });
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Management</h1>
            <p className="text-muted-foreground">
              View all Razorpay transactions and manage refunds
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-payments"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPayments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedPayments} completed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₹{(stats.totalRevenue / 100).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">From completed payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Refunds</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.totalRefunds}</div>
              <p className="text-xs text-muted-foreground">
                ₹{(stats.refundedAmount / 100).toLocaleString()} refunded
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{((stats.totalRevenue - stats.refundedAmount) / 100).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">After refunds</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or payment ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPayments && filteredPayments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.client_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.client_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.razorpay_order_id?.slice(0, 15)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.razorpay_payment_id?.slice(0, 15) || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          ₹{(payment.amount / 100).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>{payment.credits}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(payment.created_at), "PP")}
                      </TableCell>
                      <TableCell>
                        {payment.status === "completed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRefund(payment)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refund
                          </Button>
                        )}
                        {payment.status === "refunded" && (
                          <span className="text-xs text-muted-foreground">
                            {payment.refund_reason}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No payments found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              This will refund the payment and deduct {selectedPayment?.credits} credits from
              the client's balance.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 border-2 border-border bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium">{selectedPayment.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold">
                    ₹{(selectedPayment.amount / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits:</span>
                  <span className="font-medium">{selectedPayment.credits}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for refund *</label>
                <Textarea
                  placeholder="Enter the reason for this refund..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRefund}
              disabled={refundMutation.isPending || !refundReason.trim()}
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Refund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
