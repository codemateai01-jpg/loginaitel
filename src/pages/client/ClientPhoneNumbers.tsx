import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Search, RefreshCw, Globe, Clock, Bot, DollarSign } from "lucide-react";
import { listPhoneNumbers, searchPhoneNumbers, PhoneNumber, AvailablePhoneNumber } from "@/lib/bolna";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ClientPhoneNumbers() {
  const [searchCountry, setSearchCountry] = useState<"US" | "IN">("US");
  const [searchPattern, setSearchPattern] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailablePhoneNumber[]>([]);

  // Fetch owned phone numbers
  const { data: phoneNumbers, isLoading, refetch } = useQuery({
    queryKey: ["phone-numbers"],
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
        .from("bolna_agents")
        .select("bolna_agent_id, agent_name");
      if (error) throw error;
      return data || [];
    },
  });

  const getAgentName = (agentId?: string) => {
    if (!agentId || !agents) return "Unassigned";
    const agent = agents.find((a) => a.bolna_agent_id === agentId);
    return agent?.agent_name || "Unknown Agent";
  };

  const handleSearch = async () => {
    if (searchPattern && searchPattern.length !== 3) {
      toast.error("Pattern must be exactly 3 characters (e.g., 415)");
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchPhoneNumbers({
        country: searchCountry,
        pattern: searchPattern || undefined,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setSearchResults(response.data || []);
      if ((response.data || []).length === 0) {
        toast.info("No phone numbers found matching your criteria");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
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

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Phone Numbers</h1>
            <p className="text-muted-foreground">
              View and manage phone numbers for your voice agents
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Numbers</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{phoneNumbers?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned to Agents</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {phoneNumbers?.filter((p) => p.agent_id).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rented Numbers</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {phoneNumbers?.filter((p) => p.rented).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="owned" className="space-y-4">
          <TabsList>
            <TabsTrigger value="owned">My Numbers</TabsTrigger>
            <TabsTrigger value="search">Search Available</TabsTrigger>
          </TabsList>

          {/* Owned Numbers Tab */}
          <TabsContent value="owned" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Phone Numbers</CardTitle>
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
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Assigned Agent</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Renewal</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.map((phone) => (
                        <TableRow key={phone.id}>
                          <TableCell className="font-mono font-medium">
                            {phone.phone_number}
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
                          <TableCell>{phone.price || "—"}</TableCell>
                          <TableCell>
                            {phone.renewal_at ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3 w-3" />
                                {phone.renewal_at}
                              </div>
                            ) : (
                              "—"
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
                    <p className="text-sm">Search for available numbers to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Available Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Form */}
                <div className="flex gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Select
                      value={searchCountry}
                      onValueChange={(v) => setSearchCountry(v as "US" | "IN")}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            US
                          </div>
                        </SelectItem>
                        <SelectItem value="IN">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            IN
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">
                      Pattern (optional, 3 digits like 415)
                    </label>
                    <Input
                      placeholder="e.g., 415"
                      value={searchPattern}
                      onChange={(e) => setSearchPattern(e.target.value.slice(0, 3))}
                      maxLength={3}
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
                    {isSearching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Locality</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((phone, index) => (
                        <TableRow key={`${phone.phone_number}-${index}`}>
                          <TableCell className="font-mono font-medium">
                            {phone.phone_number}
                          </TableCell>
                          <TableCell>{phone.region || "—"}</TableCell>
                          <TableCell>{phone.locality || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">${phone.price}/mo</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Search for available phone numbers</p>
                    <p className="text-sm">Select a country and optionally enter a 3-digit pattern</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
