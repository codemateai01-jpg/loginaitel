-- Add picked_at column to track when engineer picked the task
ALTER TABLE public.tasks 
ADD COLUMN picked_at timestamp with time zone;