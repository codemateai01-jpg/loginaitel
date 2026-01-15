-- Drop site_visits table first (depends on real_estate_leads, projects, sales_executives)
DROP TABLE IF EXISTS public.site_visits CASCADE;

-- Drop real_estate_calls table (depends on real_estate_leads, calls)
DROP TABLE IF EXISTS public.real_estate_calls CASCADE;

-- Drop call_queue table (depends on real_estate_leads)
DROP TABLE IF EXISTS public.call_queue CASCADE;

-- Drop real_estate_leads table (depends on projects, sales_executives)
DROP TABLE IF EXISTS public.real_estate_leads CASCADE;

-- Drop sales_executives table
DROP TABLE IF EXISTS public.sales_executives CASCADE;

-- Drop projects table
DROP TABLE IF EXISTS public.projects CASCADE;

-- Remove crm_type column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS crm_type;

-- Drop the enums
DROP TYPE IF EXISTS public.site_visit_outcome CASCADE;
DROP TYPE IF EXISTS public.call_disposition CASCADE;
DROP TYPE IF EXISTS public.lead_stage CASCADE;
DROP TYPE IF EXISTS public.crm_type CASCADE;