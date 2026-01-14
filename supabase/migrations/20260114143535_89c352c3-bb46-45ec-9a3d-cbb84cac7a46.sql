-- Fix the handle_new_user trigger to NOT create roles when user is created via edge function
-- The edge function already creates the role, so we check if role exists first

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Get role from metadata or default to 'client'
  user_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'client'::app_role
  );
  
  -- Create profile if not exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    INSERT INTO public.profiles (user_id, email, full_name, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
  END IF;
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;

-- Fix the process_call_completion trigger to use >= 45 seconds correctly
CREATE OR REPLACE FUNCTION public.process_call_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark as connected ONLY if duration >= 45 seconds
  IF NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds >= 45 THEN
    NEW.connected := true;
  ELSE
    NEW.connected := false;
  END IF;
  
  -- Auto-deduct credit if connected and not yet deducted
  IF NEW.connected AND NOT COALESCE(NEW.credit_deducted, false) AND NEW.status = 'completed' THEN
    -- Deduct 1 credit
    UPDATE public.client_credits 
    SET balance = balance - 1 
    WHERE client_id = NEW.client_id AND balance > 0;
    
    -- Log the transaction
    INSERT INTO public.credit_transactions (client_id, amount, transaction_type, description, call_id, created_by)
    VALUES (NEW.client_id, -1, 'call_deduction', 'Auto-deducted for connected call', NEW.id, NEW.client_id);
    
    NEW.credit_deducted := true;
  END IF;
  
  RETURN NEW;
END;
$$;