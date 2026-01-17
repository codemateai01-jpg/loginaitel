import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  Calendar,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Gift,
  CalendarClock,
} from "lucide-react";

const SEAT_PRICE = 300;

interface SeatPayment {
  id: string;
  client_id: string;
  amount: number;
  seats_count: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
}

interface SeatSubscription {
  id: string;
  client_id: string;
  seats_count: number;
  status: string;
  is_trial: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  autopay_enabled: boolean;
  autopay_setup_at: string | null;
  last_payment_date: string | null;
  next_billing_date: string | null;
  created_at: string;
}

export function SeatPaymentHistory() {
  const { user } = useAuth();

  // Fetch seat subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["seat-subscription-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_subscriptions")
        .select("*")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data as SeatSubscription | null;
    },
  });

  // Fetch seat payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["seat-payments-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_payments")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SeatPayment[];
    },
  });

  const isLoading = subLoading || paymentsLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getTrialStatus = () => {
    if (!subscription) return null;
    if (!subscription.is_trial) return null;

    const trialEndsAt = subscription.trial_ends_at
      ? new Date(subscription.trial_ends_at)
      : null;

    if (trialEndsAt && new Date() >= trialEndsAt) {
      return { status: "expired", daysLeft: 0 };
    }

    if (trialEndsAt) {
      const daysLeft = Math.ceil(
        (trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return { status: "active", daysLeft };
    }

    return null;
  };

  const trialStatus = getTrialStatus();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedPayments = payments?.filter((p) => p.status === "completed") || [];
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Current Plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              Current Plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div>
                <div className="text-2xl font-bold">{subscription.seats_count} Seats</div>
                <div className="text-sm text-muted-foreground">
                  ₹{subscription.seats_count * SEAT_PRICE}/month
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">No subscription</div>
            )}
          </CardContent>
        </Card>

        {/* Trial/Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              {subscription?.is_trial ? <Gift className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              Status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription?.is_trial && trialStatus ? (
              <div>
                <div className="text-2xl font-bold">
                  {trialStatus.status === "active" ? (
                    <span className="text-green-600">{trialStatus.daysLeft} days left</span>
                  ) : (
                    <span className="text-red-600">Trial Expired</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Free Trial</div>
              </div>
            ) : subscription?.autopay_enabled ? (
              <div>
                <div className="text-2xl font-bold text-green-600">Active</div>
                <div className="text-sm text-muted-foreground">Autopay enabled</div>
              </div>
            ) : subscription ? (
              <div>
                <div className="text-2xl font-bold text-yellow-600">Pending</div>
                <div className="text-sm text-muted-foreground">Setup autopay</div>
              </div>
            ) : (
              <div className="text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        {/* Next Billing */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              Next Billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription?.next_billing_date ? (
              <div>
                <div className="text-2xl font-bold">
                  {format(new Date(subscription.next_billing_date), "MMM d")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(subscription.next_billing_date), { addSuffix: true })}
                </div>
              </div>
            ) : subscription?.is_trial && subscription?.trial_ends_at ? (
              <div>
                <div className="text-2xl font-bold">
                  {format(new Date(subscription.trial_ends_at), "MMM d")}
                </div>
                <div className="text-sm text-muted-foreground">Trial ends</div>
              </div>
            ) : (
              <div className="text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        {/* Total Paid */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Total Paid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalPaid.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">
              {completedPayments.length} payment{completedPayments.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trial Banner */}
      {subscription?.is_trial && trialStatus && (
        <Card className={trialStatus.status === "active" ? "border-primary bg-primary/5" : "border-destructive bg-destructive/5"}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Gift className={`h-8 w-8 ${trialStatus.status === "active" ? "text-primary" : "text-destructive"}`} />
              <div>
                <h4 className="font-semibold">
                  {trialStatus.status === "active"
                    ? `Free Trial: ${trialStatus.daysLeft} days remaining`
                    : "Your free trial has expired"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {trialStatus.status === "active"
                    ? `Set up autopay before ${subscription.trial_ends_at ? format(new Date(subscription.trial_ends_at), "MMMM d, yyyy") : "trial ends"} to continue using team features`
                    : "Set up autopay to continue using team features"}
                </p>
              </div>
            </div>
            {!subscription.autopay_enabled && (
              <Badge variant={trialStatus.status === "active" ? "outline" : "destructive"}>
                Action Required
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment History
          </CardTitle>
          <CardDescription>All your seat subscription payments and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(payment.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Team Seat Subscription
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.seats_count} seats</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">₹{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {payment.billing_period_start && payment.billing_period_end ? (
                        <div className="text-sm">
                          {format(new Date(payment.billing_period_start), "MMM d")} -{" "}
                          {format(new Date(payment.billing_period_end), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {payment.razorpay_payment_id?.slice(0, 16) || "—"}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">No payments yet</h3>
              <p className="text-sm text-muted-foreground">
                {subscription?.is_trial
                  ? "You're currently on a free trial. Payments will appear here once you set up autopay."
                  : "Your payment history will appear here once you make a payment."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Billing Info */}
      {subscription && subscription.next_billing_date && subscription.autopay_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <h4 className="font-semibold">Next charge on {format(new Date(subscription.next_billing_date), "MMMM d, yyyy")}</h4>
                <p className="text-sm text-muted-foreground">
                  {subscription.seats_count} seats × ₹{SEAT_PRICE}/seat
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">₹{subscription.seats_count * SEAT_PRICE}</div>
                <div className="text-sm text-muted-foreground">Auto-debit via Razorpay</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
