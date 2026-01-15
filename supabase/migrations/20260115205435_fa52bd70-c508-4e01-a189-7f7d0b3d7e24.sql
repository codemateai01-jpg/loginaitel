-- Create storage bucket for demo audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-audio', 'demo-audio', true);

-- Allow engineers to upload their own demo audio files
CREATE POLICY "Engineers can upload demo audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'demo-audio' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow engineers to view their own demo audio files
CREATE POLICY "Engineers can view their own demo audio"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'demo-audio' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow engineers to delete their own demo audio files
CREATE POLICY "Engineers can delete their own demo audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'demo-audio' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins full access to demo audio
CREATE POLICY "Admins have full access to demo audio"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'demo-audio' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Add uploaded_audio_url column to demo_calls table for manually uploaded recordings
ALTER TABLE public.demo_calls 
ADD COLUMN IF NOT EXISTS uploaded_audio_url TEXT DEFAULT NULL;