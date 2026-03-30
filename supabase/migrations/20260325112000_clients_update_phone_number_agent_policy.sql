-- Allow clients to update which agent is assigned to their phone numbers.
-- RLS currently only grants clients SELECT on `phone_numbers`.
-- This policy enables UPDATE for `assigned_agent_id` while ensuring:
-- - the phone number belongs to the logged-in client (`assigned_client_id`)
-- - the chosen agent (if not null) belongs to the same client

CREATE POLICY "Clients can assign agents to their phone numbers"
ON public.phone_numbers
FOR UPDATE
USING (
  assigned_client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
  AND (
    assigned_agent_id IS NULL OR
    assigned_agent_id IN (
      SELECT a.id
      FROM public.agents a
      WHERE a.client_id IN (
        SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()
      )
    )
  )
);

