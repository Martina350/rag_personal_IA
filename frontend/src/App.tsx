import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppLayout, RequireAuth } from './components/AppLayout'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function Bootstrap() {
  const { token, refreshMe } = useAuth()

  useEffect(() => {
    if (token) {
      void refreshMe()
    }
  }, [token, refreshMe])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="consultar" element={<ChatPage />} />
        <Route path="usuarios" element={<AdminUsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Bootstrap />
      </BrowserRouter>
    </AuthProvider>
  )
}
