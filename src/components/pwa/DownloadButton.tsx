import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface DownloadButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
}

export const DownloadButton = ({ 
  variant = "default", 
  size = "default",
  className = "",
  showIcon = true
}: DownloadButtonProps) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback: redirect to install page with instructions
      window.location.href = "/install";
      return;
    }

    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsInstalling(false);
  };

  if (isInstalled) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        {showIcon && <Check className="h-4 w-4 mr-2" />}
        Installed
      </Button>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleInstallClick}
      disabled={isInstalling}
    >
      {showIcon && (
        isInstalling ? (
          <Smartphone className="h-4 w-4 mr-2 animate-pulse" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )
      )}
      {isInstalling ? "Installing..." : "Download App"}
    </Button>
  );
};
