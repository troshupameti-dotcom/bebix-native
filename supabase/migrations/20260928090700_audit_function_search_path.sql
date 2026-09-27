-- Auditimi (28 shtator 2026): search_path i fiksuar per funksionet qe e kishin
-- te ndryshueshem (advisor: function_search_path_mutable). Pa kete, nje
-- funksion mund te gjente nje tabele/funksion me te njejtin emer ne nje skeme
-- tjeter, sipas search_path te thirresit.

alter function public.set_updated_at() set search_path = public;
alter function public.notification_default(text) set search_path = public;
alter function public.get_applicable_commission(uuid, uuid) set search_path = public;
alter function public.checkout_process_order_items(uuid, jsonb) set search_path = public;
