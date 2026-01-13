import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Shield, Wrench, Building2, ArrowLeft } from "lucide-react";

const roles = [
  {
    id: "admin",
    title: "Admin",
    description: "Full platform control and management",
    icon: Shield,
    href: "/login/admin",
  },
  {
    id: "engineer",
    title: "Prompt Engineer",
    description: "Build and optimize voice agents",
    icon: Wrench,
    href: "/login/engineer",
  },
  {
    id: "client",
    title: "Client",
    description: "Access agents and analytics",
    icon: Building2,
    href: "/login/client",
  },
];

export default function LoginSelect() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-6 border-b-2 border-border">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <Mic className="h-8 w-8" />
          <span className="font-bold text-xl">VoiceAI</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground mb-8">
            Select your role to continue
          </p>

          <div className="space-y-4">
            {roles.map((role) => (
              <Link key={role.id} to={role.href} className="block">
                <div className="border-2 border-border p-6 hover:shadow-md hover:bg-accent transition-all flex items-center gap-4">
                  <div className="p-3 bg-accent border-2 border-border">
                    <role.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{role.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
