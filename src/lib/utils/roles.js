/**
 * Role-based access control utilities
 * 
 * Roles:
 * - admin: Full access to everything
 * - user: Financial access (receivables, payables, expenses, bank accounts, dashboard)
 * - account_manager: Collections-only access (receivables, customers, dashboard limited)
 */

const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'receivables', 'payables', 'expenses', 'bank_accounts', 'customers', 'vendors', 'settings'],
  user: ['dashboard', 'receivables', 'payables', 'expenses', 'bank_accounts', 'customers', 'vendors'],
  account_manager: ['dashboard', 'receivables', 'customers'],
};

export function hasPermission(role, feature) {
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
  return permissions.includes(feature);
}

export function getNavigationItems(role) {
  const allItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { key: 'receivables', label: 'Receivables', path: '/receivables', icon: 'ArrowDownLeft' },
    { key: 'payables', label: 'Payables', path: '/payables', icon: 'ArrowUpRight' },
    { key: 'expenses', label: 'Expenses', path: '/expenses', icon: 'Receipt' },
    { key: 'bank_accounts', label: 'Bank Accounts', path: '/bank-accounts', icon: 'Landmark' },
    { key: 'customers', label: 'Customers', path: '/customers', icon: 'Users' },
    { key: 'vendors', label: 'Vendors', path: '/vendors', icon: 'Building2' },
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