import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Bell, RefreshCw, Loader2, AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreditSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings?: {
    low_balance_threshold: number | null;
    low_balance_alert_enabled: boolean | null;
    auto_recharge_enabled: boolean | null;
    auto_recharge_amount: number | null;
    auto_recharge_trigger_balance: number | null;
  };
  onSuccess: () => void;
}

export function CreditSettingsDialog({
  open,
  onOpenChange,
  currentSettings,
  onSuccess,
}: CreditSettingsDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Low balance alert settings
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("50");

  // Auto-recharge settings
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [autoRechargeAmount, setAutoRechargeAmount] = useState("500");
  const [autoRechargeTrigger, setAutoRechargeTrigger] = useState("100");

  useEffect(() => {
    if (currentSettings) {
      setAlertEnabled(currentSettings.low_balance_alert_enabled || false);
      setAlertThreshold(String(currentSettings.low_balance_threshold || 50));
      setAutoRechargeEnabled(currentSettings.auto_recharge_enabled || false);
      setAutoRechargeAmount(String(currentSettings.auto_recharge_amount || 500));
      setAutoRechargeTrigger(String(currentSettings.auto_recharge_trigger_balance || 100));
    }
  }, [currentSettings]);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("client_credits")
        .update({
          low_balance_alert_enabled: alertEnabled,
          low_balance_threshold: parseInt(alertThreshold) || 50,
          auto_recharge_enabled: autoRechargeEnabled,
          auto_recharge_amount: parseInt(autoRechargeAmount) || 500,
          auto_recharge_trigger_balance: parseInt(autoRechargeTrigger) || 100,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", user.id);

      if (error) throw error;

      toast.success("Settings saved successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Credit Settings
          </DialogTitle>
          <DialogDescription>
            Configure alerts and auto-recharge for your credits
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh] pr-4">
          <div className="space-y-6">
          {/* Low Balance Alerts */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30">
                    <Bell className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Low Balance Alert</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when credits are low
                    </p>
                  </div>
                </div>
                <Switch
                  checked={alertEnabled}
                  onCheckedChange={setAlertEnabled}
                />
              </div>

              {alertEnabled && (
                <div className="space-y-2 pl-12">
                  <Label htmlFor="alert-threshold">Alert when balance below</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="alert-threshold"
                      type="number"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                      min={10}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">credits</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Auto-Recharge */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30">
                    <RefreshCw className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Auto-Recharge</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically buy credits when low
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoRechargeEnabled}
                  onCheckedChange={setAutoRechargeEnabled}
                />
              </div>

              {autoRechargeEnabled && (
                <div className="space-y-4 pl-12">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Auto-recharge will automatically initiate a payment when your balance drops below the trigger amount.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trigger-balance">When balance drops below</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="trigger-balance"
                        type="number"
                        value={autoRechargeTrigger}
                        onChange={(e) => setAutoRechargeTrigger(e.target.value)}
                        min={10}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">credits</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recharge-amount">Buy this many credits</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="recharge-amount"
                        type="number"
                        value={autoRechargeAmount}
                        onChange={(e) => setAutoRechargeAmount(e.target.value)}
                        min={100}
                        step={100}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">credits</span>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 border-2 border-border flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <p className="text-sm">
                      Will auto-buy <strong>{autoRechargeAmount}</strong> credits when balance hits <strong>{autoRechargeTrigger}</strong>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
