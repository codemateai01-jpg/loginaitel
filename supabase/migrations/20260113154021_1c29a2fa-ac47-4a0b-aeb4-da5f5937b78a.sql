
-- =============================================
-- AGENTS TABLE - Voice agents created by engineers
-- =============================================
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  voice_config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  client_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agents_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived'))
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to agents"
  ON public.agents FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Engineers can view/manage agents they created
CREATE POLICY "Engineers can view agents they created"
  ON public.agents FOR SELECT
  USING (has_role(auth.uid(), 'engineer') AND created_by = auth.uid());

CREATE POLICY "Engineers can insert agents"
  ON public.agents FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'engineer') AND created_by = auth.uid());

CREATE POLICY "Engineers can update agents they created"
  ON public.agents FOR UPDATE
  USING (has_role(auth.uid(), 'engineer') AND created_by = auth.uid());

-- Clients can view their assigned agents
CREATE POLICY "Clients can view their agents"
  ON public.agents FOR SELECT
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

-- =============================================
-- TASKS TABLE - With point system for engineers
-- =============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID,
  created_by UUID NOT NULL,
  deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'rejected'))
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to tasks"
  ON public.tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Engineers can view tasks assigned to them
CREATE POLICY "Engineers can view assigned tasks"
  ON public.tasks FOR SELECT
  USING (has_role(auth.uid(), 'engineer') AND assigned_to = auth.uid());

-- Engineers can update task status
CREATE POLICY "Engineers can update assigned tasks"
  ON public.tasks FOR UPDATE
  USING (has_role(auth.uid(), 'engineer') AND assigned_to = auth.uid());

-- =============================================
-- ENGINEER POINTS - Leaderboard tracking
-- =============================================
CREATE TABLE public.engineer_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.engineer_points ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to engineer_points"
  ON public.engineer_points FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Engineers can view all points (for leaderboard)
CREATE POLICY "Engineers can view all points"
  ON public.engineer_points FOR SELECT
  USING (has_role(auth.uid(), 'engineer'));

-- =============================================
-- POINT TRANSACTIONS - Audit log
-- =============================================
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL REFERENCES public.engineer_points(engineer_id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to point_transactions"
  ON public.point_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Engineers can view their own transactions
CREATE POLICY "Engineers can view their point transactions"
  ON public.point_transactions FOR SELECT
  USING (has_role(auth.uid(), 'engineer') AND engineer_id = auth.uid());

-- =============================================
-- CLIENT CREDITS - Wallet balance
-- =============================================
CREATE TABLE public.client_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_credits ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to client_credits"
  ON public.client_credits FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Clients can view their own credits
CREATE POLICY "Clients can view their credits"
  ON public.client_credits FOR SELECT
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

-- =============================================
-- CREDIT TRANSACTIONS - Audit log
-- =============================================
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_credits(client_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  call_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_tx_type_check CHECK (transaction_type IN ('purchase', 'call_deduction', 'refund', 'admin_adjustment'))
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to credit_transactions"
  ON public.credit_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Clients can view their own transactions
CREATE POLICY "Clients can view their credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

-- =============================================
-- LEADS TABLE - Phone numbers with masking support
-- =============================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_status_check CHECK (status IN ('pending', 'queued', 'calling', 'connected', 'failed', 'completed', 'dnc'))
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Clients can view their own leads (full phone visible)
CREATE POLICY "Clients can view their leads"
  ON public.leads FOR SELECT
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

CREATE POLICY "Clients can insert their leads"
  ON public.leads FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'client') AND client_id = auth.uid() AND uploaded_by = auth.uid());

CREATE POLICY "Clients can update their leads"
  ON public.leads FOR UPDATE
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

CREATE POLICY "Clients can delete their leads"
  ON public.leads FOR DELETE
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

-- Admin view for leads with masked phone (using view instead of direct access)
-- Deny admin direct SELECT on leads table
CREATE POLICY "Admins cannot directly access leads"
  ON public.leads FOR SELECT
  USING (false AND has_role(auth.uid(), 'admin'));

-- =============================================
-- LEADS ADMIN VIEW - Masked phone numbers
-- =============================================
CREATE VIEW public.leads_admin_view
WITH (security_invoker = on) AS
SELECT 
  id,
  client_id,
  CASE 
    WHEN LENGTH(phone_number) > 4 
    THEN CONCAT(REPEAT('*', LENGTH(phone_number) - 4), RIGHT(phone_number, 4))
    ELSE REPEAT('*', LENGTH(phone_number))
  END AS phone_number_masked,
  name,
  email,
  status,
  metadata,
  uploaded_by,
  created_at,
  updated_at
FROM public.leads;

-- Grant admin access to the view
GRANT SELECT ON public.leads_admin_view TO authenticated;

-- =============================================
-- CALLS TABLE - Track calls for credit deduction
-- =============================================
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated',
  connected BOOLEAN DEFAULT false,
  credit_deducted BOOLEAN DEFAULT false,
  external_call_id TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calls_status_check CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer'))
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to calls"
  ON public.calls FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Clients can view their calls
CREATE POLICY "Clients can view their calls"
  ON public.calls FOR SELECT
  USING (has_role(auth.uid(), 'client') AND client_id = auth.uid());

-- =============================================
-- TRIGGERS - Auto update timestamps
-- =============================================
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engineer_points_updated_at
  BEFORE UPDATE ON public.engineer_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_credits_updated_at
  BEFORE UPDATE ON public.client_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTION - Mark call as connected (≥45 seconds)
-- =============================================
CREATE OR REPLACE FUNCTION public.process_call_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark as connected if duration >= 45 seconds
  IF NEW.duration_seconds >= 45 AND NOT OLD.connected THEN
    NEW.connected := true;
  END IF;
  
  -- Auto-deduct credit if connected and not yet deducted
  IF NEW.connected AND NOT NEW.credit_deducted AND NEW.status = 'completed' THEN
    -- Deduct 1 credit
    UPDATE public.client_credits 
    SET balance = balance - 1 
    WHERE client_id = NEW.client_id AND balance > 0;
    
    -- Log the transaction
    INSERT INTO public.credit_transactions (client_id, amount, transaction_type, description, call_id, created_by)
    VALUES (NEW.client_id, -1, 'call_deduction', 'Auto-deducted for connected call', NEW.id, NEW.client_id);
    
    NEW.credit_deducted := true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER process_call_on_update
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION process_call_completion();

-- =============================================
-- FUNCTION - Award points on task completion
-- =============================================
CREATE OR REPLACE FUNCTION public.award_task_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.assigned_to IS NOT NULL THEN
    -- Update or insert engineer points
    INSERT INTO public.engineer_points (engineer_id, total_points)
    VALUES (NEW.assigned_to, NEW.points)
    ON CONFLICT (engineer_id) 
    DO UPDATE SET total_points = engineer_points.total_points + NEW.points, updated_at = now();
    
    -- Log the transaction
    INSERT INTO public.point_transactions (engineer_id, points, task_id, description)
    VALUES (NEW.assigned_to, NEW.points, NEW.id, CONCAT('Completed task: ', NEW.title));
    
    NEW.completed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_points_on_task_complete
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION award_task_points();
