-- Phase 3: a headcount-only Staff role, and a key that marks a church's own check-in devices.
-- No behaviour change for existing users: nobody is Staff yet, and kiosk_key is unused until the phase 3 code ships.

ALTER TABLE public.church_memberships DROP CONSTRAINT church_memberships_role_check;
ALTER TABLE public.church_memberships ADD CONSTRAINT church_memberships_role_check
  CHECK (role IN ('lead', 'volunteer', 'staff'));

-- Staff never read kids' records: every data policy goes through this function, so it skips them.
-- Their headcount numbers are computed on the server with the secret key.
CREATE OR REPLACE FUNCTION public.is_church_member(target UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = target AND user_id = auth.uid() AND role <> 'staff')
      OR EXISTS (SELECT 1 FROM network_admins WHERE user_id = auth.uid())
$$;

-- Check-in devices carry this key in a cookie. Changing it switches every device off.
ALTER TABLE public.churches ADD COLUMN kiosk_key UUID NOT NULL DEFAULT gen_random_uuid();
