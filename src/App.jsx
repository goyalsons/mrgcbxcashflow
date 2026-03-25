import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Debtors from '@/pages/Debtors';
import MyCollections from '@/pages/MyCollections';
import CollectionTargets from '@/pages/CollectionTargets';
import AgingAnalysis from '@/pages/AgingAnalysis';
import CashFlowForecast from '@/pages/CashFlowForecast';
import AIInsights from '@/pages/AIInsights';
import PaymentReminders from '@/pages/PaymentReminders';
import Reports from '@/pages/Reports';
import CSVImport from '@/pages/CSVImport';
import Settings from '@/pages/Settings';
import AdminPanel from '@/pages/AdminPanel';
import AuditLogs from '@/pages/AuditLogs';
import Receivables from '@/pages/Receivables';
import Payables from '@/pages/Payables';
import Expenses from '@/pages/Expenses';
import BankAccounts from '@/pages/BankAccounts';
import Customers from '@/pages/Customers';
import Vendors from '@/pages/Vendors';
import FollowUpSchedule from '@/pages/FollowUpSchedule';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading CashFlow Pro...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout user={user} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/debtors" element={<ProtectedRoute user={user} featureKey="debtors"><Debtors /></ProtectedRoute>} />
        <Route path="/my-collections" element={<ProtectedRoute user={user} featureKey="my_collections"><MyCollections /></ProtectedRoute>} />
        <Route path="/collection-targets" element={<ProtectedRoute user={user} featureKey="collection_targets"><CollectionTargets /></ProtectedRoute>} />
        <Route path="/aging-analysis" element={<ProtectedRoute user={user} featureKey="aging_analysis"><AgingAnalysis /></ProtectedRoute>} />
        <Route path="/cash-flow-forecast" element={<ProtectedRoute user={user} featureKey="cash_flow_forecast"><CashFlowForecast /></ProtectedRoute>} />
        <Route path="/ai-insights" element={<ProtectedRoute user={user} featureKey="ai_insights"><AIInsights /></ProtectedRoute>} />
        <Route path="/payment-reminders" element={<ProtectedRoute user={user} featureKey="payment_reminders"><PaymentReminders /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute user={user} featureKey="reports"><Reports /></ProtectedRoute>} />
        <Route path="/csv-import" element={<ProtectedRoute user={user} featureKey="csv_import"><CSVImport /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute user={user} featureKey="settings"><Settings /></ProtectedRoute>} />
        <Route path="/admin-panel" element={<ProtectedRoute user={user} featureKey="admin_panel"><AdminPanel /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute user={user} featureKey="audit_logs"><AuditLogs /></ProtectedRoute>} />
        <Route path="/receivables" element={<ProtectedRoute user={user} featureKey="receivables"><Receivables /></ProtectedRoute>} />
        <Route path="/payables" element={<ProtectedRoute user={user} featureKey="payables"><Payables /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute user={user} featureKey="expenses"><Expenses /></ProtectedRoute>} />
        <Route path="/bank-accounts" element={<ProtectedRoute user={user} featureKey="bank_accounts"><BankAccounts /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute user={user} featureKey="customers"><Customers /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute user={user} featureKey="vendors"><Vendors /></ProtectedRoute>} />
        <Route path="/follow-up-schedule" element={<FollowUpSchedule />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App