/* Forward migrations, applied in order by loadData().

   Each key N is a function upgrading a v(N) record to v(N+1). Adding a field is
   usually free (normalizeData fills defaults); a migration is needed when the
   MEANING of stored data changes — e.g. if symptomBurden's definition ever
   changes, its migration recomputes every stored value. */

import { SCHEMA_VERSION } from './schema.js';

export const migrations = {
  // 1: (data) => ({ ...data, schemaVersion: 2, /* ... */ }),
};

export function migrate(data) {
  let current = data;
  let guard = 0;
  while (current.schemaVersion < SCHEMA_VERSION && guard < 50) {
    const step = migrations[current.schemaVersion];
    if (!step) {
      // No path forward: stamp it current rather than looping. normalizeData has
      // already filled any missing fields with defaults.
      return { ...current, schemaVersion: SCHEMA_VERSION };
    }
    current = step(current);
    guard += 1;
  }
  return current;
}
