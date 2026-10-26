# Marks Help Desk (class-marks-problem-correction)

A simple, no-login web form where students report a **zero in CAT 2, FAT, or both**,
plus an admin screen to review, filter, message on WhatsApp and print or save as PDF.

## Rules the system enforces

- CAT 1 is not offered (no help for it).
- Only **English modules** can be submitted. Other modules show "please see the HOD in person".
- **Retakes** are never submitted here: collect the form at reception, submit it to the HOD.
- The same student cannot submit the same problem twice (unique index, friendly message).
- Intakes: September, January, June.
- Student UI is English or Arabic (Arabic switches the layout to right-to-left).

## Architecture

    Student phone (link shared in WhatsApp group)      Admin laptop (/admin)
                    |                                          |
                    v                                          v
    +--------------------------------------------------------------------+
    |  React + TypeScript (TSX) single-page app, built with Vite         |
    |  Tailwind CSS, React Router                                        |
    |    /              Student wizard (English / Arabic)                |
    |    /admin/login   Email + password                                 |
    |    /admin         Table, filters, status, WhatsApp, print          |
    +--------------------------------------------------------------------+
                    | supabase-js (anon key, safe to expose)
                    v
    +--------------------------------------------------------------------+
    |  Supabase                                                          |
    |    Auth      admin email/password (sign-ups OFF)                   |
    |    PostgREST automatic REST API over Postgres                      |
    |    Postgres  tables: modules, submissions, admins                  |
    |    RLS       row level security on every table                     |
    |    RPC       submit_problem() = the only student write path        |
    +--------------------------------------------------------------------+

### Data flow: student submits

1. Student opens the link, picks a language, answers "is this a retake?".
2. Enters names, roll number, WhatsApp, intake, module, lecturer, then CAT 2 / FAT / both.
3. The app calls rpc('submit_problem', ...).
4. The function checks the module is active and English, inserts the row, returns ref_no.
5. A duplicate raises Postgres error 23505, which the UI turns into a friendly message.

### Data flow: admin

1. Signs in with Supabase Auth.
2. select from submissions only works if is_admin() is true (RLS).
3. Status changes are update submissions set status = ...
4. **Print / Save as PDF** calls window.print(). A print stylesheet hides the controls and
   prints a clean A4 landscape table. In the print dialog choose "Save as PDF".
   (Browser printing handles Arabic names correctly; most JS PDF libraries do not.)

### Security model

| Who                 | Modules          | Submissions                                                   | Admins |
|---------------------|------------------|---------------------------------------------------------------|--------|
| anonymous student   | read active only | cannot read, cannot insert directly, may call submit_problem  | none   |
| admin (in admins)   | full             | read + update                                                 | none   |

The anon key in .env.local is public by design. NEVER put the service_role key in this app.

## Database

| Table         | Purpose                                                                         |
|---------------|---------------------------------------------------------------------------------|
| modules       | name, lecturer, is_english, active                                              |
| submissions   | one row per problem, ref_no, status: new, in_review, resolved, rejected         |
| admins        | user ids allowed into the admin screen                                          |

SQL files in supabase/: schema.sql (run first), make_admin.sql, queries.sql (teaching queries).

## Folder structure

    supabase/       schema.sql, make_admin.sql, queries.sql
    src/
      main.tsx      entry
      App.tsx       routes
      index.css     Tailwind theme + print styles
      lib/          supabase.ts, i18n.ts (EN/AR texts), types.ts
      pages/        Student.tsx, AdminLogin.tsx, Admin.tsx

## Setup

1. Supabase > SQL Editor: run supabase/schema.sql, then edit the modules to your real ones.
2. Supabase > Authentication: add your admin user, turn OFF new sign-ups, run supabase/make_admin.sql.
3. .env.local holds the project URL and anon key (see .env.example).
4. npm install, then npm run dev, and open http://localhost:5173 (admin: /admin).

## Deploy (Vercel)

Import the repo, add the two VITE_ variables, deploy. Add a rewrite of all paths to /index.html
so /admin works on refresh.