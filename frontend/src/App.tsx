import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ClinicLayout } from './components/clinic/ClinicLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { AppointmentConfirmationPage } from './pages/AppointmentConfirmationPage'
import { AppointmentPage } from './pages/AppointmentPage'
import { AppointmentSchedulePage } from './pages/AppointmentSchedulePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ClinicRoute } from './routes/ClinicRoute'

// The clinic software is code-split as one chunk: a visitor booking an
// appointment should never download the staff application, and staff pay the
// cost once on sign-in rather than per page.
const ClinicDashboardPage = lazy(() =>
  import('./pages/clinic/ClinicDashboardPage').then((m) => ({ default: m.ClinicDashboardPage })),
)
const AppointmentsPage = lazy(() =>
  import('./pages/clinic/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })),
)
const AppointmentFormPage = lazy(() =>
  import('./pages/clinic/AppointmentFormPage').then((m) => ({ default: m.AppointmentFormPage })),
)
const AppointmentDetailPage = lazy(() =>
  import('./pages/clinic/AppointmentDetailPage').then((m) => ({
    default: m.AppointmentDetailPage,
  })),
)
const CalendarPage = lazy(() =>
  import('./pages/clinic/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const PatientsPage = lazy(() =>
  import('./pages/clinic/PatientsPage').then((m) => ({ default: m.PatientsPage })),
)
const PatientFormPage = lazy(() =>
  import('./pages/clinic/PatientFormPage').then((m) => ({ default: m.PatientFormPage })),
)
const PatientDetailPage = lazy(() =>
  import('./pages/clinic/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })),
)
const PatientHistoryPage = lazy(() =>
  import('./pages/clinic/PatientHistoryPage').then((m) => ({ default: m.PatientHistoryPage })),
)
const VisitsPage = lazy(() =>
  import('./pages/clinic/VisitsPage').then((m) => ({ default: m.VisitsPage })),
)
const VisitDetailPage = lazy(() =>
  import('./pages/clinic/VisitDetailPage').then((m) => ({ default: m.VisitDetailPage })),
)
const PrescriptionsPage = lazy(() =>
  import('./pages/clinic/PrescriptionsPage').then((m) => ({ default: m.PrescriptionsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/clinic/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AuditPage = lazy(() =>
  import('./pages/clinic/AuditPage').then((m) => ({ default: m.AuditPage })),
)

function ClinicFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-(--color-ink-soft)">
      Loading…
    </div>
  )
}

/** Wraps a clinic page in the shell, the auth guard and the lazy boundary. */
function clinicPage(element: React.ReactNode, requires?: Parameters<typeof ClinicRoute>[0]['requires']) {
  return (
    <ClinicRoute requires={requires}>
      <ClinicLayout>
        <Suspense fallback={<ClinicFallback />}>{element}</Suspense>
      </ClinicLayout>
    </ClinicRoute>
  )
}

function App() {
  return (
    <Routes>
      {/* Public website - unchanged. */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/appointment" element={<AppointmentPage />} />
        <Route path="/appointment/schedule" element={<AppointmentSchedulePage />} />
        <Route path="/appointment/confirmation" element={<AppointmentConfirmationPage />} />
      </Route>

      <Route path="/clinic/login" element={<LoginPage />} />

      {/* Previous staff URLs. Kept as redirects so existing bookmarks and any
          link already handed to the dentist continue to work. */}
      <Route path="/login" element={<Navigate to="/clinic/login" replace />} />
      <Route path="/dentist/dashboard" element={<Navigate to="/clinic/dashboard" replace />} />
      <Route path="/clinic" element={<Navigate to="/clinic/dashboard" replace />} />

      <Route path="/clinic/dashboard" element={clinicPage(<ClinicDashboardPage />)} />
      <Route path="/clinic/appointments" element={clinicPage(<AppointmentsPage />)} />
      <Route path="/clinic/appointments/new" element={clinicPage(<AppointmentFormPage />)} />
      <Route
        path="/clinic/appointments/:appointmentId"
        element={clinicPage(<AppointmentDetailPage />)}
      />
      <Route path="/clinic/calendar" element={clinicPage(<CalendarPage />)} />

      <Route path="/clinic/patients" element={clinicPage(<PatientsPage />)} />
      <Route path="/clinic/patients/new" element={clinicPage(<PatientFormPage mode="create" />)} />
      <Route path="/clinic/patients/:patientId" element={clinicPage(<PatientDetailPage />)} />
      <Route
        path="/clinic/patients/:patientId/edit"
        element={clinicPage(<PatientFormPage mode="edit" />)}
      />
      <Route
        path="/clinic/patients/:patientId/history"
        element={clinicPage(<PatientHistoryPage />, 'can_view_clinical')}
      />
      <Route
        path="/clinic/patients/:patientId/visits/new"
        element={clinicPage(<VisitDetailPage mode="new" />, 'can_edit_clinical')}
      />

      <Route path="/clinic/visits" element={clinicPage(<VisitsPage />, 'can_view_clinical')} />
      <Route
        path="/clinic/visits/new"
        element={clinicPage(<VisitDetailPage mode="new" />, 'can_edit_clinical')}
      />
      <Route
        path="/clinic/visits/:visitId"
        element={clinicPage(<VisitDetailPage mode="view" />, 'can_view_clinical')}
      />

      <Route
        path="/clinic/prescriptions"
        element={clinicPage(<PrescriptionsPage />, 'can_prescribe')}
      />
      <Route path="/clinic/settings/*" element={clinicPage(<SettingsPage />)} />
      <Route path="/clinic/audit" element={clinicPage(<AuditPage />, 'can_view_audit')} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
