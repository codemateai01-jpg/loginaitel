import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, ArrowDown, MonitorSmartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MonitorSmartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Install Aitel App</CardTitle>
          <CardDescription>
            Install our app for the best experience with quick access from your home screen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">App Installed!</h3>
              <p className="text-muted-foreground mb-4">
                You can now access Aitel from your home screen
              </p>
              <Button onClick={() => navigate("/login")} className="w-full">
                Open App
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Share className="h-4 w-4" />
                  How to install on iPhone/iPad:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tap the <strong>Share</strong> button in Safari</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                  <li>Tap <strong>Add</strong> in the top right</li>
                </ol>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ArrowDown className="h-4 w-4 animate-bounce" />
                <span>Look for the Share button below</span>
              </div>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Benefits of installing:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    Quick access from home screen
                  </li>
                  <li className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    Works offline
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Faster loading times
                  </li>
                </ul>
              </div>
              <Button onClick={handleInstallClick} className="w-full" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Use your browser menu to install this app, or open in Chrome/Edge for the best experience.
              </p>
              <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                Continue to App
              </Button>
            </div>
          )}

          {!isInstalled && (
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className="w-full text-muted-foreground"
              >
                Skip for now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
