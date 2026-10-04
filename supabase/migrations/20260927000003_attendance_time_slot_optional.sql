-- Stage 1 transition: the new code records service_time_id instead of the legacy time_slot text.
-- Safe to apply while the old code is still live: it always writes a valid time_slot, and the
-- transition trigger from 20260927000001 keeps filling service_time_id for those rows.
ALTER TABLE public.attendance DROP CONSTRAINT attendance_time_slot_check;
ALTER TABLE public.attendance ALTER COLUMN time_slot DROP NOT NULL;
