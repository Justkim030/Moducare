# Contributing to ModuCare MS

This guide prevents the most common failure we hit as a team: **"it worked locally, then broke after a push."**
That symptom is almost always one of two things — (1) only one of the two servers was running, or
(2) Django migrations drifted between machines. Read this before pushing.

---

## 1. Local development (you MUST run BOTH servers)

The app is a React SPA (Vite, port 5173) talking to a Django REST API (port 8000).
If you only start one, every API call fails and the UI looks "broken."

### Terminal A — Backend (Django)
```bash
cd backend
..\venv\Scripts\activate            # Windows  (or: source ../.venv/bin/activate on Linux/Mac)
pip install -r requirements.txt     # first time only
python manage.py migrate
python manage.py create_test_users   # optional: seeds the 10 role accounts (password: password123)
python manage.py runserver 8000
```
Backend is live at `http://localhost:8000` (`/api/health/` returns `{"ok":true}`).

### Terminal B — Frontend (Vite)
```bash
cd frontend
npm install                         # first time only
npm run dev                         # serves http://localhost:5173
```
Open `http://localhost:5173`. The SPA calls the backend at `http://localhost:8000`
(via `VITE_API_URL`, defaulting in `src/api/api.js`). No proxy needed for local dev.

> Production note: in production the React build (`frontend/dist`) is served *by* Django
> (see `backend/urls.py` catch-all + `STATICFILES_DIRS`). The two-server setup above is dev-only.

---

## 2. Git workflow (avoids the merge-commit churn)

We share one `main` branch. **Always rebase, never merge-pull.**

```bash
git config --global pull.rebase true     # one-time
git pull                                 # now rebases your work on top of main
# ... make changes ...
npm run lint && npm run build            # frontend: must pass before commit
python manage.py check                   # backend: must pass before commit
git add -p
git commit -m "short, clear message"
git push
```

If `git push` is rejected ("non-fast-forward"), **do not** force-push and **do not** `git pull`
without `--rebase`. Run `git pull --rebase`, resolve any conflicts, then push.

---

## 3. Database migrations (the #1 cause of "broken after pull")

Migrations are committed to the repo and **must stay consistent across machines.**

- **Never** add `backend/*/migrations/*.py` to `.gitignore` (an ignored-migrations workflow breaks
  fresh clones — `migrate` would have nothing to apply).
- After pulling, before running the server, verify migrations are in sync:
  ```bash
  cd backend
  python manage.py migrate --plan     # should print "No planned migration operations."
  python manage.py migrate            # apply if anything is pending
  ```
- If two people each generated a migration with the same number (e.g. two `0003_*.py` leaves),
  **do not** both commit. Whoever pulls second must regenerate cleanly:
  ```bash
  git fetch
  # delete your locally-generated conflicting migration file(s), then:
  python manage.py makemigrations <app>   # re-creates a single correct leaf
  ```
- The local SQLite DB (`hospital_db.sqlite3`) and `.env` are gitignored. They are **not** shared.
  Each developer recreates their DB with `migrate` + `create_test_users`.

---

## 4. Code quality gates (run before every commit)

Frontend:
```bash
cd frontend
npm run lint     # must report 0 errors
npm run build    # must succeed
```
Backend:
```bash
cd backend
python manage.py check
```

---

## 5. Login (seeded test accounts)

All use password `password123`:

| Username | Email | Role |
|----------|-------|------|
| admin2 | admin2@test.com | ADMIN |
| doctor1 | doctor1@test.com | DOCTOR |
| chemist1 | chemist1@test.com | CHEMIST |
| store_manager1 | store_manager1@test.com | STORE_MANAGER |
| qa1 | qa1@test.com | QUALITY_ASSURANCE |
| triage1 | triage1@test.com | TRIAGE |
| nurse1 | nurse1@test.com | NURSE |
| receptionist1 | receptionist1@test.com | RECEPTIONIST |
| accountant1 | accountant1@test.com | ACCOUNTANT |
| labtech1 | labtech1@test.com | LAB_TECH |

Login with **email or username** at `POST /api/login/`. JWT is stored in `localStorage` as `authToken`.
