-- Fix the handle_new_user trigger to handle duplicate profiles gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use INSERT ... ON CONFLICT to prevent duplicate key errors
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$function$;

-- Fix the handle_new_user_organization trigger to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  existing_org_count INTEGER;
BEGIN
  -- Check if user already has an organization
  SELECT COUNT(*) INTO existing_org_count
  FROM public.organization_members
  WHERE user_id = NEW.id;
  
  -- Only create organization if user doesn't have one
  IF existing_org_count = 0 THEN
    -- Create a default organization for the new user
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'display_name', 'My Organization') || '''s Team')
    RETURNING id INTO new_org_id;
    
    -- Add the user as the owner of this organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;