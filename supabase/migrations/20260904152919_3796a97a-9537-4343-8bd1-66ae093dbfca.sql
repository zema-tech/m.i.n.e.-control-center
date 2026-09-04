REVOKE ALL ON public.agent_memory FROM anon, authenticated;
REVOKE ALL ON public.agent_events FROM anon, authenticated;
GRANT ALL ON public.agent_memory TO service_role;
GRANT ALL ON public.agent_events TO service_role;
CREATE POLICY "agent_memory backend only" ON public.agent_memory FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "agent_events backend only" ON public.agent_events FOR ALL TO authenticated USING (false) WITH CHECK (false);