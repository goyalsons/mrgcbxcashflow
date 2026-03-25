import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
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
        <Route path="/debtors" element={<Debtors />} />
        <Route path="/my-collections" element={<MyCollections />} />
        <Route path="/collection-targets" element={<CollectionTargets />} />
        <Route path="/aging-analysis" element={<AgingAnalysis />} />
        <Route path="/cash-flow-forecast" element={<CashFlowForecast />} />
        <Route path="/ai-insights" element={<AIInsights />} />
        <Route path="/payment-reminders" element={<PaymentReminders />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/csv-import" element={<CSVImport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/receivables" element={<Receivables />} />
        <Route path="/payables" element={<Payables />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/bank-accounts" element={<BankAccounts />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/vendors" element={<Vendors />} />
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