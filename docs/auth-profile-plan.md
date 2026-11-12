# Plan: Sign up, Login, and Farmer Profile

Status: approved 2026-11-11 with the default answers below; built, awaiting commit (Gate 2). Size tier: **standard** (auth is a security
trigger, so full TDD plus a security review; a browser walk at the end because it has a UI).

## Goal

A farmer can create an account, sign in, fill in a profile with their farm's durable
facts, and have the Crop Finder prefilled from that profile. Session survives a page
reload. Guests are sent to the login page when they open an app route.

## Decision: where auth lives

**Flask + SQLite + Werkzeug password hashing + Flask signed session cookie.**
Zero new dependencies: Flask 3.1 and Werkzeug 3.1 are already in the venv, `sqlite3`
is in the standard library. The frontend reaches Flask through a Next.js rewrite so the
browser sees one origin and the session cookie is first-party.

Not chosen: Supabase Auth (new external service, new npm packages, account setup,
network dependency on demo day) and Auth.js / better-auth (new packages plus a
database adapter, more moving parts than the Flask route for the same result).
Switch to Supabase if any of these become must-haves: Google / phone login, email
verification, password reset emails.

## Data model (SQLite, `clim_backend/climai.db`, git-ignored)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE TABLE profiles (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  farm_name         TEXT,
  location_label    TEXT NOT NULL,
  lat               REAL NOT NULL,
  lon               REAL NOT NULL,
  farm_size         REAL NOT NULL,
  size_unit         TEXT NOT NULL,          -- acres | hectares
  soil_type         TEXT,                   -- Clay | Silt | Loam | Sandy | Not sure
  irrigated         INTEGER NOT NULL,       -- 0 | 1
  irrigation_method TEXT,
  current_crops     TEXT NOT NULL,          -- JSON array of strings
  updated_at        TEXT NOT NULL
);
```

Profile fields are exactly the durable inputs the Crop Finder and the backend scorer
already consume (location, size, soil, irrigation, crops) plus name, optional phone and
optional farm name. Goals, challenges, planting season and harvest notes stay on the
Crop Finder because they change per request.

## API (Flask, same JSON error envelope as `/api/crop-analysis`)

| Method | Path | Body | Success | Errors |
|--------|------|------|---------|--------|
| POST | `/api/auth/signup` | `{email, password}` | 201 `{user:{id,email}, profile:null}` | 400 invalid email / password shorter than 8 or longer than 128, 409 email taken |
| POST | `/api/auth/login` | `{email, password}` | 200 `{user, profile}` | 401 "Email or password is incorrect", 429 after 10 failures per email+IP in 15 min |
| POST | `/api/auth/logout` | none | 204 | none |
| GET | `/api/auth/me` | none | 200 `{user, profile}` | 401 |
| PUT | `/api/profile` | profile fields (camelCase) | 200 `{profile}` | 400 validation, 401 |

Security choices:

- Passwords hashed with `werkzeug.security.generate_password_hash` (scrypt by default).
- Session is Flask's signed cookie: `HttpOnly`, `SameSite=Lax`, `Secure` outside debug,
  30-day lifetime. `SECRET_KEY` comes from `CLIMAI_SECRET_KEY`; the app refuses to start
  without it. A `.env.example` documents it.
- Mutating routes require a JSON body (`get_json(silent=True)` returning `None` is a 400),
  which with `SameSite=Lax` blocks form-post CSRF.
- Login failures return one generic message so emails cannot be enumerated.
- Login rate limit is an in-memory counter (`ponytail:` comment, upgrade to
  Flask-Limiter behind a shared store when running more than one process).
- Profile validation reuses the existing `in_range`, soil and unit constants, moved out of
  `app.py` into `validation.py` so auth and crop analysis share one source of truth.

## Frontend

- `next.config.mjs`: `rewrites()` mapping `/backend/:path*` to
  `${BACKEND_URL}/api/:path*` (server-side env, default `http://127.0.0.1:5001`).
- `lib/api.ts`: one `apiFetch(path, init)` helper that sends JSON, keeps cookies, and
  turns `{error}` bodies into thrown messages (same logic the Crop Finder has inline today).
- `lib/session.ts`: `parseSession(data)` type guard for the `/me` payload, with
  `lib/session.test.mjs` under the existing `node --test` harness.
- `components/providers/auth-provider.tsx`: context `{status: loading|guest|authed, user,
  profile, refresh, logout}`; fetches `/backend/auth/me` once on mount. Mounted inside
  `AppShell` next to `AppDataProvider`.
- `components/auth/auth-form.tsx`: one form with a `mode` prop for `/login` and `/signup`.
  Native validation (`type="email" required`, `minLength={8}`), no confirm-password
  field. On success route to `/profile` when the profile is missing, else `/dashboard`.
- `app/login/page.tsx`, `app/signup/page.tsx`: thin pages. `AppShell` renders these and
  `/` without the sidebar.
- `components/shared/farm-location-search.tsx`: the Nominatim search block lifted out of
  `crop-finder.tsx` so the profile form and the Crop Finder share it.
- `components/profile/profile-form.tsx` + `app/profile/page.tsx`: the fields above,
  prefilled from the current profile, `PUT /backend/profile` on save.
- `AppShell`: "Profile" nav item; sidebar footer shows the signed-in email with a Sign out
  button, or a Sign in link for guests. Guests on any app route are redirected to
  `/login?next=<path>` once `/me` resolves; a loading state covers the gap.
- Crop Finder: `defaultValue`s and the selected location come from the profile.

## Slices, in order

1. **Backend auth** (`db.py`, `auth.py`, `validation.py`, `test_auth.py`, `app.py` wiring,
   `.env.example`). Demo: curl signup, login, me, logout.
2. **Sign up / login in the browser** (rewrite, `api.ts`, `session.ts` + test,
   `AuthProvider`, `auth-form.tsx`, two pages, shell changes). Demo: sign up, land on
   dashboard, reload, still signed in, sign out.
3. **Backend profile** (`profile.py`, `test_profile.py`).
4. **Profile page** (`farm-location-search.tsx` extraction, `profile-form.tsx`, page, nav
   item, post-signup redirect). Demo: fill profile, reload, values persist.
5. **Route guard** for guests.
6. **Crop Finder prefill** from the profile.

MUST-DEMO: 1 to 5. NICE: 6 (small, high payoff). CUT: email verification, password
reset, OAuth, avatar upload, multiple farms per user, admin screens, remember-me toggle.

## Tests

- Backend `unittest`, mirroring `test_app.py`: signup success / duplicate / weak
  password / bad email; login success / wrong password (generic message) / rate limit;
  `me` 401 then 200; logout clears the session; profile PUT rejects bad lat, lon, size,
  soil, unit, and 401 without a session; profile upsert returns the saved row.
- Frontend `node --test`: `parseSession` accepts a valid payload, rejects malformed ones.
- No component test runner is installed; slice-by-slice browser walk (browser-qa) covers
  the pages, with zero console errors as the bar.

## Review

`security-reviewer` on slices 1 and 3 (auth, user input, database). `typescript-reviewer`
on slices 2, 4, 5, 6. CRITICAL and HIGH findings fixed before Gate 2.

## Open questions (defaults apply if unanswered)

1. Auth home: Flask + SQLite as above. Default yes.
2. Profile fields: the list above. Default yes.
3. Phone number: optional. Default optional.
