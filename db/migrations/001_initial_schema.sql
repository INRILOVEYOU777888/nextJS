CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

INSERT INTO roles (code, name)
VALUES
  ('DIRECTOR', 'Директор'),
  ('ADMIN', 'Администратор'),
  ('TEACHER', 'Преподаватель')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255),
  google_id TEXT,
  role_id INTEGER REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');

UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE code = 'ADMIN')
WHERE role_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uidx ON users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_id_idx ON users (role_id);

CREATE TABLE IF NOT EXISTS directions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rooms (name)
VALUES ('Кабинет 1'), ('Кабинет 2'), ('Кабинет 3'), ('Кабинет 4')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  direction TEXT NOT NULL,
  direction_id INTEGER REFERENCES directions(id),
  teacher TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS direction_id INTEGER REFERENCES directions(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');

INSERT INTO directions (name)
SELECT DISTINCT TRIM(direction)
FROM students
WHERE direction IS NOT NULL AND TRIM(direction) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO teachers (full_name)
SELECT DISTINCT TRIM(teacher)
FROM students
WHERE teacher IS NOT NULL AND TRIM(teacher) <> ''
ON CONFLICT (full_name) DO NOTHING;

UPDATE students s
SET direction_id = d.id
FROM directions d
WHERE s.direction_id IS NULL AND d.name = TRIM(s.direction);

UPDATE students s
SET teacher_id = t.id
FROM teachers t
WHERE s.teacher_id IS NULL AND t.full_name = TRIM(s.teacher);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lessons_total INTEGER NOT NULL,
  lessons_used INTEGER NOT NULL DEFAULT 0,
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lessons_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS purchased_at DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subscriptions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');

UPDATE subscriptions
SET expires_at = COALESCE(expires_at, purchased_at + INTERVAL '1 month');

UPDATE subscriptions
SET lessons_total = 4
WHERE lessons_total NOT IN (4, 8);

UPDATE subscriptions
SET lessons_used = GREATEST(0, LEAST(lessons_used, lessons_total));

UPDATE subscriptions
SET status = CASE
  WHEN lessons_used >= lessons_total THEN 'FINISHED'
  WHEN expires_at < CURRENT_DATE THEN 'EXPIRED'
  WHEN status IN ('ACTIVE', 'FINISHED', 'EXPIRED', 'CANCELLED') THEN status
  ELSE 'ACTIVE'
END;

ALTER TABLE subscriptions ALTER COLUMN expires_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  teacher TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id),
  room TEXT NOT NULL,
  room_id INTEGER REFERENCES rooms(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS room TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lessons ALTER COLUMN starts_at TYPE TIMESTAMPTZ USING starts_at AT TIME ZONE current_setting('TIMEZONE');
ALTER TABLE lessons ALTER COLUMN ends_at TYPE TIMESTAMPTZ USING ends_at AT TIME ZONE current_setting('TIMEZONE');
ALTER TABLE lessons ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE current_setting('TIMEZONE');
ALTER TABLE lessons ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');

INSERT INTO teachers (full_name)
SELECT DISTINCT TRIM(teacher)
FROM lessons
WHERE teacher IS NOT NULL AND TRIM(teacher) <> ''
ON CONFLICT (full_name) DO NOTHING;

INSERT INTO rooms (name)
SELECT DISTINCT TRIM(room)
FROM lessons
WHERE room IS NOT NULL AND TRIM(room) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE lessons l
SET teacher_id = t.id
FROM teachers t
WHERE l.teacher_id IS NULL AND t.full_name = TRIM(l.teacher);

UPDATE lessons l
SET room_id = r.id
FROM rooms r
WHERE l.room_id IS NULL AND r.name = TRIM(l.room);

UPDATE lessons
SET ends_at = starts_at + INTERVAL '1 hour'
WHERE ends_at <= starts_at;

UPDATE lessons
SET status = 'SCHEDULED'
WHERE status NOT IN ('SCHEDULED', 'VISITED', 'MISSED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  passed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS passed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE attendance ALTER COLUMN passed_at TYPE TIMESTAMPTZ USING passed_at AT TIME ZONE current_setting('TIMEZONE');
ALTER TABLE attendance ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TIMEZONE');

UPDATE attendance
SET status = 'VISITED'
WHERE status NOT IN ('VISITED', 'MISSED');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_lessons_total_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_lessons_total_check CHECK (lessons_total IN (4, 8));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_lessons_used_range_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_lessons_used_range_check CHECK (lessons_used >= 0 AND lessons_used <= lessons_total);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_dates_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_dates_check CHECK (expires_at >= purchased_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('ACTIVE', 'FINISHED', 'EXPIRED', 'CANCELLED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_dates_check') THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_dates_check CHECK (ends_at > starts_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_status_check') THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_status_check CHECK (status IN ('SCHEDULED', 'VISITED', 'MISSED', 'CANCELLED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_status_check') THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('VISITED', 'MISSED'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lessons_room_starts_at_uidx ON lessons (room, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS lessons_room_id_starts_at_uidx ON lessons (room_id, starts_at) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS students_direction_id_idx ON students (direction_id);
CREATE INDEX IF NOT EXISTS students_teacher_id_idx ON students (teacher_id);
CREATE INDEX IF NOT EXISTS subscriptions_student_id_idx ON subscriptions (student_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);
CREATE INDEX IF NOT EXISTS lessons_student_id_idx ON lessons (student_id);
CREATE INDEX IF NOT EXISTS lessons_subscription_id_idx ON lessons (subscription_id);
CREATE INDEX IF NOT EXISTS lessons_starts_at_idx ON lessons (starts_at);
CREATE INDEX IF NOT EXISTS lessons_teacher_id_idx ON lessons (teacher_id);
CREATE INDEX IF NOT EXISTS lessons_room_id_idx ON lessons (room_id);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx ON attendance (student_id);
CREATE INDEX IF NOT EXISTS attendance_subscription_id_idx ON attendance (subscription_id);
