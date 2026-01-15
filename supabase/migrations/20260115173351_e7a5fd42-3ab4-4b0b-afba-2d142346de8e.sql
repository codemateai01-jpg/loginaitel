-- Drop the leads_admin_view first (it depends on leads table)
DROP VIEW IF EXISTS public.leads_admin_view;

-- Drop the leads table
DROP TABLE IF EXISTS public.leads CASCADE;