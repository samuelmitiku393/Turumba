import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import SplashPage from './pages/SplashPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AdsPage from './pages/AdsPage'
import AdDetailPage from './pages/AdDetailPage'
import AdFormPage from './pages/AdFormPage'
import CalendarPage from './pages/CalendarPage'
import ChannelsPage from './pages/ChannelsPage'
import TeamPage from './pages/TeamPage'
import SettingsPage from './pages/SettingsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ReportsPage from './pages/ReportsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--tg-bg)',
            color: 'var(--tg-text)',
            border: '1px solid var(--tg-border)',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/ads/new" element={<AdFormPage />} />
          <Route path="/ads/:id" element={<AdDetailPage />} />
          <Route path="/ads/:id/edit" element={<AdFormPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
