-- Create pricing packages table
CREATE TABLE public.pricing_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  calls_included INTEGER NOT NULL,
  concurrency_level INTEGER NOT NULL DEFAULT 10,
  includes_inbound BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_enterprise BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client subscriptions table
CREATE TABLE public.client_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES public.pricing_packages(id),
  calls_remaining INTEGER NOT NULL,
  calls_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled'))
);

-- Create subscription upgrade history table
CREATE TABLE public.subscription_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  from_package_id UUID REFERENCES public.pricing_packages(id),
  to_package_id UUID NOT NULL REFERENCES public.pricing_packages(id),
  action TEXT NOT NULL DEFAULT 'upgrade',
  calls_carried_over INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('initial', 'upgrade', 'renewal', 'admin_change'))
);

-- Enable RLS
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Pricing packages policies (public read, admin write)
CREATE POLICY "Anyone can view active packages"
ON public.pricing_packages FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins have full access to packages"
ON public.pricing_packages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Client subscriptions policies
CREATE POLICY "Clients can view their own subscriptions"
ON public.client_subscriptions FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Admins have full access to subscriptions"
ON public.client_subscriptions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Subscription history policies
CREATE POLICY "Clients can view their own history"
ON public.subscription_history FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Admins have full access to history"
ON public.subscription_history FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at triggers
CREATE TRIGGER update_pricing_packages_updated_at
BEFORE UPDATE ON public.pricing_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_subscriptions_updated_at
BEFORE UPDATE ON public.client_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default packages
INSERT INTO public.pricing_packages (name, slug, calls_included, concurrency_level, includes_inbound, description, features, is_enterprise, display_order) VALUES
('Trust Building Pack', 'trust-building', 5000, 10, false, 'Perfect for getting started and building trust with your customers', '["5,000 connected calls", "10 concurrent calls", "No charge for missed calls", "Basic analytics", "Email support", "45+ second call billing"]'::jsonb, false, 1),
('Growth Pack', 'growth', 30000, 15, false, 'Scale your outreach with more calls and higher concurrency', '["30,000 connected calls", "15 concurrent calls", "No charge for missed calls", "Advanced analytics", "Priority email support", "45+ second call billing"]'::jsonb, false, 2),
('Professional Pack', 'professional', 50000, 20, false, 'For businesses ready to maximize their calling potential', '["50,000 connected calls", "20 concurrent calls", "No charge for missed calls", "Premium analytics", "Priority support", "45+ second call billing", "Dedicated account manager"]'::jsonb, false, 3),
('Enterprise Pack', 'enterprise', 100000, 20, true, 'Full-scale enterprise solution with all features included', '["100,000 connected calls", "Custom concurrency", "Inbound calls included", "Enterprise analytics", "24/7 dedicated support", "45+ second call billing", "Custom integrations", "SLA guarantee"]'::jsonb, true, 4);