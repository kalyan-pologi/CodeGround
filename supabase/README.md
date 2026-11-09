# Supabase cloud draft setup

CodeGround keeps working with local autosave when Supabase is not configured. To enable cross-device draft saving:

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run [`schema.sql`](./schema.sql).
3. In Supabase Authentication, enable Email provider. If email confirmation is enabled, confirm the account before signing in.
4. Copy `.env.example` to `.env.local` and fill in the project URL and public anon key:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

5. Restart the Vite dev server or rebuild the site.
6. Open any practice task, choose **Save online**, and sign in or create an account.

The browser still saves drafts locally immediately. After sign-in, click **Submit & Save** to write the current code and standard input to `practice_drafts`. Row-level security restricts each user to their own drafts. Never put a Supabase service-role key in `.env.local` or browser code; only the public anon key belongs in the frontend.

## GitHub Pages deployment

Because `.env.local` is intentionally ignored, add these repository secrets before deploying:

- `VITE_SUPABASE_URL` = the project URL without `/rest/v1/`
- `VITE_SUPABASE_ANON_KEY` = the `sb_publishable_...` key

In GitHub, open **Repository Settings → Secrets and variables → Actions → New repository secret**. Do not add the `sb_secret_...` key.
