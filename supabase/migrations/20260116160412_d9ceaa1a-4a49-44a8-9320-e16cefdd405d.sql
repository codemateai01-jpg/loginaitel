-- Create enum for client sub-user roles
CREATE TYPE public.client_sub_user_role AS ENUM ('monitoring', 'telecaller', 'lead_manager');

-- Create table for client sub-users
CREATE TABLE public.client_sub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role client_sub_user_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, inactive
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, email)
);

-- Create table for lead assignments to telecallers
CREATE TABLE public.lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES campaign_leads(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  assigned_to UUID REFERENCES client_sub_users(id) ON DELETE SET NULL,
  assigned_by UUID,
  assignment_type TEXT NOT NULL DEFAULT 'auto', -- auto, manual
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned, in_progress, completed, transferred
  priority INTEGER DEFAULT 0,
  notes TEXT,
  follow_up_at TIMESTAMP WITH TIME ZONE,
  last_action_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Create table to track round-robin assignment state
CREATE TABLE public.telecaller_assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  last_assigned_telecaller_id UUID REFERENCES client_sub_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.client_sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telecaller_assignment_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_sub_users

-- Admins have full access
CREATE POLICY "Admins have full access to client_sub_users"
  ON public.client_sub_users FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can manage their own sub-users
CREATE POLICY "Clients can view their sub-users"
  ON public.client_sub_users FOR SELECT
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can create sub-users"
  ON public.client_sub_users FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can update their sub-users"
  ON public.client_sub_users FOR UPDATE
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can delete their sub-users"
  ON public.client_sub_users FOR DELETE
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

-- Sub-users can view their own record
CREATE POLICY "Sub-users can view their own record"
  ON public.client_sub_users FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for lead_assignments

-- Admins have full access
CREATE POLICY "Admins have full access to lead_assignments"
  ON public.lead_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can manage assignments
CREATE POLICY "Clients can view their lead assignments"
  ON public.lead_assignments FOR SELECT
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can create lead assignments"
  ON public.lead_assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can update lead assignments"
  ON public.lead_assignments FOR UPDATE
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

CREATE POLICY "Clients can delete lead assignments"
  ON public.lead_assignments FOR DELETE
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

-- Sub-users can view their assigned leads
CREATE POLICY "Sub-users can view assigned leads"
  ON public.lead_assignments FOR SELECT
  USING (assigned_to IN (
    SELECT id FROM client_sub_users WHERE user_id = auth.uid()
  ));

-- Sub-users can update their assigned leads
CREATE POLICY "Sub-users can update assigned leads"
  ON public.lead_assignments FOR UPDATE
  USING (assigned_to IN (
    SELECT id FROM client_sub_users WHERE user_id = auth.uid()
  ));

-- RLS Policies for telecaller_assignment_queue

CREATE POLICY "Admins have full access to assignment queue"
  ON public.telecaller_assignment_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can manage their assignment queue"
  ON public.telecaller_assignment_queue FOR ALL
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

-- Create function to auto-assign leads to telecallers in round-robin
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller(
  p_lead_id UUID,
  p_campaign_id UUID,
  p_client_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telecaller_id UUID;
  v_last_assigned_id UUID;
  v_assignment_id UUID;
BEGIN
  -- Get the last assigned telecaller for this client
  SELECT last_assigned_telecaller_id INTO v_last_assigned_id
  FROM telecaller_assignment_queue
  WHERE client_id = p_client_id;

  -- Find next active telecaller in round-robin order
  SELECT id INTO v_telecaller_id
  FROM client_sub_users
  WHERE client_id = p_client_id
    AND role = 'telecaller'
    AND status = 'active'
    AND (v_last_assigned_id IS NULL OR id > v_last_assigned_id)
  ORDER BY id
  LIMIT 1;

  -- If no telecaller found after last assigned, wrap around
  IF v_telecaller_id IS NULL THEN
    SELECT id INTO v_telecaller_id
    FROM client_sub_users
    WHERE client_id = p_client_id
      AND role = 'telecaller'
      AND status = 'active'
    ORDER BY id
    LIMIT 1;
  END IF;

  -- If still no telecaller found, return NULL
  IF v_telecaller_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Create or update assignment
  INSERT INTO lead_assignments (lead_id, campaign_id, client_id, assigned_to, assignment_type)
  VALUES (p_lead_id, p_campaign_id, p_client_id, v_telecaller_id, 'auto')
  ON CONFLICT (lead_id) DO UPDATE SET
    assigned_to = v_telecaller_id,
    assignment_type = 'auto',
    updated_at = now()
  RETURNING id INTO v_assignment_id;

  -- Update the assignment queue
  INSERT INTO telecaller_assignment_queue (client_id, last_assigned_telecaller_id)
  VALUES (p_client_id, v_telecaller_id)
  ON CONFLICT (client_id) DO UPDATE SET
    last_assigned_telecaller_id = v_telecaller_id,
    updated_at = now();

  RETURN v_assignment_id;
END;
$$;

-- Create trigger to auto-assign when lead becomes interested
CREATE OR REPLACE FUNCTION public.handle_interested_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when interest_level changes to 'interested'
  IF NEW.interest_level = 'interested' AND (OLD.interest_level IS NULL OR OLD.interest_level != 'interested') THEN
    -- Auto-assign to telecaller
    PERFORM auto_assign_lead_to_telecaller(NEW.id, NEW.campaign_id, NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_assign_interested_lead
  AFTER UPDATE ON public.campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION handle_interested_lead();

-- Update triggers for updated_at
CREATE TRIGGER update_client_sub_users_updated_at
  BEFORE UPDATE ON public.client_sub_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_assignments_updated_at
  BEFORE UPDATE ON public.lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_client_sub_users_client_id ON public.client_sub_users(client_id);
CREATE INDEX idx_client_sub_users_user_id ON public.client_sub_users(user_id);
CREATE INDEX idx_client_sub_users_role ON public.client_sub_users(role);
CREATE INDEX idx_lead_assignments_assigned_to ON public.lead_assignments(assigned_to);
CREATE INDEX idx_lead_assignments_campaign_id ON public.lead_assignments(campaign_id);
CREATE INDEX idx_lead_assignments_client_id ON public.lead_assignments(client_id);

-- Add RLS policy for sub-users to view campaign leads they're assigned to
CREATE POLICY "Sub-users can view their assigned campaign leads"
  ON public.campaign_leads FOR SELECT
  USING (
    id IN (
      SELECT lead_id FROM lead_assignments 
      WHERE assigned_to IN (
        SELECT id FROM client_sub_users WHERE user_id = auth.uid()
      )
    )
  );

-- Add RLS policy for sub-users to update their assigned campaign leads
CREATE POLICY "Sub-users can update their assigned campaign leads"
  ON public.campaign_leads FOR UPDATE
  USING (
    id IN (
      SELECT lead_id FROM lead_assignments 
      WHERE assigned_to IN (
        SELECT id FROM client_sub_users WHERE user_id = auth.uid()
      )
    )
  );

-- Sub-users with monitoring role can view all calls for their client
CREATE POLICY "Monitoring sub-users can view client calls"
  ON public.calls FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'monitoring' AND status = 'active'
    )
  );

-- Lead manager sub-users can view all campaign leads for their client
CREATE POLICY "Lead manager sub-users can view all client leads"
  ON public.campaign_leads FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'lead_manager' AND status = 'active'
    )
  );

-- Lead manager sub-users can update all campaign leads for their client
CREATE POLICY "Lead manager sub-users can update all client leads"
  ON public.campaign_leads FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'lead_manager' AND status = 'active'
    )
  );

-- Lead manager can manage lead assignments
CREATE POLICY "Lead managers can view all assignments"
  ON public.lead_assignments FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'lead_manager' AND status = 'active'
    )
  );

CREATE POLICY "Lead managers can update all assignments"
  ON public.lead_assignments FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'lead_manager' AND status = 'active'
    )
  );

CREATE POLICY "Lead managers can create assignments"
  ON public.lead_assignments FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND role = 'lead_manager' AND status = 'active'
    )
  );

-- Add policy for campaigns view by sub-users
CREATE POLICY "Sub-users can view their client campaigns"
  ON public.campaigns FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_sub_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );