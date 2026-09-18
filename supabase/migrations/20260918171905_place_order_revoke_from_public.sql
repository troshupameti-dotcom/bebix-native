-- `place_order` eshte SECURITY DEFINER dhe ishte e thirrshme nga roli
-- `anon` permes /rest/v1/rpc/place_order.
--
-- Kujdes: `revoke ... from anon` VETEM nuk mjafton. Postgres-i ua jep
-- EXECUTE funksioneve rolit PUBLIC si parazgjedhje, dhe anon e trashegon
-- prej andej — provova ashtu dhe e drejta mbeti. Duhet hequr nga PUBLIC.
--
-- APLIKUAR TASHME ne projekt (version 20260918171905).

revoke execute on function public.place_order(text, text, text, text, jsonb) from public;
revoke execute on function public.place_order(text, text, text, text, jsonb) from anon;

grant execute on function public.place_order(text, text, text, text, jsonb) to authenticated;
grant execute on function public.place_order(text, text, text, text, jsonb) to service_role;
