-- Enable the tables used by backend SSE in Supabase Realtime.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'order_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'reservations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    END IF;
  ELSE
    RAISE WARNING 'Publication supabase_realtime does not exist; enable Realtime in Supabase first';
  END IF;
END $$;

-- DELETE payloads need the old row values to resolve the affected branch.
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

COMMIT;
