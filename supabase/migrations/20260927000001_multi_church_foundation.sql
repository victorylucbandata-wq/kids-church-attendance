-- Stage 1.1: multi-church foundation (docs/multi-church-implementation-plan.md, section 3).
--
-- Backward compatible on purpose: the app deployed today keeps working after this runs.
--   * every new church_id defaults to Victory Lucban via legacy_default_church()
--   * attendance.time_slot and its CHECK stay; a transition trigger fills service_time_id
--   * new tables get RLS with no policies, so the publishable key cannot touch them
-- The defaults, the transition trigger, and time_slot are removed at cutover (migration 1.2+).
-- sfc_* tables belong to a separate app and are not touched here.

-- 1. Churches -----------------------------------------------------------------

CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.churches (name, slug) VALUES ('Victory Lucban', 'lucban');

-- Transition only: lets today's code insert rows without knowing about churches.
-- SECURITY DEFINER: churches is RLS-locked, and defaults run as the inserting (anon) role.
CREATE FUNCTION public.legacy_default_church() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM churches WHERE slug = 'lucban'
$$;

-- 2. Access tables --------------------------------------------------------------

CREATE TABLE public.church_memberships (
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead', 'volunteer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (church_id, user_id)
);
CREATE INDEX church_memberships_user_idx ON public.church_memberships (user_id);

CREATE TABLE public.network_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Service times ---------------------------------------------------------------

CREATE TABLE public.service_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (church_id, label)
);

INSERT INTO public.service_times (church_id, label, sort_order)
SELECT public.legacy_default_church(), v.label, v.sort_order
FROM (VALUES ('9:00 AM', 1), ('11:00 AM', 2), ('Special Event', 3)) AS v(label, sort_order);

-- 4. church_id on existing tables (backfilled to Lucban via the default) ----------

ALTER TABLE public.members      ADD COLUMN church_id UUID NOT NULL DEFAULT public.legacy_default_church() REFERENCES public.churches(id);
ALTER TABLE public.age_groups   ADD COLUMN church_id UUID NOT NULL DEFAULT public.legacy_default_church() REFERENCES public.churches(id);
ALTER TABLE public.sessions     ADD COLUMN church_id UUID NOT NULL DEFAULT public.legacy_default_church() REFERENCES public.churches(id);
ALTER TABLE public.attendance   ADD COLUMN church_id UUID NOT NULL DEFAULT public.legacy_default_church() REFERENCES public.churches(id);
ALTER TABLE public.first_timers ADD COLUMN church_id UUID NOT NULL DEFAULT public.legacy_default_church() REFERENCES public.churches(id);

CREATE INDEX members_church_idx      ON public.members (church_id);
CREATE INDEX age_groups_church_idx   ON public.age_groups (church_id);
CREATE INDEX attendance_church_idx   ON public.attendance (church_id);
CREATE INDEX first_timers_church_idx ON public.first_timers (church_id);

-- Uniqueness becomes per church.
ALTER TABLE public.age_groups DROP CONSTRAINT age_groups_name_key;
ALTER TABLE public.age_groups ADD CONSTRAINT age_groups_church_name_key UNIQUE (church_id, name);
ALTER TABLE public.sessions DROP CONSTRAINT sessions_session_date_key;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_church_date_key UNIQUE (church_id, session_date);

-- 5. Attendance: service time link and who did what -------------------------------

ALTER TABLE public.attendance
  ADD COLUMN service_time_id UUID REFERENCES public.service_times(id),
  ADD COLUMN checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN checked_out_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.attendance a
SET service_time_id = st.id
FROM public.service_times st
WHERE st.church_id = a.church_id
  AND st.label = CASE a.time_slot WHEN '9am' THEN '9:00 AM' WHEN '11am' THEN '11:00 AM' WHEN 'Special' THEN 'Special Event' END;

-- Transition only: today's code writes time_slot; keep service_time_id in step.
CREATE FUNCTION public.attendance_fill_service_time() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.service_time_id IS NULL AND NEW.time_slot IS NOT NULL THEN
    SELECT id INTO NEW.service_time_id FROM service_times
    WHERE church_id = NEW.church_id
      AND label = CASE NEW.time_slot WHEN '9am' THEN '9:00 AM' WHEN '11am' THEN '11:00 AM' WHEN 'Special' THEN 'Special Event' END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER attendance_fill_service_time
  BEFORE INSERT OR UPDATE OF time_slot ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_fill_service_time();

-- 6. Integrity guard: an attendance row must belong to one church end to end -----

-- SECURITY DEFINER so the check sees every row regardless of the caller's RLS view.
CREATE FUNCTION public.attendance_same_church() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT church_id FROM sessions WHERE id = NEW.session_id) IS DISTINCT FROM NEW.church_id
     OR (SELECT church_id FROM members WHERE id = NEW.member_id) IS DISTINCT FROM NEW.church_id
     OR (NEW.service_time_id IS NOT NULL
         AND (SELECT church_id FROM service_times WHERE id = NEW.service_time_id) IS DISTINCT FROM NEW.church_id) THEN
    RAISE EXCEPTION 'attendance % mixes churches', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER attendance_same_church
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_same_church();

-- first_timers take their session's church (all Lucban today, but be exact).
UPDATE public.first_timers f SET church_id = s.church_id
FROM public.sessions s WHERE s.id = f.session_id AND f.church_id <> s.church_id;

-- 7. Membership check used by RLS policies in the cutover migration ---------------

CREATE FUNCTION public.is_church_member(target UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = target AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM network_admins WHERE user_id = auth.uid())
$$;

-- 8. Lock the new tables and functions away from the publishable key ---------------

ALTER TABLE public.churches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_admins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_times      ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.legacy_default_church()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_church_member(UUID)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.attendance_fill_service_time() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attendance_same_church()       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_church_member(UUID)        TO authenticated;
-- Column defaults run as the inserting role, so today's anon-key code still needs this one.
GRANT  EXECUTE ON FUNCTION public.legacy_default_church()      TO anon, authenticated;
