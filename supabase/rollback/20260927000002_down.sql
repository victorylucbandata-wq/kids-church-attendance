-- Rollback for 20260927000002_multi_church_rls_cutover.sql: puts back the pre-cutover access so the
-- pre-stage-1 app (publishable key) works again. Policies are recreated exactly as they were on
-- 2026-09-27 (see plan, open item 7). Run only together with reverting the stage 1 deploy.
BEGIN;

DROP POLICY IF EXISTS church_members_all       ON public.members;
DROP POLICY IF EXISTS church_age_groups_all    ON public.age_groups;
DROP POLICY IF EXISTS church_sessions_all      ON public.sessions;
DROP POLICY IF EXISTS church_attendance_all    ON public.attendance;
DROP POLICY IF EXISTS church_first_timers_all  ON public.first_timers;
DROP POLICY IF EXISTS church_service_times_all ON public.service_times;
DROP POLICY IF EXISTS churches_read            ON public.churches;
DROP POLICY IF EXISTS churches_network_insert  ON public.churches;
DROP POLICY IF EXISTS churches_network_update  ON public.churches;
DROP POLICY IF EXISTS memberships_read         ON public.church_memberships;
DROP POLICY IF EXISTS memberships_lead_insert  ON public.church_memberships;
DROP POLICY IF EXISTS memberships_lead_update  ON public.church_memberships;
DROP POLICY IF EXISTS memberships_lead_delete  ON public.church_memberships;
DROP POLICY IF EXISTS network_admins_self      ON public.network_admins;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.members, public.age_groups, public.sessions, public.attendance, public.first_timers TO anon;

CREATE POLICY anon_read_age_groups   ON public.age_groups FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_age_groups ON public.age_groups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_age_groups ON public.age_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_age_groups ON public.age_groups FOR DELETE TO anon USING (true);
CREATE POLICY auth_all_age_groups    ON public.age_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_read_members   ON public.members FOR SELECT TO anon USING (is_active = true);
CREATE POLICY anon_insert_members ON public.members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_members ON public.members FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_members ON public.members FOR DELETE TO anon USING (true);
CREATE POLICY auth_all_members    ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_read_sessions   ON public.sessions FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_sessions ON public.sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY auth_all_sessions    ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_select_attendance ON public.attendance FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_attendance ON public.attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_attendance ON public.attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY auth_all_attendance    ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_insert_first_timers ON public.first_timers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY auth_all_first_timers    ON public.first_timers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- The old app inserts without church_id and writes time_slot text: restore the transition defaults and trigger.
CREATE OR REPLACE FUNCTION public.legacy_default_church() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT id FROM churches WHERE slug = 'lucban' $$;
GRANT EXECUTE ON FUNCTION public.legacy_default_church() TO anon, authenticated;
ALTER TABLE public.members      ALTER COLUMN church_id SET DEFAULT public.legacy_default_church();
ALTER TABLE public.age_groups   ALTER COLUMN church_id SET DEFAULT public.legacy_default_church();
ALTER TABLE public.sessions     ALTER COLUMN church_id SET DEFAULT public.legacy_default_church();
ALTER TABLE public.attendance   ALTER COLUMN church_id SET DEFAULT public.legacy_default_church();
ALTER TABLE public.first_timers ALTER COLUMN church_id SET DEFAULT public.legacy_default_church();
ALTER TABLE public.attendance   ALTER COLUMN service_time_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.attendance_fill_service_time() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.service_time_id IS NULL AND NEW.time_slot IS NOT NULL THEN
    SELECT id INTO NEW.service_time_id FROM service_times
    WHERE church_id = NEW.church_id
      AND label = CASE NEW.time_slot WHEN '9am' THEN '9:00 AM' WHEN '11am' THEN '11:00 AM' WHEN 'Special' THEN 'Special Event' END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS attendance_fill_service_time ON public.attendance;
CREATE TRIGGER attendance_fill_service_time BEFORE INSERT OR UPDATE OF time_slot ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_fill_service_time();

COMMIT;
