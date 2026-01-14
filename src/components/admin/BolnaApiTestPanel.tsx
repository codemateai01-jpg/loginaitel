import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  Copy,
  Zap,
  Edit,
} from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  endpoint: string;
  method: string;
  status: "success" | "error" | "pending";
  statusCode?: number;
  duration?: number;
  response?: unknown;
  error?: string;
}

export function BolnaApiTestPanel() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [testPrompt, setTestPrompt] = useState("You are a helpful assistant. This is a test prompt update.");
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const updateResult = (index: number, updates: Partial<TestResult>) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const callBolnaProxy = async (
    action: string,
    params: Record<string, string> = {},
    body?: unknown,
    method?: "GET" | "POST" | "PUT"
  ): Promise<{ data: unknown; error: unknown; status: number; duration: number }> => {
    const startTime = Date.now();
    
    const queryParams = new URLSearchParams({ action, ...params });
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-proxy?${queryParams}`;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    const httpMethod = method || (body ? "POST" : "GET");
    
    const response = await fetch(url, {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    let data;
    
    try {
      data = await response.json();
    } catch {
      data = { message: "Non-JSON response" };
    }

    return {
      data: response.ok ? data : null,
      error: response.ok ? null : data,
      status: response.status,
      duration,
    };
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    setExpandedResults(new Set());

    // Test 1: List Agents (GET)
    const listAgentsIdx = results.length;
    addResult({
      endpoint: "list-agents",
      method: "GET",
      status: "pending",
    });

    const listAgentsResult = await callBolnaProxy("list-agents");
    updateResult(0, {
      status: listAgentsResult.error ? "error" : "success",
      statusCode: listAgentsResult.status,
      duration: listAgentsResult.duration,
      response: listAgentsResult.data,
      error: listAgentsResult.error ? JSON.stringify(listAgentsResult.error) : undefined,
    });

    // Extract first agent ID for subsequent tests
    let testAgentId = agentId;
    if (!testAgentId && listAgentsResult.data && Array.isArray(listAgentsResult.data)) {
      testAgentId = listAgentsResult.data[0]?.id;
    }

    // Test 2: List Voices (GET)
    addResult({
      endpoint: "list-voices",
      method: "GET",
      status: "pending",
    });

    const listVoicesResult = await callBolnaProxy("list-voices");
    updateResult(1, {
      status: listVoicesResult.error ? "error" : "success",
      statusCode: listVoicesResult.status,
      duration: listVoicesResult.duration,
      response: listVoicesResult.data,
      error: listVoicesResult.error ? JSON.stringify(listVoicesResult.error) : undefined,
    });

    // Test 3: List Phone Numbers (GET)
    addResult({
      endpoint: "list-phone-numbers",
      method: "GET",
      status: "pending",
    });

    const listPhoneResult = await callBolnaProxy("list-phone-numbers");
    updateResult(2, {
      status: listPhoneResult.error ? "error" : "success",
      statusCode: listPhoneResult.status,
      duration: listPhoneResult.duration,
      response: listPhoneResult.data,
      error: listPhoneResult.error ? JSON.stringify(listPhoneResult.error) : undefined,
    });

    // Test 4: Get Agent (GET with param)
    if (testAgentId) {
      addResult({
        endpoint: `get-agent (${testAgentId.slice(0, 8)}...)`,
        method: "GET",
        status: "pending",
      });

      const getAgentResult = await callBolnaProxy("get-agent", { agent_id: testAgentId });
      updateResult(3, {
        status: getAgentResult.error ? "error" : "success",
        statusCode: getAgentResult.status,
        duration: getAgentResult.duration,
        response: getAgentResult.data,
        error: getAgentResult.error ? JSON.stringify(getAgentResult.error) : undefined,
      });

      // Test 5: List Agent Executions (GET with param)
      addResult({
        endpoint: `list-agent-executions (${testAgentId.slice(0, 8)}...)`,
        method: "GET",
        status: "pending",
      });

      const listExecsResult = await callBolnaProxy("list-agent-executions", { agent_id: testAgentId });
      updateResult(4, {
        status: listExecsResult.error ? "error" : "success",
        statusCode: listExecsResult.status,
        duration: listExecsResult.duration,
        response: listExecsResult.data,
        error: listExecsResult.error ? JSON.stringify(listExecsResult.error) : undefined,
      });
    }

    setIsRunning(false);
    
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    
    if (errorCount === 0) {
      toast.success(`All ${successCount} tests passed!`);
    } else {
      toast.error(`${errorCount} test(s) failed`);
    }
  };

  const runSingleTest = async (action: string, params: Record<string, string> = {}, body?: unknown, method?: "GET" | "POST" | "PUT") => {
    const idx = results.length;
    const displayMethod = method || (body ? "POST" : "GET");
    addResult({
      endpoint: action,
      method: displayMethod,
      status: "pending",
    });

    const result = await callBolnaProxy(action, params, body, method);
    updateResult(idx, {
      status: result.error ? "error" : "success",
      statusCode: result.status,
      duration: result.duration,
      response: result.data,
      error: result.error ? JSON.stringify(result.error) : undefined,
    });

    return result;
  };

  const runUpdatePromptTest = async () => {
    if (!agentId) {
      toast.error("Please enter an Agent ID to test PUT update");
      return;
    }

    setIsRunning(true);
    
    // Step 1: GET current agent config
    const getIdx = results.length;
    addResult({
      endpoint: `get-agent (before update)`,
      method: "GET",
      status: "pending",
    });

    const getResult = await callBolnaProxy("get-agent", { agent_id: agentId });
    updateResult(getIdx, {
      status: getResult.error ? "error" : "success",
      statusCode: getResult.status,
      duration: getResult.duration,
      response: getResult.data,
      error: getResult.error ? JSON.stringify(getResult.error) : undefined,
    });

    if (getResult.error) {
      toast.error("Failed to fetch agent for update test");
      setIsRunning(false);
      return;
    }

    // Extract original config and prompt for comparison
    const agentData = getResult.data as Record<string, unknown>;
    const originalAgentConfig = agentData?.agent_config as Record<string, unknown>;
    const originalPrompt = (agentData?.agent_prompts as Record<string, unknown>)?.task_1 as Record<string, string> | undefined;
    const originalSystemPrompt = originalPrompt?.system_prompt || "N/A";

    // Step 2: PUT update with new system prompt (must include agent_config per Bolna API)
    const putIdx = results.length;
    addResult({
      endpoint: `update-agent (PUT)`,
      method: "PUT",
      status: "pending",
    });

    const updateBody = {
      agent_config: originalAgentConfig,
      agent_prompts: {
        task_1: {
          system_prompt: testPrompt
        }
      }
    };

    const putResult = await callBolnaProxy("update-agent", { agent_id: agentId }, updateBody, "PUT");
    
    updateResult(putIdx, {
      status: putResult.error ? "error" : "success",
      statusCode: putResult.status,
      duration: putResult.duration,
      response: putResult.data,
      error: putResult.error ? JSON.stringify(putResult.error) : undefined,
    });

    if (putResult.error) {
      toast.error("PUT update failed");
      setIsRunning(false);
      return;
    }

    // Step 3: GET agent again to verify change
    const verifyIdx = results.length;
    addResult({
      endpoint: `get-agent (verify update)`,
      method: "GET",
      status: "pending",
    });

    const verifyResult = await callBolnaProxy("get-agent", { agent_id: agentId });
    const verifyData = verifyResult.data as Record<string, unknown>;
    const newPrompt = (verifyData?.agent_prompts as Record<string, unknown>)?.task_1 as Record<string, string> | undefined;
    const newSystemPrompt = newPrompt?.system_prompt || "N/A";
    
    const promptChanged = newSystemPrompt === testPrompt;
    
    updateResult(verifyIdx, {
      status: verifyResult.error ? "error" : (promptChanged ? "success" : "error"),
      statusCode: verifyResult.status,
      duration: verifyResult.duration,
      response: {
        verification: promptChanged ? "✅ Prompt updated successfully!" : "❌ Prompt did NOT change",
        original_prompt: originalSystemPrompt.slice(0, 100) + "...",
        expected_prompt: testPrompt.slice(0, 100) + "...",
        actual_prompt: newSystemPrompt.slice(0, 100) + "...",
        full_response: verifyResult.data,
      },
      error: verifyResult.error ? JSON.stringify(verifyResult.error) : undefined,
    });

    if (promptChanged) {
      toast.success("PUT test passed! System prompt was updated and verified.");
    } else {
      toast.error("PUT test failed! Prompt was not updated.");
    }

    setIsRunning(false);
  };

  const toggleExpanded = (index: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyResponse = (response: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    toast.success("Copied to clipboard");
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const pendingCount = results.filter((r) => r.status === "pending").length;

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-chart-4" />
            Bolna API Test Panel
          </CardTitle>
          {results.length > 0 && (
            <div className="flex gap-2">
              {successCount > 0 && (
                <Badge className="bg-chart-2/20 text-chart-2">
                  {successCount} passed
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge className="bg-destructive/20 text-destructive">
                  {errorCount} failed
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} running</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config Section */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent-id">Test Agent ID (optional)</Label>
            <Input
              id="agent-id"
              placeholder="Will use first agent if empty"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>
        </div>

        {/* PUT Test Section */}
        <div className="space-y-2 p-4 border-2 border-dashed border-chart-4/50 bg-chart-4/5">
          <div className="flex items-center gap-2 mb-2">
            <Edit className="h-4 w-4 text-chart-4" />
            <span className="font-medium text-sm">PUT Test: Update System Prompt</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-prompt">New System Prompt</Label>
            <Textarea
              id="test-prompt"
              placeholder="Enter new system prompt to test..."
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <Button
            onClick={runUpdatePromptTest}
            disabled={isRunning || !agentId}
            className="w-full"
            variant="secondary"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing PUT Update...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Run PUT Update Test
              </>
            )}
          </Button>
          {!agentId && (
            <p className="text-xs text-muted-foreground">Enter an Agent ID above to enable PUT testing</p>
          )}
        </div>

        {/* Individual Test Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runSingleTest("list-agents")}
            disabled={isRunning}
          >
            List Agents
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runSingleTest("list-voices")}
            disabled={isRunning}
          >
            List Voices
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runSingleTest("list-phone-numbers")}
            disabled={isRunning}
          >
            List Phone Numbers
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runSingleTest("list-batches")}
            disabled={isRunning}
          >
            List Batches
          </Button>
          {agentId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSingleTest("get-agent", { agent_id: agentId })}
              disabled={isRunning}
            >
              Get Agent
            </Button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">
              Test Results
            </h4>
            <ScrollArea className="h-[400px] border-2 border-border p-2">
              <div className="space-y-2">
                {results.map((result, idx) => (
                  <Collapsible
                    key={idx}
                    open={expandedResults.has(idx)}
                    onOpenChange={() => toggleExpanded(idx)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted cursor-pointer border border-border">
                        <div className="flex items-center gap-3">
                          {result.status === "pending" && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {result.status === "success" && (
                            <CheckCircle className="h-4 w-4 text-chart-2" />
                          )}
                          {result.status === "error" && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-mono text-sm">
                            {result.method}
                          </span>
                          <span className="font-medium">{result.endpoint}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.statusCode && (
                            <Badge
                              variant={
                                result.statusCode < 400 ? "default" : "destructive"
                              }
                            >
                              {result.statusCode}
                            </Badge>
                          )}
                          {result.duration && (
                            <span className="text-xs text-muted-foreground">
                              {result.duration}ms
                            </span>
                          )}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedResults.has(idx) ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border border-t-0 border-border p-3 bg-background">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            {result.error ? "Error" : "Response"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyResponse(result.response || result.error)
                            }
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <Textarea
                          readOnly
                          className="font-mono text-xs min-h-[100px]"
                          value={JSON.stringify(
                            result.response || result.error,
                            null,
                            2
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Click "Run All Tests" to test Bolna API endpoints</p>
            <p className="text-sm">
              Tests: list-agents, list-voices, list-phone-numbers, get-agent, list-executions
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}