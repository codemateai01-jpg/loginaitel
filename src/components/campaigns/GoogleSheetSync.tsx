import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileSpreadsheet, 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink 
} from "lucide-react";

interface GoogleSheetSyncProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  existingSheetId?: string | null;
}

interface SyncResult {
  success: boolean;
  imported?: number;
  skipped_duplicates?: number;
  error?: string;
  sample_leads?: Array<{ name: string; phone: string }>;
}

export function GoogleSheetSync({
  open,
  onOpenChange,
  campaignId,
  existingSheetId,
}: GoogleSheetSyncProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke("sync-google-sheet", {
        body: { 
          campaign_id: campaignId,
          sheet_url: url || undefined 
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data as SyncResult;
    },
    onSuccess: (data) => {
      setSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      
      if (data.imported && data.imported > 0) {
        toast({ 
          title: "Sync complete", 
          description: `${data.imported} new leads imported` 
        });
      }
    },
    onError: (error: Error) => {
      setSyncResult({ success: false, error: error.message });
    },
  });

  const handleSync = () => {
    setSyncResult(null);
    syncMutation.mutate(sheetUrl);
  };

  const handleClose = () => {
    setSyncResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Google Sheets Sync
          </DialogTitle>
          <DialogDescription>
            Import leads from a Google Spreadsheet. The sheet must be shared publicly or published to web.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {existingSheetId ? (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Sheet connected: <code className="text-xs">{existingSheetId.substring(0, 20)}...</code>
                <br />
                <span className="text-muted-foreground text-xs">
                  Click sync to fetch new leads, or enter a new URL to change the source.
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sheet-url">Google Sheet URL</Label>
            <Input
              id="sheet-url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Paste the full URL of your Google Sheet. Required columns: <code>phone</code> or <code>phone_number</code>
            </p>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
            <p className="font-medium">How to share your sheet:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Open your Google Sheet</li>
              <li>Click <strong>Share</strong> → <strong>Anyone with the link</strong> → <strong>Viewer</strong></li>
              <li>Copy the URL and paste it above</li>
            </ol>
            <a 
              href="https://support.google.com/docs/answer/183965" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Learn more <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Sync Result */}
          {syncResult && (
            <Alert variant={syncResult.success ? "default" : "destructive"}>
              {syncResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {syncResult.success ? (
                  <div className="space-y-1">
                    <p><strong>{syncResult.imported}</strong> new leads imported</p>
                    {syncResult.skipped_duplicates && syncResult.skipped_duplicates > 0 && (
                      <p className="text-muted-foreground text-xs">
                        {syncResult.skipped_duplicates} duplicates skipped
                      </p>
                    )}
                    {syncResult.sample_leads && syncResult.sample_leads.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <p>Sample imports:</p>
                        <ul className="list-disc list-inside">
                          {syncResult.sample_leads.map((lead, i) => (
                            <li key={i}>{lead.name} - {lead.phone}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{syncResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Required columns info */}
          <div className="border rounded-lg p-3 text-sm">
            <p className="font-medium mb-2">Expected columns:</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-green-500/10 text-green-700 px-2 py-1 rounded">
                phone_number *
              </div>
              <div className="bg-muted px-2 py-1 rounded">
                name
              </div>
              <div className="bg-muted px-2 py-1 rounded">
                email
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * Required. Additional columns are saved as custom fields.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSync}
            disabled={syncMutation.isPending || (!sheetUrl && !existingSheetId)}
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {existingSheetId && !sheetUrl ? "Sync Now" : "Connect & Sync"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
