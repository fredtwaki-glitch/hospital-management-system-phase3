
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { AppointmentCreatePage } from './pages/AppointmentCreatePage';
import { InboxPage } from './pages/InboxPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { InvoiceCreatePage } from './pages/InvoiceCreatePage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { LoginPage } from './pages/LoginPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { PatientRegisterPage } from './pages/PatientRegisterPage';
import { PatientsListPage } from './pages/PatientsListPage';
import { PayersPage } from './pages/PayersPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { StaffShiftsPage } from './pages/StaffShiftsPage';
import { SyncQueuePage } from './pages/SyncQueuePage';

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
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/patients" replace />} />
        <Route path="/patients" element={<PatientsListPage />} />
        <Route path="/patients/new" element={<PatientRegisterPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/appointments/new" element={<AppointmentCreatePage />} />
        <Route path="/invoices/new" element={<InvoiceCreatePage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/pharmacy" element={<PharmacyPage />} />
        <Route path="/payers" element={<PayersPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/staff-shifts" element={<StaffShiftsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/sync-queue" element={<SyncQueuePage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <AppRoutes />
      </OfflineQueueProvider>
    </AuthProvider>
  );
}
