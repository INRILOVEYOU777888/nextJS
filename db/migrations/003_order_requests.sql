CREATE TABLE IF NOT EXISTS order_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  lessons_total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS lessons_total INTEGER;
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE order_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');
ALTER TABLE order_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE current_setting('TIMEZONE');

UPDATE order_requests
SET status = 'NEW'
WHERE status NOT IN ('NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_requests_lessons_total_check') THEN
    ALTER TABLE order_requests ADD CONSTRAINT order_requests_lessons_total_check CHECK (lessons_total IN (4, 8));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_requests_status_check') THEN
    ALTER TABLE order_requests ADD CONSTRAINT order_requests_status_check CHECK (status IN ('NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_requests_status_idx ON order_requests (status);
CREATE INDEX IF NOT EXISTS order_requests_user_id_idx ON order_requests (user_id);
CREATE INDEX IF NOT EXISTS order_requests_student_id_idx ON order_requests (student_id);
CREATE INDEX IF NOT EXISTS order_requests_created_at_idx ON order_requests (created_at DESC);
