import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { AppointmentConfirmationPage } from './pages/AppointmentConfirmationPage'
import { AppointmentPage } from './pages/AppointmentPage'
import { AppointmentSchedulePage } from './pages/AppointmentSchedulePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

// Code-split the dashboard: it pulls in Recharts, which public visitors
// booking an appointment never need to download.
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/appointment" element={<AppointmentPage />} />
        <Route path="/appointment/schedule" element={<AppointmentSchedulePage />} />
        <Route path="/appointment/confirmation" element={<AppointmentConfirmationPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dentist/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Suspense
                fallback={
                  <div className="flex h-64 items-center justify-center text-sm text-(--color-ink-soft)">
                    Loading dashboard…
                  </div>
                }
              >
                <DashboardPage />
              </Suspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
