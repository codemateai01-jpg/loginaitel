-- Add transcript and recording columns to calls table
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT 'neutral';

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy for clients to view their recordings
CREATE POLICY "Clients can view their call recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for uploading recordings (system/edge functions)
CREATE POLICY "Service role can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-recordings');