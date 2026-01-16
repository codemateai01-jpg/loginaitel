-- Drop and recreate the trigger function to properly handle role from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  existing_role_count INTEGER;
BEGIN
  -- Check if role already exists (created by edge function)
  SELECT COUNT(*) INTO existing_role_count 
  FROM public.user_roles 
  WHERE user_id = NEW.id;
  
  -- If role already exists, only create profile if needed
  IF existing_role_count > 0 THEN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
      INSERT INTO public.profiles (user_id, email, full_name, phone)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
      );
    END IF;
    RETURN NEW;
  END IF;
  
  -- Get role from metadata - if not provided, DO NOT create a default role
  -- Let the edge function handle role assignment
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    user_role := (NEW.raw_user_meta_data->>'role')::app_role;
    
    -- Assign role only if explicitly provided in metadata
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  -- Create profile if not exists (always do this)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    INSERT INTO public.profiles (user_id, email, full_name, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
  END IF;
  
  RETURN NEW;
END;
$function$;