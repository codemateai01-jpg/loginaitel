import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowRight, Loader2, Search, TrendingUp, RefreshCw, Plus, Settings } from "lucide-react";
import { format } from "date-fns";

interface SubscriptionHistoryItem {
  id: string;
  client_id: string;
  from_package_id: string | null;
  to_package_id: string;
  action: string;
  calls_carried_over: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  from_package: {
    name: string;
    slug: string;
  } | null;
  to_package: {
    name: string;
    slug: string;
  };
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export function SubscriptionHistory() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: history, isLoading } = useQuery({
    queryKey: ["subscription-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_history")
        .select(`
          *,
          from_package:pricing_packages!subscription_history_from_package_id_fkey (name, slug),
          to_package:pricing_packages!subscription_history_to_package_id_fkey (name, slug),
          profiles!subscription_history_client_id_fkey (email, full_name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as SubscriptionHistoryItem[];
    },
  });

  const filteredHistory = history?.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.profiles?.email?.toLowerCase().includes(searchLower) ||
      item.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      item.from_package?.name?.toLowerCase().includes(searchLower) ||
      item.to_package?.name?.toLowerCase().includes(searchLower)
    );
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "upgrade":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "renewal":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "initial":
        return <Plus className="h-4 w-4 text-primary" />;
      case "admin_change":
        return <Settings className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "upgrade":
        return "Upgraded";
      case "renewal":
        return "Renewed";
      case "initial":
        return "Initial Assignment";
      case "admin_change":
        return "Admin Change";
      default:
        return action;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Package Change</TableHead>
                <TableHead>Calls Carried Over</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{item.profiles?.full_name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{item.profiles?.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(item.action)}
                      <Badge variant={item.action === "upgrade" ? "default" : "secondary"}>
                        {getActionLabel(item.action)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.from_package ? (
                        <>
                          <span className="text-muted-foreground">{item.from_package.name}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.to_package.name}</span>
                        </>
                      ) : (
                        <span className="font-medium">{item.to_package.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.calls_carried_over !== null && item.calls_carried_over > 0 ? (
                      <Badge variant="outline">
                        +{item.calls_carried_over.toLocaleString()} calls
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </TableCell>
                </TableRow>
              ))}
              {filteredHistory?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No subscription history found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
