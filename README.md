# Dr. Belin's Dentistry — public website

The public site: clinic information, and an appointment request form.

Static. No server, no database. Bookings post to the clinic's Google Apps
Script, which writes them into the Bookings sheet the dentist reads.

The staff portal (patients, appointments, prescriptions, audit) is **not**
here — it is the Windows software installed at the clinic, in the main
repository.

```
frontend/       the React site (frontend/dist is committed and served)
docs/           the Google Apps Script that receives bookings
vercel.json     static hosting config
DEPLOY.md       how to deploy and connect the domain
```

## Local development

```bash
cd frontend
npm install
npm run dev
```
