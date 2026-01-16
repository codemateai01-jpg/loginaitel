import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Phone, 
  Clock,
  Target,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface Call {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  connected: boolean;
  status: string;
  sentiment?: string | null;
}

interface CallCostAnalyticsProps {
  calls: Call[];
  creditBalance: number;
  pricePerCredit?: number; // Default ₹5 per credit
  creditsPerMinute?: number; // Default 1 credit per minute
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function CallCostAnalytics({
  calls,
  creditBalance,
  pricePerCredit = 5,
  creditsPerMinute = 1,
}: CallCostAnalyticsProps) {
  const analytics = useMemo(() => {
    if (!calls.length) {
      return {
        totalCalls: 0,
        totalMinutes: 0,
        totalCreditsUsed: 0,
        totalCost: 0,
        avgCostPerCall: 0,
        avgDuration: 0,
        connectedCalls: 0,
        connectionRate: 0,
        interestedLeads: 0,
        conversionRate: 0,
        costPerLead: 0,
        estimatedROI: 0,
        dailyCosts: [],
        costByStatus: [],
        projectedBalance: creditBalance,
        daysRemaining: 0,
      };
    }

    // Calculate total minutes and costs
    const totalMinutes = calls.reduce((sum, call) => {
      return sum + Math.ceil((call.duration_seconds || 0) / 60);
    }, 0);
    
    const totalCreditsUsed = totalMinutes * creditsPerMinute;
    const totalCost = totalCreditsUsed * pricePerCredit;
    
    const connectedCalls = calls.filter(c => c.connected).length;
    const interestedLeads = calls.filter(c => c.sentiment === "positive").length;
    
    const connectionRate = (connectedCalls / calls.length) * 100;
    const conversionRate = calls.length > 0 ? (interestedLeads / calls.length) * 100 : 0;
    const costPerLead = interestedLeads > 0 ? totalCost / interestedLeads : 0;
    const avgCostPerCall = totalCost / calls.length;
    const avgDuration = totalMinutes / calls.length;

    // Calculate daily costs for last 7 days
    const dailyCosts = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const dayCalls = calls.filter(c => {
        const callDate = new Date(c.created_at);
        return callDate >= dayStart && callDate <= dayEnd;
      });
      
      const dayMinutes = dayCalls.reduce((sum, call) => {
        return sum + Math.ceil((call.duration_seconds || 0) / 60);
      }, 0);
      
      return {
        date: format(date, "MMM d"),
        calls: dayCalls.length,
        minutes: dayMinutes,
        cost: dayMinutes * creditsPerMinute * pricePerCredit,
      };
    });

    // Cost breakdown by status
    const statusGroups = calls.reduce((acc, call) => {
      const status = call.sentiment === "positive" ? "Interested" 
        : call.sentiment === "negative" ? "Not Interested"
        : call.connected ? "Connected" 
        : "Not Connected";
      
      if (!acc[status]) {
        acc[status] = { count: 0, minutes: 0 };
      }
      acc[status].count++;
      acc[status].minutes += Math.ceil((call.duration_seconds || 0) / 60);
      return acc;
    }, {} as Record<string, { count: number; minutes: number }>);

    const costByStatus = Object.entries(statusGroups).map(([name, data]) => ({
      name,
      calls: data.count,
      cost: data.minutes * creditsPerMinute * pricePerCredit,
      percentage: Math.round((data.count / calls.length) * 100),
    }));

    // Projected balance calculation
    const avgDailyCost = dailyCosts.reduce((sum, d) => sum + d.cost, 0) / 7;
    const daysRemaining = avgDailyCost > 0 ? Math.floor((creditBalance * pricePerCredit) / avgDailyCost) : 999;
    
    // Estimated ROI (assuming ₹500 average value per interested lead)
    const estimatedLeadValue = 500;
    const estimatedRevenue = interestedLeads * estimatedLeadValue;
    const estimatedROI = totalCost > 0 ? ((estimatedRevenue - totalCost) / totalCost) * 100 : 0;

    return {
      totalCalls: calls.length,
      totalMinutes,
      totalCreditsUsed,
      totalCost,
      avgCostPerCall,
      avgDuration,
      connectedCalls,
      connectionRate,
      interestedLeads,
      conversionRate,
      costPerLead,
      estimatedROI,
      dailyCosts,
      costByStatus,
      projectedBalance: creditBalance - totalCreditsUsed,
      daysRemaining,
    };
  }, [calls, creditBalance, pricePerCredit, creditsPerMinute]);

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.totalCost)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analytics.totalCreditsUsed} credits used
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost per Call</p>
                <p className="text-2xl font-bold">{formatCurrency(Math.round(analytics.avgCostPerCall))}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avg {analytics.avgDuration.toFixed(1)} min/call
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost per Lead</p>
                <p className="text-2xl font-bold">{formatCurrency(Math.round(analytics.costPerLead))}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analytics.interestedLeads} interested leads
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Est. ROI</p>
                <p className={`text-2xl font-bold ${analytics.estimatedROI >= 0 ? "text-chart-2" : "text-destructive"}`}>
                  {analytics.estimatedROI >= 0 ? "+" : ""}{Math.round(analytics.estimatedROI)}%
                </p>
              </div>
              {analytics.estimatedROI >= 0 ? (
                <TrendingUp className="h-8 w-8 text-chart-2 opacity-50" />
              ) : (
                <TrendingDown className="h-8 w-8 text-destructive opacity-50" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on ₹500/lead value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Projection */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Balance Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold">{creditBalance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Credits remaining</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <p className="text-3xl font-bold text-chart-1">{analytics.daysRemaining}</p>
              <p className="text-sm text-muted-foreground">Days of calls left</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <p className="text-3xl font-bold">{formatCurrency(creditBalance * pricePerCredit)}</p>
              <p className="text-sm text-muted-foreground">Balance value</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Spend Chart */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Spending (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dailyCosts}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value}`, "Cost"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost by Outcome */}
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Cost by Outcome</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.costByStatus}
                    dataKey="cost"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {analytics.costByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Metrics */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Efficiency Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{analytics.totalCalls}</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{analytics.totalMinutes}</p>
              <p className="text-sm text-muted-foreground">Total Minutes</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-chart-2">{analytics.connectionRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Connection Rate</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-chart-1">{analytics.conversionRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{analytics.connectedCalls}</p>
              <p className="text-sm text-muted-foreground">Connected Calls</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
