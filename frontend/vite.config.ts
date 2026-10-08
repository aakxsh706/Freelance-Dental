import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => ({
  // Production build only. In the bundle Django serves the built assets from
  // /static/, so the build has to emit that prefix - otherwise index.html asks
  // for /assets/..., Django's single-page-app catch-all answers those with
  // index.html, and the browser receives HTML where it expected JavaScript: a
  // blank page with nothing useful in the console.
  //
  // Scoped to `build` because `base` applies to the dev server too. Set
  // globally it makes `npm run dev` redirect / to /static/, and the usual
  // http://localhost:6565 stops working.
  // Served from the domain root by Vercel as a static site, so no prefix.
  // (The Windows bundle serves the app through Django, where assets live
  // under /static/ - that build lives in the other repository.)
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 6565,
  },
  preview: {
    host: '0.0.0.0',
    port: 6565,
  },
}))
