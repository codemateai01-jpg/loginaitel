-- Rename bolna_agents table to aitel_agents
ALTER TABLE public.bolna_agents RENAME TO aitel_agents;

-- Rename the bolna_agent_id column to external_agent_id for clarity
ALTER TABLE public.aitel_agents RENAME COLUMN bolna_agent_id TO external_agent_id;

-- Rename index
ALTER INDEX IF EXISTS idx_bolna_agents_engineer_id RENAME TO idx_aitel_agents_engineer_id;

-- Rename trigger
DROP TRIGGER IF EXISTS update_bolna_agents_updated_at ON public.aitel_agents;
CREATE TRIGGER update_aitel_agents_updated_at
BEFORE UPDATE ON public.aitel_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();