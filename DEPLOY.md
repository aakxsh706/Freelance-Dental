# Deploying the public website

A static site. No server, no database, nothing to keep running.

Patient bookings post straight to the clinic's Google Apps Script, which
appends a row to the **Bookings** sheet. The staff portal is not part of this
site — the clinic runs the installed Windows software for that.

## One-time: update the Apps Script

The script must be the version that understands bookings. In the clinic's
Google Sheet: **Extensions → Apps Script**, paste the contents of
`docs/patient_sheet_webhook.gs` (set `TOKEN` first), then
**Deploy → Manage deployments → New version**.

Use *Manage deployments*, not *New deployment*, so the URL does not change.

## Deploy to Vercel

1. <https://vercel.com/new> → import this repository
2. Framework Preset: **Other** — `vercel.json` supplies the rest
3. **Deploy**

There is no build step: `frontend/dist` is committed. Vercel serves it.

## Connect the domain

1. Project → **Settings** → **Domains**
2. Enter the domain → **Add**
3. Vercel shows the DNS records to create (an `A` record, or a `CNAME`)
4. Add exactly those at the registrar where the domain was bought
5. Wait for DNS — usually minutes

HTTPS is issued automatically once DNS resolves.

## After changing the website

The built files are committed, so rebuild and commit them:

```bash
cd frontend
npm install
npm run build
cd ..
git add frontend/dist && git commit -m "Rebuild site" && git push
```

## What this site can and cannot do

**Can:** every public page, and take booking requests into the sheet.

**Cannot:** show which slots are already taken. With no server there is
nothing to ask, so all opening times are offered and the booking is a
*request* the clinic confirms — which is what the confirmation screen says.

**Cannot:** staff login, patient records, confirmation emails. Those are in
the installed software.
