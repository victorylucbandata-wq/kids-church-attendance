-- Erase a member's personal data on request (Data Privacy Act; Every Nation / Victory privacy policies:
-- "destroy or de-identify personal information"). One transaction, run as the signed-in Lead (RLS applies).
-- With check-in history: every personal detail is erased but the anonymous record stays, so past
-- headcounts don't change. Without history: the record is deleted outright.
CREATE FUNCTION public.erase_member(target UUID) RETURNS TEXT
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ch UUID;
BEGIN
  SELECT church_id INTO ch FROM members WHERE id = target;
  IF ch IS NULL THEN RAISE EXCEPTION 'member not found' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT is_church_lead(ch) THEN
    RAISE EXCEPTION 'only a church Lead can erase a member' USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM roster WHERE member_id = target;

  IF NOT EXISTS (SELECT 1 FROM attendance WHERE member_id = target)
     AND NOT EXISTS (SELECT 1 FROM first_timers WHERE member_id = target) THEN
    DELETE FROM members WHERE id = target;
    RETURN 'deleted';
  END IF;

  UPDATE attendance SET notes = NULL WHERE member_id = target;
  UPDATE first_timers SET parent_name = NULL, contact_number = NULL, child_first_name = 'Removed',
    child_last_name = 'member', child_nickname = NULL, birthday = NULL, age = NULL, notes = NULL
    WHERE member_id = target;
  UPDATE members SET first_name = 'Removed', last_name = 'member', nickname = NULL, birthday = NULL,
    parent_name = NULL, contact_number = NULL, notes = NULL, is_active = false, updated_at = now()
    WHERE id = target;
  RETURN 'erased';
END $$;
REVOKE EXECUTE ON FUNCTION public.erase_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erase_member(UUID) TO authenticated;
