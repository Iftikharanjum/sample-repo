# AI-versiti Community: setup guide

Total time is about 30 minutes. You need a Google account and access to your domain's DNS settings.

## What's in this folder

| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The app. Don't edit these. |
| `config.js` | **You edit this.** Paste your 2 Supabase keys here. |
| `logo/` | AI-versiti logo files |
| `supabase/schema.sql` | Sets up the database and security rules. Run it once. |
| `supabase/make-me-host.sql` | Makes your account the host. Run it once, after you sign in. |

---

## Step 1: Create the Supabase project (5 min)

1. Go to **supabase.com** and click **Start your project**. Sign in with GitHub or email.
2. Click **New project**:
   - Name: `aiversiti-community`
   - Database password: click **Generate** and save it somewhere safe
   - Region: **Mumbai (ap-south-1)**, the closest region to Pakistan
3. Click **Create**, then wait about 2 minutes.

## Step 2: Set up the database (2 min)

1. In the left menu, open **SQL Editor** and click **New query**.
2. Open `supabase/schema.sql`, copy all of it, and paste it in.
3. Click **Run**. You should see "Success. No rows returned".

## Step 3: Keys (already done — config.js is filled in)

1. Go to **Project Settings** (gear icon) → **API** (it may be called **API Keys** / **Data API**).
2. Copy the **Project URL** and the **anon / publishable** key.
   *Never* use the `service_role` / secret key.
3. Open `config.js` and paste both values:
   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
4. If you're skipping Google sign-in for now, set `GOOGLE_LOGIN: false`.

## Step 4: Put the code on GitHub (5 min)

1. Go to **github.com** and create a free account if you don't have one.
2. Click **+** → **New repository** and name it `aiversiti-community`. **Private** is fine. Click **Create**.
3. Click **uploading an existing file**. Drag in **everything inside this folder**, including the `logo` and `supabase` folders. Then click **Commit changes**.

## Step 5: Deploy on Vercel (3 min)

1. Go to **vercel.com** → **Sign up** → **Continue with GitHub**.
2. Click **Add New… → Project** and import `aiversiti-community`.
3. Leave all settings as they are (Framework: **Other**) and click **Deploy**.
4. You get a link like `aiversiti-community.vercel.app`. Open it and you should see the sign-in page.

## Step 6: Connect your subdomain (5 min + waiting)

1. In Vercel, open your project → **Settings → Domains** and add `community.yourdomain.com`.
2. Vercel shows a **CNAME** record. In your domain provider's DNS settings (GoDaddy, Namecheap, Hostinger, Cloudflare…), add:
   - Type: `CNAME`
   - Name / Host: `community`
   - Value / Points to: the value Vercel shows (usually `cname.vercel-dns.com`)
   - On Cloudflare, set the proxy to **DNS only** (grey cloud).
3. Wait 10–30 minutes. Vercel shows a green ✓ and turns on HTTPS automatically.

## Step 7: Tell Supabase your website address (2 min)

**Do not skip this step, or the sign-in links won't work.**

1. In Supabase, go to **Authentication → URL Configuration**.
2. **Site URL:** `https://community.yourdomain.com`
3. **Redirect URLs:** add these two:
   - `https://community.yourdomain.com/**`
   - `https://aiversiti-community.vercel.app/**`
4. Click **Save**.

## Step 8: Make yourself the host (2 min)

1. Open your community site and sign in with your email (or with Google once Step 9 is done).
2. Enter your name when it asks.
3. In Supabase, open **SQL Editor** and paste `supabase/make-me-host.sql`. Replace `YOUR-EMAIL@gmail.com` with the email you signed in with, then click **Run**.
4. Refresh the site. You should now see **Announce a live session** and the role **Host**.

To add a co-host (for example a co-facilitator), run the same script with their email after they've signed in once.

## Step 9 (recommended): Google sign-in (10 min)

1. Go to **console.cloud.google.com** and create a project → **APIs & Services → OAuth consent screen**. Choose External, enter the app name "AI-versiti Community" and your email, then save.
2. Go to **Credentials** → **Create credentials → OAuth client ID** → **Web application**.
   - Authorized redirect URI: `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
     (Supabase shows this exact link at **Authentication → Providers → Google**)
3. Copy the **Client ID** and **Client Secret**. In Supabase, go to **Authentication → Providers → Google**, turn it on, paste both values, and click **Save**.
4. Back in Google, set the consent screen to **In production** (Publish app) so any student can sign in.

## Step 10 (before launch): Your own email sender (10 min)

Supabase's built-in email only sends **a few sign-in emails per hour**. That's fine for testing, but not for a cohort. Before you invite students:

1. Create a free account at **resend.com** and verify your domain (it gives you DNS records to add).
2. Create an API key.
3. In Supabase, go to **Project Settings → Authentication → SMTP Settings** and turn on **Custom SMTP**:
   - Host `smtp.resend.com` · Port `465` · Username `resend` · Password: your Resend API key
   - Sender email: `community@yourdomain.com` · Sender name: `AI-versiti Community`
4. Optional: under **Authentication → Email Templates → Magic Link**, edit the email text to match your brand.

If most students use Google sign-in, this matters less, but set it up anyway.

---

## How to run a live session

1. **Feed → Announce a live session.** Add the title, date and time, and a message. Leave the Zoom link empty for now.
2. Members post questions and upvote each other's. The most upvoted questions appear on top.
3. When it's time: click **Go live + share Zoom** and paste the meeting link. Everyone sees **LIVE NOW** and a **Join on Zoom** button instantly, without refreshing.
4. Answer the questions from the top of the list and click **Mark answered** on each one.
5. Click **End session**. Questions close, and the session stays in the history.

## Making changes later

Edit a file on GitHub (pencil icon → Commit), and Vercel redeploys automatically within about 30 seconds.

## Costs

Supabase Free (50,000 monthly active users, 500 MB database) + Vercel Hobby (free) = **$0** to start.
Note: Supabase pauses free projects after **1 week with no activity**. Weekly sessions keep it awake. If you go quiet for longer, upgrade to Pro ($25/month).
