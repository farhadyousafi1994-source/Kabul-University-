import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Password / token hashing (shared by the mock API and its seed data).
//
// This lives in a leaf module on purpose. `db.js` needs hashPassword to seed
// its users, and it used to import it from `server.js` — which made db.js and
// server.js mutually dependent. Because `server.js` also pulls in the route
// modules (and `routes/backup.routes.js` reads `BACKUP_DIR` from db.js at
// module scope), anything that imported db.js *first* evaluated the route
// modules while db.js was still half-initialised and crashed with
// "Cannot access 'BACKUP_DIR' before initialization".
// A leaf module with no imports of its own breaks that cycle.
// ---------------------------------------------------------------------------

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export const hashPassword = (password) => sha256(`ku-ams:${password}`)
export const hashToken = (token) => sha256(`ku-token:${token}`)
