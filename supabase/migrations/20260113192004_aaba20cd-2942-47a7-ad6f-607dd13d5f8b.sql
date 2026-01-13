-- Add engineer_id column to bolna_agents table for agent assignment
ALTER TABLE public.bolna_agents 
ADD COLUMN IF NOT EXISTS engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bolna_agents_engineer_id ON public.bolna_agents(engineer_id);