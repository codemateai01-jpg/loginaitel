import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Receipt, 
  Download, 
  Loader2, 
  CheckCircle2, 
  Clock,
  XCircle,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface Payment {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  credits: number;
  status: string;
  invoice_url: string | null;
  created_at: string;
}

export function PaymentHistoryCard() {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["client-payments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Payment[];
    },
  });

  const handleDownloadInvoice = async (payment: Payment) => {
    setDownloadingId(payment.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: { paymentId: payment.id },
      });

      if (error || data.error) {
        throw new Error(data?.error || error?.message || "Failed to generate invoice");
      }

      // Create a blob from the HTML content
      const blob = new Blob([data.invoiceHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully");
    } catch (error: any) {
      console.error("Invoice download error:", error);
      toast.error(error.message || "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate discount percentage based on credits purchased
  const getDiscountInfo = (credits: number, amount: number) => {
    const basePrice = 3.00;
    const actualPrice = amount / 100 / credits;
    const discountPercent = actualPrice < basePrice ? Math.round((1 - actualPrice / basePrice) * 100) : 0;
    return discountPercent > 0 ? `${discountPercent}% off` : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payments && payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const discount = getDiscountInfo(payment.credits, payment.amount);
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payment.created_at), "PP")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{payment.credits.toLocaleString()}</span>
                        {discount && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {discount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{(payment.amount / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(payment)}
                          disabled={downloadingId === payment.id}
                        >
                          {downloadingId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-1" />
                              Invoice
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No payments yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
