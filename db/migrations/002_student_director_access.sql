INSERT INTO roles (code, name)
VALUES
  ('DIRECTOR', 'Директор'),
  ('STUDENT', 'Ученик')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE code = 'DIRECTOR')
WHERE LOWER(TRIM(username)) = 'линукс линуксович';

UPDATE users
SET role_id = (SELECT id FROM roles WHERE code = 'STUDENT')
WHERE role_id IS NULL
   OR role_id = (SELECT id FROM roles WHERE code = 'ADMIN');

UPDATE users
SET role_id = (SELECT id FROM roles WHERE code = 'DIRECTOR')
WHERE LOWER(TRIM(username)) = 'линукс линуксович';
