-- Drop the old status check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new constraint with all workflow statuses
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (
  status = ANY (ARRAY[
    'pending'::text, 
    'assigned'::text, 
    'in_progress'::text, 
    'prompt_submitted'::text,
    'prompt_approved'::text,
    'demo_submitted'::text,
    'submitted'::text, 
    'approved'::text, 
    'rejected'::text, 
    'completed'::text
  ])
);