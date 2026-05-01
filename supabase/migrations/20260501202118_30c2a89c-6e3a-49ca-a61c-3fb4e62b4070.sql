-- Atomic credit deduction function to prevent race conditions
CREATE OR REPLACE FUNCTION public.deduct_credit(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits integer;
BEGIN
  UPDATE user_usage
  SET credits_available = credits_available - 1
  WHERE user_id = _user_id
    AND credits_available > 0
  RETURNING credits_available INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_credits;
END;
$$;

-- Only callable by authenticated users (and service role internally)
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid) FROM anon;
