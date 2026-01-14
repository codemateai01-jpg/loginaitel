import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Phone,
  Users,
  Search,
  Upload,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  FileText,
  X,
  Download,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createBatch, listPhoneNumbers, type PhoneNumber } from "@/lib/bolna";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  status: string;
  created_at: string;
}

type BatchSource = "leads" | "csv";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-chart-4 text-chart-4" },
  called: { label: "Called", className: "border-chart-2 text-chart-2" },
  completed: { label: "Completed", className: "bg-chart-2 text-chart-2-foreground" },
  failed: { label: "Failed", className: "border-destructive text-destructive" },
  no_answer: { label: "No Answer", className: "border-chart-5 text-chart-5" },
};

export default function CreateBatchCampaign() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  
  // Source selection
  const [batchSource, setBatchSource] = useState<BatchSource>("leads");
  
  // Lead selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  
  // Agent and phone selection
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-for-batch", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone_number, email, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user?.id,
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["aitel-agents-for-batch-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name, external_agent_id")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch phone numbers
  const { data: phoneNumbers } = useQuery({
    queryKey: ["phone-numbers-for-batch"],
    queryFn: async () => {
      const result = await listPhoneNumbers();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });

  // Filter leads
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      const matchesSearch =
        searchQuery === "" ||
        lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone_number.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  // Selection handlers
  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  // CSV handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setCsvFile(file);
    const content = await file.text();
    setCsvContent(content);
  };

  const handleRemoveFile = () => {
    setCsvFile(null);
    setCsvContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadSampleCsv = () => {
    const sampleCsv = `contact_number,name,company
+919876543210,John Doe,Acme Corp
+919876543211,Jane Smith,Tech Inc
+919876543212,Bob Johnson,StartupXYZ`;
    
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate CSV from selected leads
  const generateCsvFromLeads = () => {
    const selectedLeadsList = leads?.filter((l) => selectedLeads.has(l.id)) || [];
    const csvHeader = "contact_number,name,email";
    const csvRows = selectedLeadsList.map(
      (lead) => `${lead.phone_number},${lead.name || ""},${lead.email || ""}`
    );
    return [csvHeader, ...csvRows].join("\n");
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedAgent) {
      toast.error("Please select an agent");
      return;
    }

    const agent = agents?.find((a) => a.id === selectedAgent);
    if (!agent?.external_agent_id) {
      toast.error("Invalid agent selected");
      return;
    }

    let finalCsvContent: string;
    if (batchSource === "leads") {
      if (selectedLeads.size === 0) {
        toast.error("Please select at least one lead");
        return;
      }
      finalCsvContent = generateCsvFromLeads();
    } else {
      if (!csvContent) {
        toast.error("Please upload a CSV file");
        return;
      }
      finalCsvContent = csvContent;
    }

    setIsSubmitting(true);
    try {
      const result = await createBatch({
        agent_id: agent.external_agent_id,
        csv_content: finalCsvContent,
        from_phone_number: selectedPhoneNumber || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Batch campaign created successfully!`);
      navigate("/client/batches");
    } catch (error) {
      toast.error("Failed to create batch campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation for step navigation
  const canProceedToStep2 = () => {
    if (batchSource === "leads") {
      return selectedLeads.size > 0;
    }
    return !!csvContent;
  };

  const canProceedToStep3 = () => {
    return !!selectedAgent;
  };

  return (
    <DashboardLayout role={role === "admin" ? "admin" : "client"}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client/batches")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Batch Campaign</h1>
            <p className="text-muted-foreground">
              Select leads, choose an agent, and start your batch calling campaign
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold transition-colors ${
                  currentStep >= step
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {currentStep > step ? <CheckCircle className="h-5 w-5" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-16 h-1 mx-2 rounded ${
                    currentStep > step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-16 text-sm text-muted-foreground">
          <span className={currentStep >= 1 ? "text-foreground font-medium" : ""}>
            Select Recipients
          </span>
          <span className={currentStep >= 2 ? "text-foreground font-medium" : ""}>
            Choose Agent
          </span>
          <span className={currentStep >= 3 ? "text-foreground font-medium" : ""}>
            Review & Launch
          </span>
        </div>

        {/* Step 1: Select Recipients */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Recipients
              </CardTitle>
              <CardDescription>
                Choose leads from your database or upload a CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Source Selection */}
              <div className="flex gap-4">
                <Button
                  variant={batchSource === "leads" ? "default" : "outline"}
                  onClick={() => setBatchSource("leads")}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Select from Leads
                </Button>
                <Button
                  variant={batchSource === "csv" ? "default" : "outline"}
                  onClick={() => setBatchSource("csv")}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
              </div>

              {batchSource === "leads" ? (
                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="called">Called</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="no_answer">No Answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selection Summary */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm">
                      <span className="font-medium">{selectedLeads.size}</span> of{" "}
                      <span className="font-medium">{filteredLeads.length}</span> leads selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                      {selectedLeads.size === filteredLeads.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>

                  {/* Leads Table */}
                  <div className="border-2 border-border rounded-lg max-h-[400px] overflow-auto">
                    {leadsLoading ? (
                      <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredLeads.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={
                                  filteredLeads.length > 0 &&
                                  selectedLeads.size === filteredLeads.length
                                }
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLeads.map((lead) => (
                            <TableRow
                              key={lead.id}
                              className={`cursor-pointer ${
                                selectedLeads.has(lead.id) ? "bg-primary/5" : ""
                              }`}
                              onClick={() => toggleLeadSelection(lead.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedLeads.has(lead.id)}
                                  onCheckedChange={() => toggleLeadSelection(lead.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {lead.name || "Unknown"}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {lead.phone_number}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {lead.email || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={statusConfig[lead.status]?.className || ""}
                                >
                                  {statusConfig[lead.status]?.label || lead.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                        <Users className="h-12 w-12 mb-4" />
                        <p className="text-sm">No leads found</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* CSV Upload */}
                  <div className="flex items-center justify-between">
                    <Label>Upload CSV File</Label>
                    <Button variant="ghost" size="sm" onClick={downloadSampleCsv}>
                      <Download className="h-3 w-3 mr-1" />
                      Sample CSV
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!csvFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">Click to upload CSV</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Must include recipient_phone_number column. Max 5MB.
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-lg">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{csvFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(csvFile.size / 1024).toFixed(1)} KB •{" "}
                            {csvContent.split("\n").length - 1} rows
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* CSV Preview */}
                  {csvContent && (
                    <div className="space-y-2">
                      <Label>Preview (first 5 rows)</Label>
                      <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre">
                          {csvContent.split("\n").slice(0, 6).join("\n")}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose Agent */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Choose Agent & Settings
              </CardTitle>
              <CardDescription>
                Select the AI agent that will make the calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agent Selection */}
              <div className="space-y-2">
                <Label>AI Agent *</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent for the campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agent_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phone Number Selection */}
              <div className="space-y-2">
                <Label>From Phone Number (Optional)</Label>
                <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Use default or select a specific number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default Number</SelectItem>
                    {phoneNumbers?.map((phone: PhoneNumber) => (
                      <SelectItem key={phone.id} value={phone.phone_number}>
                        {phone.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave as default to use the agent's configured phone number
                </p>
              </div>

              {/* Agent Info Card */}
              {selectedAgent && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {agents?.find((a) => a.id === selectedAgent)?.agent_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Will call{" "}
                        {batchSource === "leads"
                          ? `${selectedLeads.size} leads`
                          : `${csvContent.split("\n").length - 1} contacts`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Launch */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Review & Launch Campaign
              </CardTitle>
              <CardDescription>
                Review your campaign details before launching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campaign Summary */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Recipients</p>
                  <p className="text-2xl font-bold">
                    {batchSource === "leads"
                      ? selectedLeads.size
                      : csvContent.split("\n").length - 1}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {batchSource === "leads" ? "From your leads database" : "From uploaded CSV"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">AI Agent</p>
                  <p className="text-2xl font-bold">
                    {agents?.find((a) => a.id === selectedAgent)?.agent_name || "Not selected"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPhoneNumber && selectedPhoneNumber !== "default"
                      ? `From: ${selectedPhoneNumber}`
                      : "Using default number"}
                  </p>
                </div>
              </div>

              {/* Selected Leads Preview */}
              {batchSource === "leads" && selectedLeads.size > 0 && (
                <div className="space-y-2">
                  <Label>Selected Leads Preview</Label>
                  <div className="border-2 border-border rounded-lg max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads
                          ?.filter((l) => selectedLeads.has(l.id))
                          .slice(0, 5)
                          .map((lead) => (
                            <TableRow key={lead.id}>
                              <TableCell>{lead.name || "Unknown"}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {lead.phone_number}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={statusConfig[lead.status]?.className || ""}
                                >
                                  {statusConfig[lead.status]?.label || lead.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedLeads.size > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ...and {selectedLeads.size - 5} more leads
                    </p>
                  )}
                </div>
              )}

              {/* Warning Notice */}
              <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-4">
                <p className="text-sm">
                  <strong>Note:</strong> Once launched, the batch campaign will begin making calls
                  immediately. Make sure you have sufficient credits and the agent is properly
                  configured.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={
                (currentStep === 1 && !canProceedToStep2()) ||
                (currentStep === 2 && !canProceedToStep3())
              }
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Launch Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
