import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  CreditCard,
  Package,
  Loader2,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Payment {
  id: string;
  client_id: string;
  amount: number;
  credits: number;
  status: string;
  created_at: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "#10b981", "#f59e0b"];

export default function AdminPaymentAnalytics() {
  const [timeRange, setTimeRange] = useState("30");

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-analytics", timeRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(timeRange));
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as Payment[];
    },
  });

  const { data: allTimeStats } = useQuery({
    queryKey: ["admin-payment-all-time"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*");

      if (error) throw error;
      
      const payments = (data || []) as Payment[];
      const completed = payments.filter(p => p.status === "completed");
      const refunded = payments.filter(p => p.status === "refunded");
      
      return {
        totalRevenue: completed.reduce((sum, p) => sum + p.amount, 0) / 100,
        totalRefunds: refunded.reduce((sum, p) => sum + p.amount, 0) / 100,
        totalTransactions: payments.length,
        uniqueCustomers: new Set(completed.map(p => p.client_id)).size,
        totalCredits: completed.reduce((sum, p) => sum + p.credits, 0),
      };
    },
  });

  // Calculate stats
  const stats = {
    totalRevenue: payments?.filter(p => p.status === "completed").reduce((sum, p) => sum + p.amount, 0) || 0,
    totalRefunds: payments?.filter(p => p.status === "refunded").reduce((sum, p) => sum + p.amount, 0) || 0,
    completedCount: payments?.filter(p => p.status === "completed").length || 0,
    refundedCount: payments?.filter(p => p.status === "refunded").length || 0,
    avgOrderValue: 0,
    uniqueCustomers: new Set(payments?.filter(p => p.status === "completed").map(p => p.client_id) || []).size,
  };
  
  if (stats.completedCount > 0) {
    stats.avgOrderValue = stats.totalRevenue / stats.completedCount;
  }

  // Daily revenue chart data
  const dailyRevenue = (() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), parseInt(timeRange)),
      end: new Date(),
    });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayPayments = payments?.filter(p => {
        const paymentDate = new Date(p.created_at);
        return paymentDate >= dayStart && paymentDate < dayEnd && p.status === "completed";
      }) || [];

      return {
        date: format(day, "MMM d"),
        revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0) / 100,
        transactions: dayPayments.length,
      };
    });
  })();

  // Credit package distribution
  const packageDistribution = (() => {
    const packages: Record<string, { count: number; revenue: number }> = {};
    
    payments?.filter(p => p.status === "completed").forEach(p => {
      let tier = "Custom";
      if (p.credits <= 100) tier = "100";
      else if (p.credits <= 500) tier = "500";
      else if (p.credits <= 1000) tier = "1000";
      else if (p.credits <= 2500) tier = "2500";
      else if (p.credits <= 5000) tier = "5000";
      else tier = "5000+";
      
      if (!packages[tier]) packages[tier] = { count: 0, revenue: 0 };
      packages[tier].count++;
      packages[tier].revenue += p.amount / 100;
    });

    return Object.entries(packages).map(([name, data]) => ({
      name: `${name} credits`,
      value: data.count,
      revenue: data.revenue,
    }));
  })();

  // Payment status distribution
  const statusDistribution = [
    { name: "Completed", value: stats.completedCount },
    { name: "Refunded", value: stats.refundedCount },
    { name: "Pending/Failed", value: (payments?.length || 0) - stats.completedCount - stats.refundedCount },
  ].filter(s => s.value > 0);

  // Top customers by spend
  const topCustomers = (() => {
    const customerSpend: Record<string, { total: number; transactions: number }> = {};
    
    payments?.filter(p => p.status === "completed").forEach(p => {
      if (!customerSpend[p.client_id]) {
        customerSpend[p.client_id] = { total: 0, transactions: 0 };
      }
      customerSpend[p.client_id].total += p.amount / 100;
      customerSpend[p.client_id].transactions++;
    });

    return Object.entries(customerSpend)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  })();

  // Churn indicator - customers who haven't purchased recently
  const churnRisk = (() => {
    const allCustomers = new Set(payments?.map(p => p.client_id) || []);
    const recentCustomers = new Set(
      payments?.filter(p => {
        const date = new Date(p.created_at);
        return date >= subDays(new Date(), 30) && p.status === "completed";
      }).map(p => p.client_id) || []
    );
    
    const churned = [...allCustomers].filter(c => !recentCustomers.has(c));
    return {
      total: allCustomers.size,
      atRisk: churned.length,
      percentage: allCustomers.size > 0 ? (churned.length / allCustomers.size * 100).toFixed(1) : "0",
    };
  })();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Analytics</h1>
            <p className="text-muted-foreground">
              Revenue trends, customer insights, and payment patterns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <IndianRupee className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{(stats.totalRevenue / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last {timeRange} days
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Avg ₹{(stats.avgOrderValue / 100).toLocaleString()} per order
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.uniqueCustomers}</div>
                  <p className="text-xs text-muted-foreground">
                    Made purchases in period
                  </p>
                </CardContent>
              </Card>
              <Card className={Number(churnRisk.percentage) > 30 ? "border-amber-500" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{churnRisk.atRisk}</div>
                  <p className="text-xs text-muted-foreground">
                    {churnRisk.percentage}% inactive (30d)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* All-time stats banner */}
            {allTimeStats && (
              <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
                <CardContent className="py-4">
                  <div className="grid sm:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">₹{allTimeStats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">All-time Revenue</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{allTimeStats.totalTransactions}</p>
                      <p className="text-xs text-muted-foreground">Total Transactions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{allTimeStats.uniqueCustomers}</p>
                      <p className="text-xs text-muted-foreground">Total Customers</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{allTimeStats.totalCredits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Credits Sold</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">₹{allTimeStats.totalRefunds.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Refunds</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Daily revenue over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }}
                        interval={Math.floor(dailyRevenue.length / 7)}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `₹${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '2px solid hsl(var(--border))',
                          borderRadius: '0px',
                        }}
                        formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Package Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Credit Package Distribution
                  </CardTitle>
                  <CardDescription>Popular package sizes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={packageDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {packageDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '2px solid hsl(var(--border))',
                            borderRadius: '0px',
                          }}
                          formatter={(value: number, name: string, entry: any) => [
                            `${value} purchases (₹${entry.payload.revenue.toLocaleString()})`,
                            name
                          ]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Transaction Status
                  </CardTitle>
                  <CardDescription>Success vs refund rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          <Cell fill="hsl(142 76% 36%)" />
                          <Cell fill="hsl(var(--destructive))" />
                          <Cell fill="hsl(var(--muted-foreground))" />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '2px solid hsl(var(--border))',
                            borderRadius: '0px',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Customers by Spend
                </CardTitle>
                <CardDescription>Highest spending customers in the period</CardDescription>
              </CardHeader>
              <CardContent>
                {topCustomers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead>Avg Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topCustomers.map((customer, index) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <Badge variant={index === 0 ? "default" : "outline"}>
                              #{index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {customer.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-bold text-green-600">
                            ₹{customer.total.toLocaleString()}
                          </TableCell>
                          <TableCell>{customer.transactions}</TableCell>
                          <TableCell>
                            ₹{(customer.total / customer.transactions).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No customer data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
