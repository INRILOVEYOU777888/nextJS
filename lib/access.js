import { NextResponse } from 'next/server';
import pool from './db';
import { runMigrations } from './migrations';
import { verifySession } from './session';

const DIRECTOR_NAMES = new Set(['линукс линуксович']);
const DIRECTOR_ROLES = new Set(['DIRECTOR']);

export function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function roleForName(name) {
  return DIRECTOR_NAMES.has(normalizeName(name)) ? 'DIRECTOR' : 'STUDENT';
}

export function normalizeRole(role) {
  return String(role || 'STUDENT').toUpperCase();
}

export function isDirector(user) {
  return Boolean(user && DIRECTOR_ROLES.has(normalizeRole(user.role)));
}

export function requireSession(request) {
  return verifySession(request.cookies.get('session')?.value);
}

export async function loadCurrentUser(user, client = pool) {
  if (!user?.id) return user;

  await runMigrations();

  const { rows } = await client.query(
    `SELECT u.id, u.username AS name, u.email, COALESCE(r.code, 'STUDENT') AS role
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1
     LIMIT 1`,
    [user.id]
  );

  return rows[0] || user;
}

export async function requireDirector(request) {
  const user = requireSession(request);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const currentUser = await loadCurrentUser(user);
  if (!isDirector(currentUser)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user: currentUser };
}

export async function findStudentForUser(user, client = pool) {
  if (!user) return null;

  const { rows } = await client.query(
    `SELECT id, full_name, phone, direction, teacher, comment, created_at
     FROM students
     WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.name || '']
  );

  return rows[0] || null;
}
