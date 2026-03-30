ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS elevenlabs_event_type TEXT;

-- Prevent duplicates if webhook fires multiple times for the same call.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'bookings_elevenlabs_conversation_id_key'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_elevenlabs_conversation_id_key
      UNIQUE (elevenlabs_conversation_id);
  END IF;
END $$;

