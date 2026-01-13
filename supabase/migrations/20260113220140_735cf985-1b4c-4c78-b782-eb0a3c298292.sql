
-- Add new columns to tasks table for enhanced workflow tracking
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS prompt_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS prompt_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS prompt_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS demo_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS demo_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS prompt_edit_count INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS demo_edit_count INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS selected_demo_call_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS final_score INTEGER;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- Create demo_calls table to track all demo calls made by engineers
CREATE TABLE public.demo_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.bolna_agents(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  external_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  recording_url TEXT,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on demo_calls
ALTER TABLE public.demo_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for demo_calls
CREATE POLICY "Admins have full access to demo_calls" 
ON public.demo_calls 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Engineers can view their own demo calls" 
ON public.demo_calls 
FOR SELECT 
USING (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

CREATE POLICY "Engineers can insert their own demo calls" 
ON public.demo_calls 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

CREATE POLICY "Engineers can update their own demo calls" 
ON public.demo_calls 
FOR UPDATE 
USING (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

-- Create prompt_edit_history table to track prompt changes
CREATE TABLE public.prompt_edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.bolna_agents(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  previous_prompt TEXT,
  new_prompt TEXT NOT NULL,
  edit_phase TEXT NOT NULL DEFAULT 'development', -- 'development' or 'demo'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on prompt_edit_history
ALTER TABLE public.prompt_edit_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompt_edit_history
CREATE POLICY "Admins have full access to prompt_edit_history" 
ON public.prompt_edit_history 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Engineers can view their own prompt history" 
ON public.prompt_edit_history 
FOR SELECT 
USING (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

CREATE POLICY "Engineers can insert their own prompt history" 
ON public.prompt_edit_history 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_demo_calls_task_id ON public.demo_calls(task_id);
CREATE INDEX IF NOT EXISTS idx_demo_calls_engineer_id ON public.demo_calls(engineer_id);
CREATE INDEX IF NOT EXISTS idx_demo_calls_agent_id ON public.demo_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_prompt_edit_history_task_id ON public.prompt_edit_history(task_id);

-- Enable realtime for demo_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_calls;

-- Create function to calculate task score
CREATE OR REPLACE FUNCTION public.calculate_task_score(
  p_task_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_prompt_time_minutes INTEGER;
  v_total_time_minutes INTEGER;
  v_demo_edit_count INTEGER;
  v_time_score INTEGER;
  v_edit_score INTEGER;
  v_demo_quality_score INTEGER;
  v_final_score INTEGER;
  v_score_breakdown JSONB;
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate prompt creation time (from picked_at to prompt_submitted_at)
  IF v_task.prompt_started_at IS NOT NULL AND v_task.prompt_submitted_at IS NOT NULL THEN
    v_prompt_time_minutes := EXTRACT(EPOCH FROM (v_task.prompt_submitted_at - v_task.prompt_started_at)) / 60;
  ELSE
    v_prompt_time_minutes := 0;
  END IF;
  
  -- Calculate total task time
  IF v_task.picked_at IS NOT NULL AND v_task.completed_at IS NOT NULL THEN
    v_total_time_minutes := EXTRACT(EPOCH FROM (v_task.completed_at - v_task.picked_at)) / 60;
  ELSE
    v_total_time_minutes := 0;
  END IF;
  
  -- Get demo edit count
  v_demo_edit_count := COALESCE(v_task.demo_edit_count, 0);
  
  -- Calculate time score (max 40 points) - faster = more points
  -- Base: 40 points, lose 1 point per 10 minutes over 30 minutes
  v_time_score := GREATEST(0, 40 - GREATEST(0, (v_total_time_minutes - 30) / 10));
  
  -- Calculate edit score (max 30 points) - fewer edits = more points
  -- Base: 30 points, lose 5 points per edit during demo phase
  v_edit_score := GREATEST(0, 30 - (v_demo_edit_count * 5));
  
  -- Demo quality score (max 30 points) - based on successful demo completion
  -- This will be set by admin during review
  v_demo_quality_score := 30;
  
  -- Calculate final score
  v_final_score := v_time_score + v_edit_score + v_demo_quality_score;
  
  -- Build score breakdown
  v_score_breakdown := jsonb_build_object(
    'time_score', v_time_score,
    'edit_score', v_edit_score,
    'demo_quality_score', v_demo_quality_score,
    'prompt_time_minutes', v_prompt_time_minutes,
    'total_time_minutes', v_total_time_minutes,
    'demo_edit_count', v_demo_edit_count,
    'max_possible', 100
  );
  
  RETURN v_score_breakdown;
END;
$$;
