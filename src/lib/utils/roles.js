/**
 * Role-based access control utilities
 * 
 * Roles:
 * - admin: Full access to everything
 * - user: Financial access (receivables, payables, expenses, bank accounts, dashboard)
 * - account_manager: Collections-only access (receivables, customers, dashboard limited)
 */

const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'notifications', 'debtors', 'collection_targets', 'aging_analysis', 'cash_flow_forecast', 'ai_insights', 'analysis', 'payment_reminders', 'follow_up_schedule', 'receivables', 'payables', 'expenses', 'recurring_expenses', 'bank_accounts', 'customers', 'vendors', 'reports', 'csv_import', 'admin_panel', 'audit_logs', 'tally_integration', 'settings'],
  user: ['dashboard', 'notifications', 'debtors', 'aging_analysis', 'cash_flow_forecast', 'ai_insights', 'analysis', 'payment_reminders', 'follow_up_schedule', 'receivables', 'payables', 'expenses', 'recurring_expenses', 'bank_accounts', 'customers', 'vendors', 'reports'],
  account_manager: ['dashboard', 'notifications', 'my_collections', 'debtors', 'receivables', 'customers', 'payment_reminders', 'follow_up_schedule'],
};

export function hasPermission(role, feature) {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
  return permissions.includes(feature);
}

export function getNavigationItems(role) {
  const allItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { key: 'my_collections', label: 'My Collections', path: '/my-collections', icon: 'Briefcase' },
    { key: 'debtors', label: 'Debtors', path: '/debtors', icon: 'Users' },
    { key: 'collection_targets', label: 'Collection Targets', path: '/collection-targets', icon: 'Target' },
    { key: 'aging_analysis', label: 'Aging Analysis', path: '/aging-analysis', icon: 'Clock' },
    { key: 'cash_flow_forecast', label: 'Cash Flow Forecast', path: '/cash-flow-forecast', icon: 'TrendingUp' },
    { key: 'ai_insights', label: 'AI Insights', path: '/ai-insights', icon: 'Sparkles' },
    { key: 'analysis', label: 'Analysis', path: '/analysis', icon: 'BarChart3' },
    { key: 'payment_reminders', label: 'Payment Reminders', path: '/payment-reminders', icon: 'Bell' },
    { key: 'receivables', label: 'Receivables', path: '/receivables', icon: 'ArrowDownLeft' },
    { key: 'payables', label: 'Payables', path: '/payables', icon: 'ArrowUpRight' },
    { key: 'expenses', label: 'Expenses', path: '/expenses', icon: 'Receipt' },
    { key: 'bank_accounts', label: 'Bank Accounts', path: '/bank-accounts', icon: 'Landmark' },
    { key: 'customers', label: 'Customers', path: '/customers', icon: 'Users' },
    { key: 'vendors', label: 'Vendors', path: '/vendors', icon: 'Building2' },
    { key: 'reports', label: 'Reports', path: '/reports', icon: 'FileText' },
    { key: 'csv_import', label: 'CSV Import', path: '/csv-import', icon: 'Upload' },
    { key: 'admin_panel', label: 'Admin Panel', path: '/admin-panel', icon: 'Shield' },
    { key: 'audit_logs', label: 'Audit Logs', path: '/audit-logs', icon: 'ClipboardList' },
    { key: 'settings', label: 'Settings', path: '/settings', icon: 'Settings' },
  ];

  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
  return allItems.filter(item => permissions.includes(item.key));
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Admin',
    user: 'User',
    account_manager: 'Account Manager',
  };
  return labels[role] || 'User';
}