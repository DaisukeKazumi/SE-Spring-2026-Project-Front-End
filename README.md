# SE Spring 2026 — Frontend App

A lightweight starter project for a frontend web application built with **pure HTML, CSS, and JavaScript** that talks directly to [Supabase](https://supabase.com) — no React, no Node backend, no build tools required.

---

## Project structure

```
SE-Spring-2026-Project-Front-End/
├── index.html   # App shell: header, main content sections, CDN script tags
├── style.css    # Base styles with responsive layout, CSS variables, and utility classes
├── script.js    # Supabase client init + auth & database helper functions
└── README.md    # This file
```

---

## Getting started locally

### Option A — Open directly in a browser (simplest)

1. Clone or download this repository.
2. Open `index.html` in your browser (double-click the file, or drag it into a browser tab).

> **Note:** Some browsers restrict `fetch()` when loading a file from `file://`.  
> If authentication or database calls fail, use Option B.

### Option B — Serve with a local static server (recommended)

Any simple static server will work.  Pick whichever you have available:

```bash
# Python 3
python -m http.server 8080

# Node (npx, no install required)
npx serve .

# VS Code — install the "Live Server" extension, then click "Go Live"
```

Then open <http://localhost:8080> (or whichever port is shown).

---

## Connecting to Supabase

1. **Create a free project** at <https://supabase.com>.
2. In your Supabase dashboard go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon / public key**.
4. Open `script.js` and replace the placeholder values at the top of the file:

```js
const SUPABASE_URL     = "https://your-project-id.supabase.co"; // <-- replace
const SUPABASE_ANON_KEY = "your-anon-key-here";                 // <-- replace
```

5. In your Supabase project create a table called **`entries`** with at least these columns:

| Column       | Type      | Default                       |
|--------------|-----------|-------------------------------|
| `id`         | `uuid`    | `gen_random_uuid()` (PK)      |
| `content`    | `text`    |                               |
| `user_id`    | `uuid`    | (optional, for RLS)           |
| `created_at` | `timestamptz` | `now()`               |

> You can rename the table or add/remove columns — just update `TABLE_NAME` and the `insertData` call in `script.js`.

6. Enable **Row Level Security (RLS)** on the table and add appropriate policies so that only authenticated users can read/write their own data.  The Supabase documentation has ready-made policy templates.

---

## Features

| Feature | File | Description |
|---------|------|-------------|
| User sign-up | `script.js → signUpUser()` | Creates a new Supabase Auth account |
| User login | `script.js → loginUser()` | Signs in with email + password |
| User logout | `script.js → logoutUser()` | Ends the current session |
| Insert data | `script.js → insertData()` | Adds a row to the `entries` table |
| Fetch data | `script.js → fetchData()` | Reads all rows ordered by `created_at` |
| Session restore | `script.js` (bottom) | Restores an active session on page reload |

---

## Two-developer workflow

- Keep all Supabase credentials **out of version control**.  Add a `.env` or a local config file to `.gitignore` if you move to a build tool later.
- Agree on a shared Supabase project and table schema early so both developers can test against the same backend.
- Use [Supabase local development](https://supabase.com/docs/guides/cli) (`supabase start`) if you want to test offline without affecting the shared project.
- Open pull requests for all changes to `script.js` so both developers review auth and database logic together.

---

## Resources

- [Supabase JavaScript client docs](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth guide](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase local development CLI](https://supabase.com/docs/guides/cli)
