import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Phone, 
  Plus,
  History,
  Loader2,
  Wallet,
  Calendar,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay, startOfWeek, eachDayOfInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  call_id: string | null;
}

export default function ClientBilling() {
  const { user } = useAuth();

  // Fetch credit balance and price
  const { data: creditData, isLoading: creditsLoading } = useQuery({
    queryKey: ["client-credits-balance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_credits")
        .select("balance, price_per_credit")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return { 
        balance: data?.balance || 0, 
        pricePerCredit: data?.price_per_credit || 3.00 
      };
    },
  });

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["client-transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  // Calculate stats
  const stats = {
    totalSpent: transactions
      ?.filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0,
    totalAdded: transactions
      ?.filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0) || 0,
    callsDeducted: transactions
      ?.filter((t) => t.transaction_type === "call_deduction").length || 0,
  };

  // Calculate daily usage for the last 7 days
  const dailyUsage = (() => {
    const now = new Date();
    const days = eachDayOfInterval({
      start: subDays(now, 6),
      end: now,
    });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayTransactions = transactions?.filter((t) => {
        const txDate = new Date(t.created_at);
        return txDate >= dayStart && txDate < dayEnd && t.amount < 0;
      }) || [];

      const used = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        day: format(day, "EEE"),
        date: format(day, "MMM d"),
        used,
      };
    });
  })();

  // Calculate weekly usage stats
  const weeklyStats = (() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = subDays(thisWeekStart, 7);

    const thisWeekUsed = transactions
      ?.filter((t) => {
        const txDate = new Date(t.created_at);
        return txDate >= thisWeekStart && t.amount < 0;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

    const lastWeekUsed = transactions
      ?.filter((t) => {
        const txDate = new Date(t.created_at);
        return txDate >= lastWeekStart && txDate < thisWeekStart && t.amount < 0;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

    const todayStart = startOfDay(now);
    const todayUsed = transactions
      ?.filter((t) => {
        const txDate = new Date(t.created_at);
        return txDate >= todayStart && t.amount < 0;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

    const weekChange = lastWeekUsed > 0 
      ? ((thisWeekUsed - lastWeekUsed) / lastWeekUsed * 100).toFixed(0)
      : thisWeekUsed > 0 ? "+100" : "0";

    return {
      thisWeek: thisWeekUsed,
      lastWeek: lastWeekUsed,
      today: todayUsed,
      weekChange,
    };
  })();

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (type === "call_deduction") {
      return <Phone className="h-4 w-4 text-muted-foreground" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "credit_addition":
        return <Badge className="bg-green-500">Credit Added</Badge>;
      case "call_deduction":
        return <Badge variant="secondary">Call Used</Badge>;
      case "refund":
        return <Badge className="bg-blue-500">Refund</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Credits & Billing</h1>
            <p className="text-muted-foreground">
              Manage your credits and view transaction history
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Buy Credits
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{creditData?.balance?.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    ₹{((creditData?.balance || 0) * (creditData?.pricePerCredit || 3)).toLocaleString()} value
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Added</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{stats.totalAdded.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Used</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{stats.totalSpent.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Calls Made</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.callsDeducted}</div>
              <p className="text-xs text-muted-foreground">Connected calls</p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Credit Usage Summary
            </CardTitle>
            <CardDescription>
              Track your credit consumption over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border-2 border-border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Today</span>
                </div>
                <p className="text-2xl font-bold text-destructive">-{weeklyStats.today}</p>
                <p className="text-xs text-muted-foreground">credits used</p>
              </div>
              <div className="p-4 border-2 border-border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">This Week</span>
                </div>
                <p className="text-2xl font-bold text-destructive">-{weeklyStats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(weeklyStats.weekChange) > 0 ? "↑" : Number(weeklyStats.weekChange) < 0 ? "↓" : "→"} {Math.abs(Number(weeklyStats.weekChange))}% vs last week
                </p>
              </div>
              <div className="p-4 border-2 border-border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Week</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">-{weeklyStats.lastWeek}</p>
                <p className="text-xs text-muted-foreground">credits used</p>
              </div>
            </div>

            {/* Daily Usage Chart */}
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '2px solid hsl(var(--border))',
                      borderRadius: '0px'
                    }}
                    labelFormatter={(_, payload) => payload[0]?.payload?.date || ''}
                    formatter={(value: number) => [`${value} credits`, 'Used']}
                  />
                  <Bar 
                    dataKey="used" 
                    fill="hsl(var(--destructive))" 
                    radius={[0, 0, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Daily credit usage (last 7 days)
            </p>
          </CardContent>
        </Card>

        {/* Pricing Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Credit Pricing
            </CardTitle>
            <CardDescription>
              Credits are deducted for connected calls (45+ seconds)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-border bg-muted/50">
                <p className="text-2xl font-bold">1 Credit</p>
                <p className="text-sm text-muted-foreground">= 1 Connected Call</p>
              </div>
              <div className="p-4 border-2 border-border bg-primary/10 border-primary/30">
                <p className="text-2xl font-bold text-primary">
                  ₹{creditData?.pricePerCredit?.toFixed(2) || "3.00"}
                </p>
                <p className="text-sm text-muted-foreground">Per Credit (Your Rate)</p>
              </div>
              <div className="p-4 border-2 border-border bg-muted/50">
                <p className="text-2xl font-bold">45+ sec</p>
                <p className="text-sm text-muted-foreground">Minimum for deduction</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{getTransactionBadge(tx.transaction_type)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.description || tx.transaction_type}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.transaction_type, tx.amount)}
                          <span className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(tx.created_at), "PPp")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
