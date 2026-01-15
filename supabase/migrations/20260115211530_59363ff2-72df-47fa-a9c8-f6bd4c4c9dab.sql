-- Create payments table to track Razorpay transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL, -- in paise
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, refunded, failed
  refund_id TEXT,
  refund_amount INTEGER,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refunded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins have full access to payments"
  ON public.payments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view their own payments
CREATE POLICY "Clients can view their own payments"
  ON public.payments
  FOR SELECT
  USING (has_role(auth.uid(), 'client'::app_role) AND client_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- Create updated_at trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();