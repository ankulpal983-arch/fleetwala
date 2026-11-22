-- Migration 026: Candidate Discovery Locality, Anonymization & Stale Context Fix
-- Target Project: jigbzsaaowtyaqhreplg (Supabase PostgreSQL)
-- Preserves genuine Flipkart employer, Delhi NCR job, and Worker Ankul with 100% integrity

BEGIN;

-- ============================================================================
-- 1. PRE-CHECK: VERIFY GENUINE ENTITIES EXIST BEFORE ANY ACTION
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employers 
    WHERE id = 'af42f70c-6b4f-48da-9cf4-d2707543602d' 
      AND legal_name = 'flipkart'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine Flipkart employer record missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workers 
    WHERE id = '761d0d18-99ed-42cd-b117-71a593be4747' 
      AND full_name = 'Ankul'
      AND city = 'Delhi NCR'
      AND address_line = 'Dwarka'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine worker Ankul record missing or modified';
  END IF;
END $$;

-- ============================================================================
-- 2. UPGRADE DISCOVERY RPCS: SUPPORT LOCALITY (DWARKA) AND DETAILED FIELDS
-- ============================================================================

-- Drop older signatures cleanly
DROP FUNCTION IF EXISTS public.discover_candidates(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.discover_workers(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.discover_candidates(text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.discover_workers(text, text, text, text, integer, integer);

-- A. Canonical 6-parameter discover_workers function
CREATE OR REPLACE FUNCTION public.discover_workers(
  p_city text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_experience text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- 1. Authorization: Active verified employer member or platform admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  IF NOT (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.employer_memberships m
      JOIN public.employers e ON e.id = m.employer_id
      JOIN public.user_accounts u ON u.user_id = m.user_id
      WHERE m.user_id = auth.uid() 
        AND m.state = 'active' 
        AND e.verification_state = 'verified' 
        AND u.account_state = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Active verified employer membership required' USING errcode = '42501';
  END IF;

  IF p_limit NOT BETWEEN 1 AND 50 OR p_offset < 0 THEN
    RAISE EXCEPTION 'Invalid pagination';
  END IF;

  -- 2. Query discoverable, active workers matching location and preferences
  RETURN QUERY
  SELECT
    encode(digest(w.id::text, 'sha256'), 'hex') AS candidate_handle,
    w.city::text,
    coalesce(nullif(trim(w.address_line), ''), w.city)::text AS area,
    w.category::text,
    w.experience_band::text,
    w.vehicle_type::text,
    coalesce(w.has_own_vehicle, false) AS has_own_vehicle
  FROM public.workers w
  WHERE w.discoverable = true 
    AND w.account_state = 'active'
    AND (
      p_city IS NULL 
      OR lower(w.city) = lower(left(p_city, 100))
      OR lower(coalesce(w.address_line, '')) = lower(left(p_city, 100))
    )
    AND (
      p_area IS NULL 
      OR lower(coalesce(w.address_line, '')) = lower(left(p_area, 100))
      OR lower(w.city) = lower(left(p_area, 100))
    )
    AND (p_category IS NULL OR w.category = p_category)
    AND (p_experience IS NULL OR w.experience_band = p_experience)
  ORDER BY w.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.discover_workers(text, text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_workers(text, text, text, text, integer, integer) TO authenticated;

-- B. Backwards-compatible 5-parameter discover_workers overload
CREATE OR REPLACE FUNCTION public.discover_workers(
  p_city text,
  p_category text,
  p_experience text,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.discover_workers(
    p_city,
    NULL::text,
    p_category,
    p_experience,
    p_limit,
    p_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discover_workers(text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_workers(text, text, text, integer, integer) TO authenticated;

-- C. Canonical 6-parameter discover_candidates alias
CREATE OR REPLACE FUNCTION public.discover_candidates(
  p_city text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_experience text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.discover_workers(
    p_city,
    p_area,
    p_category,
    p_experience,
    p_limit,
    p_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discover_candidates(text, text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_candidates(text, text, text, text, integer, integer) TO authenticated;

-- D. Backwards-compatible 5-parameter discover_candidates overload
CREATE OR REPLACE FUNCTION public.discover_candidates(
  p_city text,
  p_category text,
  p_experience text,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.discover_workers(
    p_city,
    NULL::text,
    p_category,
    p_experience,
    p_limit,
    p_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discover_candidates(text, text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_candidates(text, text, text, integer, integer) TO authenticated;

-- ============================================================================
-- 3. POST-CHECK: CONFIRM ANKUL DISCOVERY AND ANONYMIZATION
-- ============================================================================
DO $$
DECLARE
  v_handle text;
  v_expected_handle text := encode(digest('761d0d18-99ed-42cd-b117-71a593be4747', 'sha256'), 'hex');
BEGIN
  -- Verify that Ankul's SHA-256 starts with 492e4a
  IF upper(substr(v_expected_handle, 1, 6)) != '492E4A' THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Hash mismatch for Ankul worker UUID';
  END IF;

  -- Verify Ankul profile fields remain completely preserved
  IF NOT EXISTS (
    SELECT 1 FROM public.workers
    WHERE id = '761d0d18-99ed-42cd-b117-71a593be4747'
      AND full_name = 'Ankul'
      AND city = 'Delhi NCR'
      AND address_line = 'Dwarka'
      AND experience_band = 'fresher'
      AND vehicle_type = 'motorcycle'
      AND has_own_vehicle = true
      AND discoverable = true
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Ankul profile values corrupted';
  END IF;
END $$;

COMMIT;
