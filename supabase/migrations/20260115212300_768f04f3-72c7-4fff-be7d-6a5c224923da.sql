-- Add auto-recharge and low balance alert settings to client_credits
ALTER TABLE public.client_credits
ADD COLUMN low_balance_threshold INTEGER DEFAULT 50,
ADD COLUMN low_balance_alert_enabled BOOLEAN DEFAULT false,
ADD COLUMN last_low_balance_alert_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN auto_recharge_enabled BOOLEAN DEFAULT false,
ADD COLUMN auto_recharge_amount INTEGER DEFAULT 500,
ADD COLUMN auto_recharge_trigger_balance INTEGER DEFAULT 100;

-- Add invoice_url to payments table
ALTER TABLE public.payments
ADD COLUMN invoice_url TEXT;