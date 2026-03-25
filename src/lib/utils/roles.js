/**
 * Role-based access control utilities
 *
 * Roles:
 * - admin:         Full access — all modules, settings, user management
 * - accounts_team: Finance work — invoices, payments, receivables, payables, expenses, bank accounts
 * - sales_team:    Collections follow-up — debtors, reminders, follow-ups, my collections (read-only)
 */

const ROLE_PERMISSIONS = {
  admin: [
    'dashboard', 'debtors', 'my_collections', 'collection_targets', 'aging_analysis',
    'cash_flow_forecast', 'ai_insights', 'payment_reminders', 'receivables', 'payables',
    'expenses', 'bank_accounts', 'customers', 'vendors', 'reports', 'csv_import',
    'admin_panel', 'audit_logs', 'settings',
  ],
  accounts_team: [
    'dashboard', 'debtors', 'receivables', 'payables', 'expenses',
    'bank_accounts', 'customers', 'vendors', 'reports',
  ],
  sales_team: [
    'dashboard', 'my_collections', 'debtors', 'payment_reminders', 'customers',
  ],
};

// Data action permissions — what each role can do
const ROLE_ACTIONS = {
  admin:         { create: true,  edit: true,  delete: true  },
  accounts_team: { create: true,  edit: true,  delete: false },
  sales_team:    { create: false, edit: false, delete: false },
};

// Dashboard scorecard visibility per role
export const DASHBOARD_SCORECARDS = {
  admin:         ['bank_balance', 'debtor_outstanding', 'receivables', 'payables', 'expenses', 'net_position'],
  accounts_team: ['bank_balance', 'debtor_outstanding', 'receivables', 'payables', 'expenses', 'net_position'],
  sales_team:    ['debtor_outstanding'],
};

export function hasPermission(role, feature) {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['sales_team'];
  return permissions.includes(feature);
}

export function canCreate(role) {
  return ROLE_ACTIONS[role]?.create ?? false;
}

export function canEdit(role) {
  return ROLE_ACTIONS[role]?.edit ?? false;
}

export function canDelete(role) {
  return ROLE_ACTIONS[role]?.delete ?? false;
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

  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['sales_team'];
  return allItems.filter(item => permissions.includes(item.key));
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Admin',
    accounts_team: 'Accounts Team',
    sales_team: 'Sales Team',
  };
  return labels[role] || role;
}