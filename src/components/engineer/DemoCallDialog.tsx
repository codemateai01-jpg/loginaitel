import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, Loader2, CheckCircle, XCircle } from "lucide-react";

interface DemoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  agentId: string;
  bolnaAgentId: string;
  agentName: string;
}

export function DemoCallDialog({
  open,
  onOpenChange,
  taskId,
  agentId,
  bolnaAgentId,
  agentName,
}: DemoCallDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callResult, setCallResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const makeDemoCallMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      // Create demo call record
      const { data: demoCall, error: insertError } = await supabase
        .from("demo_calls")
        .insert({
          task_id: taskId,
          agent_id: agentId,
          engineer_id: user.id,
          phone_number: phoneNumber,
          status: "initiated",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Make the actual call via Aitel
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-proxy?action=make-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            agent_id: bolnaAgentId,
            recipient_phone_number: phoneNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Update demo call status to failed
        await supabase
          .from("demo_calls")
          .update({ status: "failed" })
          .eq("id", demoCall.id);
        throw new Error(data.error || "Call failed");
      }

      // Update demo call with external ID
      await supabase
        .from("demo_calls")
        .update({
          external_call_id: data.execution_id,
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", demoCall.id);

      return { demoCallId: demoCall.id, executionId: data.execution_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setCallResult({
        success: true,
        message: `Demo call initiated! Execution ID: ${data.executionId}`,
      });
    },
    onError: (error) => {
      setCallResult({
        success: false,
        message: error.message,
      });
    },
  });

  const handleClose = () => {
    setPhoneNumber("");
    setCallResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Make Demo Call
          </DialogTitle>
          <DialogDescription>
            Test {agentName} with a phone call. This call will be logged for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={makeDemoCallMutation.isPending || callResult?.success}
              className="border-2"
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +91 for India)
            </p>
          </div>

          {callResult && (
            <div
              className={`p-4 border-2 ${
                callResult.success
                  ? "border-chart-2 bg-chart-2/10"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              <div className="flex items-start gap-2">
                {callResult.success ? (
                  <CheckCircle className="h-5 w-5 text-chart-2 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <p className="text-sm">{callResult.message}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {callResult?.success ? "Close" : "Cancel"}
          </Button>
          {!callResult?.success && (
            <Button
              onClick={() => makeDemoCallMutation.mutate()}
              disabled={!phoneNumber.trim() || makeDemoCallMutation.isPending}
            >
              {makeDemoCallMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Make Demo Call
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
