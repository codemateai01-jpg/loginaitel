-- Drop old agents table (we're starting fresh)
DROP TABLE IF EXISTS public.agents CASCADE;

-- Create new bolna_agents table - stores agents synced from Bolna
CREATE TABLE public.bolna_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bolna_agent_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  client_id UUID,  -- Which client this agent is assigned to (NULL = unassigned)
  original_system_prompt TEXT,  -- The original prompt from Bolna
  current_system_prompt TEXT,   -- The current/modified prompt
  agent_config JSONB DEFAULT '{}'::jsonb,  -- Full agent config from Bolna
  status TEXT NOT NULL DEFAULT 'active',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add bolna_agent_id to tasks table for agent assignment
ALTER TABLE public.tasks 
ADD COLUMN bolna_agent_id UUID REFERENCES public.bolna_agents(id);

-- Enable RLS
ALTER TABLE public.bolna_agents ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to bolna_agents"
ON public.bolna_agents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Engineers can view agents assigned to their tasks
CREATE POLICY "Engineers can view agents via tasks"
ON public.bolna_agents FOR SELECT
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND id IN (
    SELECT bolna_agent_id FROM public.tasks 
    WHERE assigned_to = auth.uid() AND bolna_agent_id IS NOT NULL
  )
);

-- Engineers can update only the current_system_prompt of agents via tasks
CREATE POLICY "Engineers can update agent prompts via tasks"
ON public.bolna_agents FOR UPDATE
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND id IN (
    SELECT bolna_agent_id FROM public.tasks 
    WHERE assigned_to = auth.uid() AND bolna_agent_id IS NOT NULL
  )
);

-- Clients can view their assigned agents
CREATE POLICY "Clients can view their agents"
ON public.bolna_agents FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id = auth.uid()
);

-- Update trigger for updated_at
CREATE TRIGGER update_bolna_agents_updated_at
BEFORE UPDATE ON public.bolna_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();