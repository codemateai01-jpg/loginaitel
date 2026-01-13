-- Create time_entries table for engineer time tracking
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  break_start_time TIMESTAMP WITH TIME ZONE,
  break_end_time TIMESTAMP WITH TIME ZONE,
  total_break_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Engineers can view their own time entries"
ON public.time_entries
FOR SELECT
USING (has_role(auth.uid(), 'engineer') AND engineer_id = auth.uid());

CREATE POLICY "Engineers can insert their own time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'engineer') AND engineer_id = auth.uid());

CREATE POLICY "Engineers can update their own time entries"
ON public.time_entries
FOR UPDATE
USING (has_role(auth.uid(), 'engineer') AND engineer_id = auth.uid());

CREATE POLICY "Admins have full access to time_entries"
ON public.time_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Update trigger
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;