-- Undo 20261010000002 (only once no membership has role 'staff').
ALTER TABLE public.churches DROP COLUMN kiosk_key;
CREATE OR REPLACE FUNCTION public.is_church_member(target UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = target AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM network_admins WHERE user_id = auth.uid())
$$;
ALTER TABLE public.church_memberships DROP CONSTRAINT church_memberships_role_check;
ALTER TABLE public.church_memberships ADD CONSTRAINT church_memberships_role_check CHECK (role IN ('lead', 'volunteer'));
