
-- Drop problematic leads policies
DROP POLICY IF EXISTS "Admins cannot directly access leads" ON public.leads;

-- Create proper admin access to leads
CREATE POLICY "Admins have full access to leads" 
ON public.leads 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add SELECT policy for engineers to view leads for their agents' clients
CREATE POLICY "Engineers can view leads for their agents clients" 
ON public.leads 
FOR SELECT 
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND client_id IN (
    SELECT DISTINCT ba.client_id 
    FROM aitel_agents ba 
    WHERE ba.engineer_id = auth.uid() 
    AND ba.client_id IS NOT NULL
  )
);

-- Add UPDATE policy for engineers on leads they created
CREATE POLICY "Engineers can update leads they created" 
ON public.leads 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND uploaded_by = auth.uid()
);

-- Add DELETE policy for engineers on leads they created
CREATE POLICY "Engineers can delete leads they created" 
ON public.leads 
FOR DELETE 
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND uploaded_by = auth.uid()
);

-- Engineers need INSERT/SELECT/UPDATE on calls table for testing agents
CREATE POLICY "Engineers can insert calls for their agents" 
ON public.calls 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND agent_id IN (
    SELECT id FROM aitel_agents WHERE engineer_id = auth.uid()
  )
);

CREATE POLICY "Engineers can view calls for their agents" 
ON public.calls 
FOR SELECT 
USING (
  has_role(auth.uid(), 'engineer'::app_role) 
  AND agent_id IN (
    SELECT id FROM aitel_agents WHERE engineer_id = auth.uid()
  )
);

-- Clients need INSERT policy for calls
CREATE POLICY "Clients can insert calls for their agents" 
ON public.calls 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id = auth.uid()
);
