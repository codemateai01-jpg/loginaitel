-- Add price_per_credit column to client_credits table
ALTER TABLE public.client_credits 
ADD COLUMN price_per_credit numeric(10,2) NOT NULL DEFAULT 3.00;

-- Add a comment for documentation
COMMENT ON COLUMN public.client_credits.price_per_credit IS 'Price per credit in INR for this client';