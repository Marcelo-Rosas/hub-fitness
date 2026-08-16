-- Harden Operator SECURITY DEFINER execute grants (advisor 0028/0029).
-- register_client_fdw / recompute_billing: service_role only.
-- is_operator_*: authenticated (RLS) + service_role; never anon.

REVOKE ALL ON FUNCTION public.register_client_fdw(text, text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_client_fdw(text, text, integer, text, text, text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.recompute_billing_for_period(uuid, char, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_billing_for_period(uuid, char, integer, integer, jsonb) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.is_operator_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operator_staff() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.is_operator_writer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operator_writer() TO authenticated, service_role, postgres;
