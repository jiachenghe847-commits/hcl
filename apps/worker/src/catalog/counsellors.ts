/** Counsellor directory queries. JSON columns are parsed here, so the rest of the worker sees contract types. */
import { Counsellor } from '@haven/contracts';

interface CounsellorRow {
  id: string;
  display_name: string;
  languages: string;
  focus_areas: string;
  modes: string;
  bio: string;
}

const toCounsellor = (r: CounsellorRow): Counsellor =>
  Counsellor.parse({
    id: r.id,
    displayName: r.display_name,
    languages: JSON.parse(r.languages),
    focusAreas: JSON.parse(r.focus_areas),
    modes: JSON.parse(r.modes),
    bio: r.bio,
  });

export async function listCounsellors(db: D1Database): Promise<Counsellor[]> {
  const { results } = await db.prepare('SELECT * FROM counsellors ORDER BY id').all<CounsellorRow>();
  return results.map(toCounsellor);
}

export async function getCounsellor(db: D1Database, id: string): Promise<Counsellor | null> {
  const row = await db.prepare('SELECT * FROM counsellors WHERE id = ?').bind(id).first<CounsellorRow>();
  return row ? toCounsellor(row) : null;
}
