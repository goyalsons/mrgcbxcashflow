/**
 * Role-based access control utilities
 *
 * Roles:
 * - admin:        Full access to everything
 * - accounts_team (displayed as "User"): Full access except admin_panel and settings
 * - sales_team (displayed as "Account Manager"): Dashboard, collection targets, aging analysis, receivables, customers — own clients only
 * - inactive:     No page access — sees a "Waiting for activation" screen
 */

const ROLE_PERMISSIONS = {
  admin: [
    'dashboard', 'notifications', 'debtors', 'collection_targets', 'aging_analysis',
    'cash_flow_forecast', 'cash_flow_simulator', 'cash_flow_simulator_monthly',
    'ai_insights', 'analysis', 'payment_reminders', 'follow_up_schedule',
    'receivables', 'payables', 'expenses', 'recurring_expenses',
    'bank_accounts', 'customers', 'vendors', 'reports',
    'csv_import', 'admin_panel', 'audit_logs', 'tally_integration', 'settings',
  ],
  accounts_team: [
    'dashboard', 'notifications', 'debtors', 'aging_analysis',
    'cash_flow_forecast', 'cash_flow_simulator', 'cash_flow_simulator_monthly',
    'ai_insights', 'analysis', 'payment_reminders', 'follow_up_schedule',
    'receivables', 'payables', 'expenses', 'recurring_expenses',
    'bank_accounts', 'customers', 'vendors', 'reports',
  ],
  sales_team: [
    'dashboard', 'collection_targets', 'aging_analysis', 'receivables', 'customers',
  ],
  inactive: [],
};

export function hasPermission(role, feature) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(feature);
}

export function getNavigationItems(role) {
  const allItems = [
    { key: 'dashboard',                  label: 'Dashboard',            path: '/',                          icon: 'LayoutDashboard'   },
    { key: 'my_collections',             label: 'My Collections',       path: '/my-collections',            icon: 'Briefcase'         },
    { key: 'debtors',                    label: 'Debtors',              path: '/debtors',                   icon: 'Users'             },
    { key: 'collection_targets',         label: 'Collection Targets',   path: '/collection-targets',        icon: 'Target'            },
    { key: 'aging_analysis',             label: 'Aging Analysis',       path: '/aging-analysis',            icon: 'Clock'             },
    { key: 'cash_flow_forecast',         label: 'Cash Flow Forecast',   path: '/cash-flow-forecast',        icon: 'TrendingUp'        },
    { key: 'cash_flow_simulator',        label: 'CF Simulator',         path: '/cash-flow-simulator',       icon: 'SlidersHorizontal' },
    { key: 'ai_insights',               label: 'AI Insights',          path: '/ai-insights',               icon: 'Sparkles'          },
    { key: 'analysis',                   label: 'Analysis',             path: '/analysis',                  icon: 'BarChart3'         },
    { key: 'payment_reminders',          label: 'Payment Reminders',    path: '/payment-reminders',         icon: 'Bell'              },
    { key: 'receivables',                label: 'Receivables',          path: '/receivables',               icon: 'ArrowDownLeft'     },
    { key: 'payables',                   label: 'Payables',             path: '/payables',                  icon: 'ArrowUpRight'      },
    { key: 'expenses',                   label: 'Expenses',             path: '/expenses',                  icon: 'Receipt'           },
    { key: 'bank_accounts',             label: 'Bank Accounts',        path: '/bank-accounts',             icon: 'Landmark'          },
    { key: 'customers',                  label: 'Customers',            path: '/customers',                 icon: 'Users'             },
    { key: 'vendors',                    label: 'Vendors',              path: '/vendors',                   icon: 'Building2'         },
    { key: 'reports',                    label: 'Reports',              path: '/reports',                   icon: 'FileText'          },
    { key: 'csv_import',                label: 'CSV Import',           path: '/csv-import',                icon: 'Upload'            },
    { key: 'admin_panel',               label: 'Admin Panel',          path: '/admin-panel',               icon: 'Shield'            },
    { key: 'audit_logs',               label: 'Audit Logs',           path: '/audit-logs',                icon: 'ClipboardList'     },
    { key: 'settings',                   label: 'Settings',             path: '/settings',                  icon: 'Settings'          },
  ];

  const permissions = ROLE_PERMISSIONS[role] || [];
  return allItems.filter(item => permissions.includes(item.key));
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Admin',
    accounts_team: 'User',
    sales_team: 'Account Manager',
    inactive: 'Inactive',
  };
  return labels[role] || role;
}

/** Returns true if this role should only see their own assigned customers */
export function isSalesTeam(role) {
  return role === 'sales_team';
}