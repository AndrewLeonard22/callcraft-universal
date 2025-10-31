-- Create triggers to auto-create profile and organization on signup
DO $$
BEGIN
  -- Create trigger for profiles if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;

  -- Create trigger for organizations if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_org'
  ) THEN
    CREATE TRIGGER on_auth_user_created_org
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_organization();
  END IF;
END $$;