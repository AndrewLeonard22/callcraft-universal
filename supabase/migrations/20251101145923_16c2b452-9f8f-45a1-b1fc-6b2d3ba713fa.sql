-- Enable realtime for all relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.objection_handling_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.faqs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_details;