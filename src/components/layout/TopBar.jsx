import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROUTE_LABELS = {
  '/': 'Dashboard',
  '/debtors': 'Debtors',
  '/my-collections': 'My Collections',
  '/collection-targets': 'Collection Targets',
  '/aging-analysis': 'Aging Analysis',
  '/cash-flow-forecast': 'Cash Flow Forecast',
  '/ai-insights': 'AI Insights',
  '/payment-reminders': 'Payment Reminders',
  '/receivables': 'Receivables',
  '/payables': 'Payables',
  '/expenses': 'Expenses',
  '/bank-accounts': 'Bank Accounts',
  '/customers': 'Customers',
  '/vendors': 'Vendors',
  '/reports': 'Reports',
  '/csv-import': 'CSV Import',
  '/admin-panel': 'Admin Panel',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
};

export default function TopBar({ user, onMenuOpen }) {
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] || '';
  const isHome = location.pathname === '/';

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-5 md:px-7 shrink-0 sticky top-0 z-10">
      {/* Mobile hamburger */}
      <button className="md:hidden mr-2 p-1.5 rounded-md hover:bg-muted transition-colors" onClick={onMenuOpen}>
        <Menu className="w-5 h-5 text-foreground" />
      </button>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm flex-1">
        {!isHome ? (
          <>
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{currentLabel}</span>
          </>
        ) : (
          <span className="font-medium text-foreground">Dashboard</span>
        )}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
            {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <span className="text-muted-foreground text-[13px]">{user?.full_name || user?.email}</span>
        </div>
      </div>
    </header>
  );
}