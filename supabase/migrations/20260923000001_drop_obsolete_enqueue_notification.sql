-- Ekzistonin dy versione te enqueue_notification (7 dhe 8 parametra); nje
-- migrim me perpara e kishte shtuar versionin e ri me CREATE OR REPLACE
-- me nje liste te ndryshme parametrash, gje qe ne Postgres krijon nje
-- mbingarkese (overload) te re ne vend qe te zevendesoje te vjetrin.
-- Kjo bente thirrjet me 6 argumente (psh. nga notify_customer_order_status)
-- te jene te paqarta ("is not unique"). Versioni me 8 parametra eshte
-- superset i plote (shton vetem p_expires_at, qe eshte NULL si default),
-- keshtu qe thjesht fshijme mbingarkesen e vjeter.
drop function if exists public.enqueue_notification(uuid, text, text, text, jsonb, text, timestamptz);
