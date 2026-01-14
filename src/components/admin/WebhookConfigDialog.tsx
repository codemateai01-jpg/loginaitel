import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Webhook, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface WebhookConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

export function WebhookConfigDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
}: WebhookConfigDialogProps) {
  const [copied, setCopied] = useState(false);

  // Construct the webhook URL using the Supabase project URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/aitel-webhook`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("Webhook URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Configuration
          </DialogTitle>
          <DialogDescription>
            Configure webhook URL for <strong>{agentName}</strong> to receive call status updates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="border-2 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0 border-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-chart-2" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this URL to your agent's webhook configuration in Aitel/Bolna dashboard
            </p>
          </div>

          {/* Agent ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent ID</label>
            <Input
              value={agentId}
              readOnly
              className="border-2 font-mono text-sm bg-muted"
            />
          </div>

          {/* Setup Instructions */}
          <div className="bg-muted/50 border-2 border-border p-4 space-y-3">
            <h4 className="font-medium text-sm">Setup Instructions</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Copy the webhook URL above</li>
              <li>Go to your Aitel/Bolna dashboard</li>
              <li>Open the agent settings for this agent</li>
              <li>Paste the webhook URL in the "Webhook URL" field</li>
              <li>Save the agent configuration</li>
            </ol>
          </div>

          {/* Whitelisted IPs */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Whitelisted IPs</label>
            <div className="text-xs font-mono text-muted-foreground bg-muted p-3 border-2 border-border">
              <p>13.200.45.61</p>
              <p>65.2.44.157</p>
              <p>34.194.233.253</p>
              <p>13.204.98.4</p>
              <p>43.205.31.43</p>
              <p>107.20.118.52</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook requests will come from these IP addresses
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
