import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Save,
  Phone,
  Play,
  Mic,
  Settings,
  Volume2,
} from "lucide-react";
import { useState } from "react";

export default function AgentBuilder() {
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState("");

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent border-2 border-border">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agent Builder</h1>
              <p className="text-sm text-muted-foreground">
                Create and configure voice agents
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="shadow-xs">
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="shadow-sm">
              Submit for Approval
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="border-2 border-border bg-card p-6">
              <h2 className="font-bold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Customer Support Agent"
                    className="border-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the agent's purpose"
                    className="border-2"
                  />
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="border-2 border-border bg-card p-6">
              <h2 className="font-bold mb-4">System Prompt</h2>
              <Textarea
                placeholder="Define the agent's personality, behavior, and knowledge base..."
                className="min-h-[200px] border-2 font-mono text-sm"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {systemPrompt.length} characters
              </p>
            </div>

            {/* Voice Configuration */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="h-5 w-5" />
                <h2 className="font-bold">Voice Configuration</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                      <SelectItem value="echo">Echo (Male)</SelectItem>
                      <SelectItem value="fable">Fable (Female)</SelectItem>
                      <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                      <SelectItem value="nova">Nova (Soft Female)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-IN">English (India)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="hi-IN">Hindi</SelectItem>
                      <SelectItem value="ta-IN">Tamil</SelectItem>
                      <SelectItem value="te-IN">Telugu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            {/* LLM Settings */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5" />
                <h2 className="font-bold">LLM Settings</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-sm font-mono">{temperature[0]}</span>
                  </div>
                  <Slider
                    value={temperature}
                    onValueChange={setTemperature}
                    max={1}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>
              </div>
            </div>

            {/* Transcriber */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mic className="h-5 w-5" />
                <h2 className="font-bold">Transcriber (STT)</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepgram">Deepgram</SelectItem>
                      <SelectItem value="whisper">Whisper</SelectItem>
                      <SelectItem value="google">Google STT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Telephony */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="h-5 w-5" />
                <h2 className="font-bold">Telephony</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="plivo">Plivo</SelectItem>
                      <SelectItem value="exotel">Exotel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Test Button (Disabled) */}
            <Button
              variant="outline"
              className="w-full shadow-xs"
              disabled
            >
              <Play className="h-4 w-4 mr-2" />
              Test Agent (Awaiting Approval)
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
