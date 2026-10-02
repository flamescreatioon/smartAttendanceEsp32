import { useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';
import PublicAttendance from './pages/PublicAttendance.jsx';
import SessionReport from './pages/SessionReport.jsx';
import Settings from './pages/Settings.jsx';
import { clearStoredAuth, getStoredAuth, persistAuth } from './utils/storage.js';

function ProtectedRoute({ auth, children }) {
  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicAttendanceRoute() {
  const { token = '' } = useParams();
  return <PublicAttendance key={token} />;
}

function SessionReportRoute({ auth, onLogout }) {
  const { sessionId = '' } = useParams();
  return <SessionReport key={sessionId} auth={auth} onLogout={onLogout} />;
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  function handleLogin(nextAuth) {
    const persistedAuth = persistAuth(nextAuth);
    setAuth(persistedAuth);
  }

  function handleLogout() {
    clearStoredAuth();
    setAuth(null);
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={auth?.token ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
      />
      <Route
        path="/attendance/:token"
        element={<PublicAttendanceRoute />}
      />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute auth={auth}>
            <Dashboard auth={auth} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/history"
        element={(
          <ProtectedRoute auth={auth}>
            <History auth={auth} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/history/:sessionId/report"
        element={(
          <ProtectedRoute auth={auth}>
            <SessionReportRoute auth={auth} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute auth={auth}>
            <Settings auth={auth} onLogout={handleLogout} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/"
        element={<Navigate to={auth?.token ? '/dashboard' : '/login'} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={auth?.token ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}
