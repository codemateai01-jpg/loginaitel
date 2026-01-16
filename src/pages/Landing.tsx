import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/pwa/DownloadButton";
import { SplashScreen } from "@/components/SplashScreen";
import { APP_VERSION } from "@/lib/version";
import {
  Phone,
  Users,
  Settings,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function Landing() {
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenSplash, setHasSeenSplash] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has seen splash in this session
    const seen = sessionStorage.getItem("splash-seen");
    if (seen) {
      setShowSplash(false);
      setHasSeenSplash(true);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setHasSeenSplash(true);
    sessionStorage.setItem("splash-seen", "true");
  };

  if (showSplash && !hasSeenSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={2500} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Aitel" className="h-10 w-10 rounded-xl shadow-sm" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Aitel</h1>
            <p className="text-xs text-muted-foreground">Telecalling Console</p>
          </div>
        </div>
        <DownloadButton size="sm" variant="outline" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Welcome Section */}
        <div className="text-center mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm text-primary font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            AI-Powered Voice Platform
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Welcome to Aitel
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Build and manage intelligent voice agents with advanced analytics and enterprise security.
          </p>
        </div>

        {/* Login Options */}
        <div className="w-full max-w-sm space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Link to="/login/admin" className="block">
            <Button
              variant="outline"
              className="w-full h-16 justify-between text-left px-5 hover:bg-accent/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Admin Portal</div>
                  <div className="text-xs text-muted-foreground">Platform management</div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <Link to="/login/engineer" className="block">
            <Button
              variant="outline"
              className="w-full h-16 justify-between text-left px-5 hover:bg-accent/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Engineer Portal</div>
                  <div className="text-xs text-muted-foreground">Build voice agents</div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <Link to="/login/client" className="block">
            <Button
              variant="outline"
              className="w-full h-16 justify-between text-left px-5 hover:bg-accent/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Client Portal</div>
                  <div className="text-xs text-muted-foreground">Manage campaigns</div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Get Started Button */}
        <div className="mt-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Link to="/login">
            <Button size="lg" className="px-8 shadow-md hover:shadow-lg transition-shadow">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <p className="text-xs text-muted-foreground">
          © 2024 Aitel Platform. All rights reserved.
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {APP_VERSION.full}
        </p>
      </footer>
    </div>
  );
}
