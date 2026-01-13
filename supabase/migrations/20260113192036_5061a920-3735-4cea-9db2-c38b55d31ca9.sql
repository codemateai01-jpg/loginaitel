-- Add RLS policy for engineers to view pending unassigned tasks (for picking)
CREATE POLICY "Engineers can view pending unassigned tasks"
ON public.tasks
FOR SELECT
USING (has_role(auth.uid(), 'engineer'::app_role) AND status = 'pending' AND assigned_to IS NULL);

-- Add RLS policy for engineers to pick pending tasks
CREATE POLICY "Engineers can pick pending unassigned tasks"
ON public.tasks
FOR UPDATE
USING (has_role(auth.uid(), 'engineer'::app_role) AND status = 'pending' AND assigned_to IS NULL)
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role) AND assigned_to = auth.uid());

-- Add RLS policy for engineers to view and update agents assigned to them
CREATE POLICY "Engineers can view their assigned agents"
ON public.bolna_agents
FOR SELECT
USING (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());

CREATE POLICY "Engineers can update their assigned agents"
ON public.bolna_agents
FOR UPDATE
USING (has_role(auth.uid(), 'engineer'::app_role) AND engineer_id = auth.uid());