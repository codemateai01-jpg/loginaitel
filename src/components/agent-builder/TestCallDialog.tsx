import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface TestCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  onTestCall: (phoneNumber: string) => Promise<{ success: boolean; message: string }>;
}

export function TestCallDialog({
  open,
  onOpenChange,
  agentName,
  onTestCall,
}: TestCallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestCall = async () => {
    if (!phoneNumber) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await onTestCall(phoneNumber);
      setResult(res);
    } catch {
      setResult({ success: false, message: "Failed to initiate test call" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPhoneNumber("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Test Call
          </DialogTitle>
          <DialogDescription>
            Test your agent "{agentName}" by making a call to a phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="border-2"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter phone number with country code (e.g., +91 for India)
            </p>
          </div>

          {/* Result Display */}
          {result && (
            <div
              className={`p-4 border-2 ${
                result.success
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className={result.success ? "text-green-700 dark:text-green-300" : "text-destructive"}>
                  {result.message}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleTestCall} disabled={isLoading || !phoneNumber}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Make Test Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
