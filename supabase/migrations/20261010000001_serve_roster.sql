-- Phase 1: the Serve Team roster, planned per service (who serves, in which role).
-- Additive only: the live app does not read this table until the phase 1 code is deployed.

CREATE TABLE public.roster (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  service_date    DATE NOT NULL,
  service_time_id UUID NOT NULL REFERENCES public.service_times(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  serve_role      TEXT NOT NULL DEFAULT '' CHECK (char_length(serve_role) <= 40),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_date, service_time_id, member_id)
);
CREATE INDEX roster_church_date_idx ON public.roster (church_id, service_date);

ALTER TABLE public.roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roster FROM anon;
CREATE POLICY church_roster_all ON public.roster FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));

-- A roster row stays inside one church, like attendance.
CREATE FUNCTION public.roster_same_church() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT church_id FROM service_times WHERE id = NEW.service_time_id) IS DISTINCT FROM NEW.church_id
     OR (SELECT church_id FROM members WHERE id = NEW.member_id) IS DISTINCT FROM NEW.church_id THEN
    RAISE EXCEPTION 'roster % mixes churches', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.roster_same_church() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER roster_same_church BEFORE INSERT OR UPDATE ON public.roster
  FOR EACH ROW EXECUTE FUNCTION public.roster_same_church();
