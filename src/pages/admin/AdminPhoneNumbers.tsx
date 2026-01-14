import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, RefreshCw, Bot, DollarSign, Users, Link } from "lucide-react";
import { listPhoneNumbers, PhoneNumber } from "@/lib/bolna";
import { supabase } from "@/integrations/supabase/client";
import { PhoneNumberAssignment } from "@/components/phone/PhoneNumberAssignment";

// Mask phone number for admin view: +91 ******4321
const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return "—";
  
  // Keep country code and last 4 digits
  const cleaned = phoneNumber.replace(/\s/g, "");
  if (cleaned.length < 8) return "******" + cleaned.slice(-4);
  
  // Find where the country code ends (usually after + and 1-3 digits)
  const match = cleaned.match(/^(\+\d{1,3})/);
  const countryCode = match ? match[1] : "";
  const lastFour = cleaned.slice(-4);
  
  return `${countryCode} ******${lastFour}`;
};

export default function AdminPhoneNumbers() {
  // Fetch all phone numbers
  const { data: phoneNumbers, isLoading, refetch } = useQuery({
    queryKey: ["admin-phone-numbers"],
    queryFn: async () => {
      const response = await listPhoneNumbers();
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
  });

  // Fetch agents for mapping
  const { data: agents } = useQuery({
    queryKey: ["bolna-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents" as any)
        .select("external_agent_id, agent_name, client_id");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch profiles for client names
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");
      if (error) throw error;
      return data || [];
    },
  });

  const getAgentName = (agentId?: string) => {
    if (!agentId || !agents) return "Unassigned";
    const agent = agents.find((a: any) => a.external_agent_id === agentId);
    return agent?.agent_name || "Unknown Agent";
  };

  const getClientName = (agentId?: string) => {
    if (!agentId || !agents || !profiles) return "—";
    const agent = agents.find((a: any) => a.external_agent_id === agentId);
    if (!agent?.client_id) return "Unassigned";
    const profile = profiles.find((p) => p.user_id === agent.client_id);
    return profile?.full_name || profile?.email || "Unknown Client";
  };

  const getProviderBadgeVariant = (provider: string) => {
    switch (provider) {
      case "twilio":
        return "default";
      case "plivo":
        return "secondary";
      case "vonage":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Calculate stats
  const totalNumbers = phoneNumbers?.length || 0;
  const assignedToAgents = phoneNumbers?.filter((p) => p.agent_id).length || 0;
  const rentedNumbers = phoneNumbers?.filter((p) => p.rented).length || 0;
  const uniqueClients = new Set(
    phoneNumbers
      ?.map((p) => {
        const agent = agents?.find((a: any) => a.external_agent_id === p.agent_id);
        return agent?.client_id;
      })
      .filter(Boolean)
  ).size;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Phone Numbers</h1>
            <p className="text-muted-foreground">
              Overview of all phone numbers across the platform
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Numbers</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalNumbers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned to Agents</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedToAgents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rented Numbers</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rentedNumbers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients Using</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueClients}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Overview and Assignment */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignment">
              <Link className="h-4 w-4 mr-2" />
              Assign to Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Phone Numbers Table */}
            <Card>
              <CardHeader>
                <CardTitle>All Phone Numbers</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : phoneNumbers && phoneNumbers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number (Masked)</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Assigned Agent</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.map((phone) => (
                        <TableRow key={phone.id}>
                          <TableCell className="font-mono font-medium">
                            {maskPhoneNumber(phone.phone_number)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getProviderBadgeVariant(phone.telephony_provider)}>
                              {phone.telephony_provider}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground" />
                              <span>{getAgentName(phone.agent_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{getClientName(phone.agent_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {phone.rented ? (
                              <Badge variant="default">Rented</Badge>
                            ) : phone.agent_id ? (
                              <Badge variant="secondary">Assigned</Badge>
                            ) : (
                              <Badge variant="outline">Available</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {phone.humanized_created_at || new Date(phone.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No phone numbers found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignment">
            <PhoneNumberAssignment showClientColumn={true} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
