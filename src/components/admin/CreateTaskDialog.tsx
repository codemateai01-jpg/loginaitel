import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string | null;
    points: number;
    deadline: string | null;
    aitel_agent_id: string | null;
    assigned_to: string | null;
  } | null;
}

export function CreateTaskDialog({ open, onOpenChange, task }: CreateTaskDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [points, setPoints] = useState(task?.points?.toString() || "100");
  const [deadline, setDeadline] = useState(task?.deadline?.split("T")[0] || "");
  const [selectedAgentId, setSelectedAgentId] = useState(task?.aitel_agent_id || "");
  const [selectedEngineerId, setSelectedEngineerId] = useState(task?.assigned_to || "");

  // Fetch agents for selection (include all statuses except inactive)
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["aitel-agents-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name, client_id, status")
        .neq("status", "inactive")
        .order("agent_name");
      if (error) {
        console.error("Error fetching agents:", error);
        throw error;
      }
      return data || [];
    },
  });

  // Fetch engineers for assignment
  const { data: engineers } = useQuery({
    queryKey: ["engineers-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "engineer");
      if (error) throw error;
      
      // Get profiles for these engineers
      const userIds = data.map(r => r.user_id);
      if (userIds.length === 0) return [];
      
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      return profiles;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // When admin assigns an engineer, task stays "pending" so engineer can pick it
      // The assignment just restricts visibility to that engineer
      const taskData = {
        title,
        description: description || null,
        points: parseInt(points) || 100,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        aitel_agent_id: selectedAgentId || null,
        assigned_to: selectedEngineerId || null,
        created_by: user.id,
        status: "pending",
        picked_at: null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert(taskData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success(isEditing ? "Task updated" : "Task created");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to ${isEditing ? "update" : "create"} task: ${error.message}`);
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPoints("100");
    setDeadline("");
    setSelectedAgentId("");
    setSelectedEngineerId("");
  };

  // Reset form when task changes
  useState(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPoints(task.points?.toString() || "100");
      setDeadline(task.deadline?.split("T")[0] || "");
      setSelectedAgentId(task.aitel_agent_id || "");
      setSelectedEngineerId(task.assigned_to || "");
    } else {
      resetForm();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Healthcare Support Agent"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task requirements..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent">Assign Agent</Label>
            <Select value={selectedAgentId || "none"} onValueChange={(v) => setSelectedAgentId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={agentsLoading ? "Loading agents..." : "Select an agent to assign"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No agent</SelectItem>
                {agents && agents.length > 0 ? (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.agent_name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-agents" disabled>
                    No agents available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {agents?.length === 0 && !agentsLoading && (
              <p className="text-xs text-muted-foreground">
                Sync agents from the Agents page first
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="engineer">Assign Engineer</Label>
            <Select value={selectedEngineerId || "none"} onValueChange={(v) => setSelectedEngineerId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select an engineer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {engineers?.map((engineer) => (
                  <SelectItem key={engineer.user_id} value={engineer.user_id}>
                    {engineer.full_name || engineer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!title || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : isEditing ? "Update Task" : "Create Task"}
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
