-- Create CRM type enum
CREATE TYPE public.crm_type AS ENUM ('generic', 'real_estate');

-- Create lead stage enum for real estate
CREATE TYPE public.lead_stage AS ENUM ('new', 'contacted', 'interested', 'site_visit_done', 'negotiation', 'token_paid', 'closed', 'lost');

-- Create site visit outcome enum
CREATE TYPE public.site_visit_outcome AS ENUM ('liked', 'budget_mismatch', 'location_issue', 'postponed', 'pending');

-- Create call disposition enum
CREATE TYPE public.call_disposition AS ENUM ('answered', 'not_answered', 'busy', 'voicemail', 'wrong_number', 'callback_requested');

-- Add CRM type to client tracking (using profiles table)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS crm_type crm_type DEFAULT 'generic';

-- Create projects table for real estate clients
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    property_type TEXT, -- flat, plot, villa, commercial, etc.
    location TEXT,
    price_range_min NUMERIC,
    price_range_max NUMERIC,
    amenities TEXT[],
    images TEXT[],
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales executives table
CREATE TABLE public.sales_executives (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create real estate leads table (separate from generic leads)
CREATE TABLE public.real_estate_leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT,
    phone_number TEXT NOT NULL,
    email TEXT,
    source TEXT, -- facebook, google, website, referral, etc.
    stage lead_stage DEFAULT 'new',
    interest_score INTEGER CHECK (interest_score >= 0 AND interest_score <= 100),
    budget_min NUMERIC,
    budget_max NUMERIC,
    preferred_property_type TEXT,
    notes TEXT,
    objections TEXT[],
    assigned_executive_id UUID REFERENCES public.sales_executives(id) ON DELETE SET NULL,
    last_call_at TIMESTAMP WITH TIME ZONE,
    last_call_summary TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call queue table for bulk calling
CREATE TABLE public.call_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES public.real_estate_leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.aitel_agents(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    priority INTEGER DEFAULT 0,
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create real estate calls table (enhanced call details)
CREATE TABLE public.real_estate_calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.real_estate_leads(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    disposition call_disposition,
    ai_summary TEXT,
    objections_detected TEXT[],
    interest_score INTEGER CHECK (interest_score >= 0 AND interest_score <= 100),
    auto_stage_update lead_stage,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create site visits table
CREATE TABLE public.site_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES public.real_estate_leads(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    assigned_executive_id UUID REFERENCES public.sales_executives(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    outcome site_visit_outcome DEFAULT 'pending',
    outcome_notes TEXT,
    visited_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Clients can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all projects" ON public.projects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sales_executives
CREATE POLICY "Clients can view their own executives" ON public.sales_executives FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own executives" ON public.sales_executives FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their own executives" ON public.sales_executives FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete their own executives" ON public.sales_executives FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage all executives" ON public.sales_executives FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for real_estate_leads
CREATE POLICY "Clients can view their own leads" ON public.real_estate_leads FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own leads" ON public.real_estate_leads FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their own leads" ON public.real_estate_leads FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete their own leads" ON public.real_estate_leads FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage all re leads" ON public.real_estate_leads FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for call_queue
CREATE POLICY "Clients can view their own queue" ON public.call_queue FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own queue" ON public.call_queue FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their own queue" ON public.call_queue FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage all queues" ON public.call_queue FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for real_estate_calls
CREATE POLICY "Clients can view their own re calls" ON public.real_estate_calls FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own re calls" ON public.real_estate_calls FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Admins can manage all re calls" ON public.real_estate_calls FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for site_visits
CREATE POLICY "Clients can view their own visits" ON public.site_visits FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients can insert their own visits" ON public.site_visits FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update their own visits" ON public.site_visits FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete their own visits" ON public.site_visits FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "Admins can manage all visits" ON public.site_visits FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_sales_executives_client_id ON public.sales_executives(client_id);
CREATE INDEX idx_real_estate_leads_client_id ON public.real_estate_leads(client_id);
CREATE INDEX idx_real_estate_leads_stage ON public.real_estate_leads(stage);
CREATE INDEX idx_real_estate_leads_project_id ON public.real_estate_leads(project_id);
CREATE INDEX idx_call_queue_client_id ON public.call_queue(client_id);
CREATE INDEX idx_call_queue_status ON public.call_queue(status);
CREATE INDEX idx_site_visits_client_id ON public.site_visits(client_id);
CREATE INDEX idx_site_visits_scheduled_at ON public.site_visits(scheduled_at);

-- Update triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_executives_updated_at BEFORE UPDATE ON public.sales_executives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_real_estate_leads_updated_at BEFORE UPDATE ON public.real_estate_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_visits_updated_at BEFORE UPDATE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for call_queue to track progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_queue;