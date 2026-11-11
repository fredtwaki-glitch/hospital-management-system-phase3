import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { ChatPage } from './pages/ChatPage';
import { LabsPage } from './pages/LabsPage';
import { LoginPage } from './pages/LoginPage';
import { PrescriptionsPage } from './pages/PrescriptionsPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<AppointmentsPage />} />
        <Route path="/prescriptions" element={<PrescriptionsPage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
