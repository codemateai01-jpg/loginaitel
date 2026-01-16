-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new restrictive policies - users can ONLY view their own profile
-- Admins must use secure-data-proxy for viewing other profiles
CREATE POLICY "Users can only view own profile via direct query"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Note: This forces all cross-user profile access through secure-data-proxy
-- which uses service_role key to bypass RLS and applies masking