-- Stage 1.2: cutover to per-church Row Level Security (docs/multi-church-implementation-plan.md, 3.3).
--
-- APPLY ONLY AFTER the stage 1 app code is deployed. The code before stage 1 talks to the
-- database with the publishable (anon) key, and this migration takes all access away from it.
-- The stage 1 code works both before and after this migration, so the order is: deploy, then apply.
-- sfc_* tables belong to a separate app and are not touched here.

-- 1. Helpers --------------------------------------------------------------------

CREATE FUNCTION public.is_network_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM network_admins WHERE user_id = auth.uid())
$$;

CREATE FUNCTION public.is_church_lead(target UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = target AND user_id = auth.uid() AND role = 'lead')
$$;

-- Server-only lookup for invites (auth.users is not queryable through the API).
CREATE FUNCTION public.user_id_by_email(lookup TEXT) RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(lookup) LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.is_network_admin()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_church_lead(UUID)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_id_by_email(TEXT)   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_network_admin()      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_church_lead(UUID)     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.user_id_by_email(TEXT)   TO service_role;

-- 2. Remove the old wide-open policies on the kids tables -------------------------

DROP POLICY IF EXISTS anon_read_age_groups   ON public.age_groups;
DROP POLICY IF EXISTS anon_insert_age_groups ON public.age_groups;
DROP POLICY IF EXISTS anon_update_age_groups ON public.age_groups;
DROP POLICY IF EXISTS anon_delete_age_groups ON public.age_groups;
DROP POLICY IF EXISTS auth_all_age_groups    ON public.age_groups;

DROP POLICY IF EXISTS anon_read_members   ON public.members;
DROP POLICY IF EXISTS anon_insert_members ON public.members;
DROP POLICY IF EXISTS anon_update_members ON public.members;
DROP POLICY IF EXISTS anon_delete_members ON public.members;
DROP POLICY IF EXISTS auth_all_members    ON public.members;

DROP POLICY IF EXISTS anon_read_sessions   ON public.sessions;
DROP POLICY IF EXISTS anon_insert_sessions ON public.sessions;
DROP POLICY IF EXISTS auth_all_sessions    ON public.sessions;

DROP POLICY IF EXISTS anon_select_attendance ON public.attendance;
DROP POLICY IF EXISTS anon_insert_attendance ON public.attendance;
DROP POLICY IF EXISTS anon_update_attendance ON public.attendance;
DROP POLICY IF EXISTS auth_all_attendance    ON public.attendance;

DROP POLICY IF EXISTS anon_insert_first_timers ON public.first_timers;
DROP POLICY IF EXISTS auth_all_first_timers    ON public.first_timers;

-- Belt and braces: the anon role gets no table privileges at all on kids data.
REVOKE ALL ON public.members, public.age_groups, public.sessions, public.attendance, public.first_timers,
              public.service_times, public.churches, public.church_memberships, public.network_admins
  FROM anon;

-- 3. Church-scoped policies -------------------------------------------------------

CREATE POLICY church_members_all ON public.members FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));
CREATE POLICY church_age_groups_all ON public.age_groups FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));
CREATE POLICY church_sessions_all ON public.sessions FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));
CREATE POLICY church_attendance_all ON public.attendance FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));
CREATE POLICY church_first_timers_all ON public.first_timers FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));
CREATE POLICY church_service_times_all ON public.service_times FOR ALL TO authenticated
  USING (is_church_member(church_id)) WITH CHECK (is_church_member(church_id));

CREATE POLICY churches_read ON public.churches FOR SELECT TO authenticated
  USING (is_church_member(id));
CREATE POLICY churches_network_insert ON public.churches FOR INSERT TO authenticated
  WITH CHECK (is_network_admin());
CREATE POLICY churches_network_update ON public.churches FOR UPDATE TO authenticated
  USING (is_network_admin()) WITH CHECK (is_network_admin());

CREATE POLICY memberships_read ON public.church_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_church_lead(church_id) OR is_network_admin());
CREATE POLICY memberships_lead_insert ON public.church_memberships FOR INSERT TO authenticated
  WITH CHECK (is_church_lead(church_id) OR is_network_admin());
CREATE POLICY memberships_lead_update ON public.church_memberships FOR UPDATE TO authenticated
  USING (is_church_lead(church_id) OR is_network_admin()) WITH CHECK (is_church_lead(church_id) OR is_network_admin());
CREATE POLICY memberships_lead_delete ON public.church_memberships FOR DELETE TO authenticated
  USING (is_church_lead(church_id) OR is_network_admin());

CREATE POLICY network_admins_self ON public.network_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Retire the transition scaffolding from 20260927000001 -------------------------

ALTER TABLE public.members      ALTER COLUMN church_id DROP DEFAULT;
ALTER TABLE public.age_groups   ALTER COLUMN church_id DROP DEFAULT;
ALTER TABLE public.sessions     ALTER COLUMN church_id DROP DEFAULT;
ALTER TABLE public.attendance   ALTER COLUMN church_id DROP DEFAULT;
ALTER TABLE public.first_timers ALTER COLUMN church_id DROP DEFAULT;
DROP FUNCTION public.legacy_default_church();

DROP TRIGGER attendance_fill_service_time ON public.attendance;
DROP FUNCTION public.attendance_fill_service_time();

-- time_slot is kept (nullable) as history for one release; service_time_id is the source of truth.
ALTER TABLE public.attendance DROP CONSTRAINT attendance_time_slot_check;
ALTER TABLE public.attendance ALTER COLUMN time_slot DROP NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN service_time_id SET NOT NULL;

-- Church slugs must not collide with the app's own top-level routes.
ALTER TABLE public.churches ADD CONSTRAINT churches_slug_not_reserved
  CHECK (slug NOT IN ('admin', 'api', 'auth', 'network', 'check-in', 'kids-attendance', '_next'));
