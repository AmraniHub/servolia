-- One Stripe subscription = one client. (2026-09-22)
--
-- The webhook already refuses a second client row for a subscription it has
-- seen, and the receptionist branch claims the payment on its trial row
-- first (completeReceptionistPurchase). This index is the database's own
-- guarantee under both: two deliveries of one payment arriving in the same
-- instant can then never both insert, whichever branch they take. The code
-- treats the resulting error (23505) as "the other delivery won; retry".
--
-- Run in the Supabase SQL editor. Step 1 first: the index cannot be created
-- while duplicates exist, and it tells you which ones.

-- 1. Any subscription already on two client rows? (expect no rows)
select subscription_id, count(*) as rows, array_agg(id) as client_ids
from clients
where subscription_id is not null
group by subscription_id
having count(*) > 1;

-- 2. Only when step 1 returned nothing:
create unique index if not exists clients_subscription_id_unique
  on clients (subscription_id)
  where subscription_id is not null;
