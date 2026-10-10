-- Church isolation tests (docs/multi-church-implementation-plan.md, section 6).
-- Always rolled back: seeds two throwaway churches, then acts as each role and asserts what it can see.
--
-- Before cutover (migration 2 not yet applied):
--   psql "$SUPABASE_DB_URL" -X -q -v apply_cutover=1 -f supabase/tests/isolation.sql
-- After cutover:
--   psql "$SUPABASE_DB_URL" -X -q -v apply_cutover=0 -f supabase/tests/isolation.sql
\set ON_ERROR_STOP on
BEGIN;
\if :apply_cutover
\i supabase/migrations/20260927000002_multi_church_rls_cutover.sql
\endif

-- Seed (as the database owner) -------------------------------------------------------
CREATE TEMP TABLE t (k TEXT PRIMARY KEY, id UUID) ON COMMIT DROP;
GRANT SELECT ON t TO anon, authenticated;
INSERT INTO t VALUES
  ('church_a', gen_random_uuid()), ('church_b', gen_random_uuid()),
  ('lead_a', gen_random_uuid()), ('vol_a', gen_random_uuid()), ('lead_b', gen_random_uuid()),
  ('net', gen_random_uuid()), ('stranger', gen_random_uuid()), ('staff_a', gen_random_uuid());

INSERT INTO auth.users (id, email, aud, role)
SELECT id, k || '@isolation.test', 'authenticated', 'authenticated' FROM t WHERE k IN ('lead_a','vol_a','lead_b','net','stranger','staff_a');

INSERT INTO churches (id, name, slug) SELECT id, k, replace(k, '_', '-') || '-iso' FROM t WHERE k LIKE 'church_%';
INSERT INTO church_memberships (church_id, user_id, role) VALUES
  ((SELECT id FROM t WHERE k='church_a'), (SELECT id FROM t WHERE k='lead_a'), 'lead'),
  ((SELECT id FROM t WHERE k='church_a'), (SELECT id FROM t WHERE k='vol_a'),  'volunteer'),
  ((SELECT id FROM t WHERE k='church_b'), (SELECT id FROM t WHERE k='lead_b'), 'lead'),
  ((SELECT id FROM t WHERE k='church_a'), (SELECT id FROM t WHERE k='staff_a'), 'staff');
INSERT INTO network_admins VALUES ((SELECT id FROM t WHERE k='net'));

DO $$
DECLARE c TEXT; ch UUID; s UUID; m UUID; st UUID;
BEGIN
  FOREACH c IN ARRAY ARRAY['church_a','church_b'] LOOP
    SELECT id INTO ch FROM t WHERE k = c;
    INSERT INTO service_times (church_id, label) VALUES (ch, '9:00 AM') RETURNING id INTO st;
    INSERT INTO age_groups (church_id, name) VALUES (ch, 'Kids');
    INSERT INTO sessions (church_id, session_date) VALUES (ch, DATE '2099-01-04') RETURNING id INTO s;
    INSERT INTO members (church_id, first_name, last_name, role) VALUES (ch, 'Child', c, 'child') RETURNING id INTO m;
    INSERT INTO attendance (church_id, session_id, member_id, service_time_id, time_slot, checked_in) VALUES (ch, s, m, st, '9am', true);
    INSERT INTO first_timers (church_id, session_id, member_id, child_first_name, child_last_name) VALUES (ch, s, m, 'Child', c);
  END LOOP;
END $$;

-- Assertion helper: count rows of a table visible to the current role, filtered to one church.
CREATE FUNCTION pg_temp.visible(tbl TEXT, church UUID) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE n BIGINT; col TEXT := CASE WHEN tbl = 'churches' THEN 'id' ELSE 'church_id' END;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', tbl, col) INTO n USING church;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN -1;  -- no table privilege at all: also "cannot see"
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.visible(TEXT, UUID) TO anon, authenticated;

CREATE FUNCTION pg_temp.as_user(who TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM t WHERE k = who), 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(TEXT) TO authenticated;

\echo '1. publishable key (anon) sees nothing in any kids table'
SET LOCAL ROLE anon;
DO $$ DECLARE tbl TEXT; n BIGINT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['members','age_groups','sessions','attendance','first_timers','service_times','churches'] LOOP
    n := pg_temp.visible(tbl, (SELECT id FROM t WHERE k='church_a'));
    IF n > 0 THEN RAISE EXCEPTION 'FAIL 1: anon sees % rows in %', n, tbl; END IF;
  END LOOP;
  RAISE NOTICE 'PASS 1';
END $$;
RESET ROLE;

\echo '2. church A lead sees all of A and none of B, and cannot write into B'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('lead_a');
DO $$ DECLARE tbl TEXT; a UUID := (SELECT id FROM t WHERE k='church_a'); b UUID := (SELECT id FROM t WHERE k='church_b'); BEGIN
  FOREACH tbl IN ARRAY ARRAY['members','age_groups','sessions','attendance','first_timers','service_times','churches'] LOOP
    IF pg_temp.visible(tbl, a) < 1 THEN RAISE EXCEPTION 'FAIL 2: lead A cannot see own %', tbl; END IF;
    IF pg_temp.visible(tbl, b) <> 0 THEN RAISE EXCEPTION 'FAIL 2: lead A sees church B %', tbl; END IF;
  END LOOP;
  BEGIN
    INSERT INTO members (church_id, first_name, last_name) VALUES (b, 'Intruder', 'X');
    RAISE EXCEPTION 'FAIL 2: lead A inserted a member into church B';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE members SET notes = 'tampered' WHERE church_id = b;
  DELETE FROM attendance WHERE church_id = b;
  RAISE NOTICE 'PASS 2 (reads)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM members WHERE notes = 'tampered') THEN RAISE EXCEPTION 'FAIL 2: lead A updated church B'; END IF;
  IF (SELECT count(*) FROM attendance WHERE church_id = (SELECT id FROM t WHERE k='church_b')) <> 1 THEN RAISE EXCEPTION 'FAIL 2: lead A deleted church B attendance'; END IF;
  RAISE NOTICE 'PASS 2 (writes blocked)';
END $$;

\echo '3. church A volunteer cannot manage access'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('vol_a');
DO $$ BEGIN
  BEGIN
    INSERT INTO church_memberships (church_id, user_id, role)
    VALUES ((SELECT id FROM t WHERE k='church_a'), (SELECT id FROM t WHERE k='stranger'), 'lead');
    RAISE EXCEPTION 'FAIL 3: volunteer added a member';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM church_memberships WHERE user_id = (SELECT id FROM t WHERE k='lead_a');
  IF pg_temp.visible('members', (SELECT id FROM t WHERE k='church_a')) < 1 THEN RAISE EXCEPTION 'FAIL 3: volunteer cannot do normal work'; END IF;
  RAISE NOTICE 'PASS 3 (volunteer insert blocked, normal work allowed)';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM church_memberships WHERE user_id = (SELECT id FROM t WHERE k='lead_a')) THEN RAISE EXCEPTION 'FAIL 3: volunteer removed the lead'; END IF;
  RAISE NOTICE 'PASS 3 (volunteer delete blocked)';
END $$;

\echo '3b. a lead manages only their own church team'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('lead_a');
DO $$ BEGIN
  INSERT INTO church_memberships (church_id, user_id, role)
  VALUES ((SELECT id FROM t WHERE k='church_a'), (SELECT id FROM t WHERE k='stranger'), 'volunteer');
  BEGIN
    INSERT INTO church_memberships (church_id, user_id, role)
    VALUES ((SELECT id FROM t WHERE k='church_b'), (SELECT id FROM t WHERE k='stranger'), 'lead');
    RAISE EXCEPTION 'FAIL 3b: lead A added someone to church B';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS 3b';
END $$;
RESET ROLE;

\echo '4. a signed-in user with no membership sees nothing'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('lead_b');
DELETE FROM church_memberships WHERE false;  -- no-op, keeps psql output tidy
RESET ROLE;
DELETE FROM church_memberships WHERE user_id = (SELECT id FROM t WHERE k='stranger');
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('stranger');
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['members','attendance','first_timers','churches'] LOOP
    IF pg_temp.visible(tbl, (SELECT id FROM t WHERE k='church_a')) <> 0 OR pg_temp.visible(tbl, (SELECT id FROM t WHERE k='church_b')) <> 0 THEN
      RAISE EXCEPTION 'FAIL 4: non-member sees %', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS 4 (removed member loses access immediately)';
END $$;
RESET ROLE;

\echo '5. network admin sees both churches'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('net');
DO $$ BEGIN
  IF pg_temp.visible('members', (SELECT id FROM t WHERE k='church_a')) < 1 OR pg_temp.visible('members', (SELECT id FROM t WHERE k='church_b')) < 1 THEN
    RAISE EXCEPTION 'FAIL 5: network admin cannot see both churches';
  END IF;
  RAISE NOTICE 'PASS 5';
END $$;
RESET ROLE;

\echo '6. attendance cannot mix churches'
DO $$ BEGIN
  INSERT INTO attendance (church_id, session_id, member_id, service_time_id, time_slot, checked_in)
  SELECT (SELECT id FROM t WHERE k='church_a'), s.id, m.id, st.id, '9am', true
  FROM sessions s, members m, service_times st
  WHERE s.church_id = (SELECT id FROM t WHERE k='church_a') AND m.church_id = (SELECT id FROM t WHERE k='church_b')
    AND st.church_id = (SELECT id FROM t WHERE k='church_a') LIMIT 1;
  RAISE EXCEPTION 'FAIL 6: cross-church attendance accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 6';
END $$;

\echo '6b. a member cannot point at another church''s age group'
DO $$ BEGIN
  UPDATE members SET age_group_id = (SELECT id FROM age_groups WHERE church_id = (SELECT id FROM t WHERE k='church_b'))
  WHERE church_id = (SELECT id FROM t WHERE k='church_a');
  RAISE EXCEPTION 'FAIL 6b: cross-church age group accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS 6b';
END $$;

\echo '6c. Staff (headcount only) see no kids records, even in their own church'
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('staff_a');
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['members','attendance','first_timers','sessions','roster'] LOOP
    IF pg_temp.visible(tbl, (SELECT id FROM t WHERE k='church_a')) > 0 THEN RAISE EXCEPTION 'FAIL 6c: staff see %', tbl; END IF;
  END LOOP;
  RAISE NOTICE 'PASS 6c';
END $$;
RESET ROLE;

\echo '7. existing Lucban data untouched by the tests'
SELECT count(*) AS lucban_members FROM members WHERE church_id = (SELECT id FROM churches WHERE slug = 'lucban');

ROLLBACK;
\echo 'ALL ISOLATION TESTS PASSED (rolled back)'
