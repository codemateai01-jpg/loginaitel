import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Bot,
  BarChart3,
  Shield,
  Phone,
  Users,
  ArrowRight,
  Zap,
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Bot,
    title: "AI Voice Agents",
    description:
      "Create intelligent voice agents with custom prompts, personalities, and behaviors.",
  },
  {
    icon: Phone,
    title: "Telephony Integration",
    description:
      "Seamless phone number assignment and call management for your campaigns.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Real-time call analytics, transcripts, and AI-powered conversation insights.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "Role-based access control with strict data isolation and encryption.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Manage prompt engineers with task tracking, points, and leaderboards.",
  },
  {
    icon: Zap,
    title: "Credit System",
    description:
      "Flexible prepaid credits with detailed usage tracking and billing.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b-2 border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Aitel" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Telecalling Console</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 border-2 border-border bg-accent text-sm font-medium uppercase tracking-wider">
              Enterprise Voice AI Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Build Intelligent
              <br />
              Voice Agents
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Create, deploy, and manage AI-powered voice agents with advanced
              analytics, team collaboration, and enterprise-grade security.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow">
                  Start Building
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t-2 border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete platform for building, managing, and scaling voice AI
              operations.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="border-2 border-border p-8 bg-card hover:shadow-md transition-shadow group"
              >
                <div className="inline-block p-3 bg-accent border-2 border-border mb-4 group-hover:shadow-sm transition-shadow">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section className="py-20 bg-accent border-y-2 border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Role-Based Access
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tailored dashboards for every team member.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Link
              to="/login/admin"
              className="border-2 border-border bg-card p-8 hover:shadow-lg transition-all group"
            >
              <div className="text-4xl font-bold mb-2">Admin</div>
              <p className="text-muted-foreground mb-4">
                Full platform control, team management, and global analytics.
              </p>
              <span className="text-sm font-medium group-hover:underline">
                Login as Admin →
              </span>
            </Link>
            <Link
              to="/login/engineer"
              className="border-2 border-border bg-card p-8 hover:shadow-lg transition-all group"
            >
              <div className="text-4xl font-bold mb-2">Engineer</div>
              <p className="text-muted-foreground mb-4">
                Build voice agents, complete tasks, and track performance.
              </p>
              <span className="text-sm font-medium group-hover:underline">
                Login as Engineer →
              </span>
            </Link>
            <Link
              to="/login/client"
              className="border-2 border-border bg-card p-8 hover:shadow-lg transition-all group"
            >
              <div className="text-4xl font-bold mb-2">Client</div>
              <p className="text-muted-foreground mb-4">
                Access agents, view call analytics, and manage campaigns.
              </p>
              <span className="text-sm font-medium group-hover:underline">
                Login as Client →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t-2 border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Mic className="h-6 w-6" />
              <span className="font-bold">Aitel</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Aitel Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
