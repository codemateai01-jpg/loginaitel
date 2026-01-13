-- Fix tasks status constraint to match application statuses
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_status_check
CHECK (
  status IN (
    'pending',
    'assigned',
    'in_progress',
    'submitted',
    'approved',
    'rejected',
    'completed'
  )
);
