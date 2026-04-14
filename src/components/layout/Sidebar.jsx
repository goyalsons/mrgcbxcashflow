import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, Receipt, 
  Landmark, Users, Building2, LogOut, ChevronLeft, ChevronRight,
  IndianRupee, Briefcase, Target, Clock, TrendingUp, Sparkles,
  Bell, FileText, Upload, Shield, ClipboardList, Settings, BarChart3, CalendarClock, Link2, SlidersHorizontal
} from 'lucide-react';
import { getRoleLabel, hasPermission } from '@/lib/utils/roles';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const iconMap = {
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, Receipt,
  Landmark, Users, Building2, Briefcase, Target, Clock,
  TrendingUp, Sparkles, Bell, FileText, Upload, Shield,
  ClipboardList, Settings, BarChart3, CalendarClock, Link2, SlidersHorizontal,
};

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
      { key: 'notifications', label: 'Notifications', path: '/notifications', icon: 'Bell' },
      { key: 'my_collections', label: 'My Collections', path: '/my-collections', icon: 'Briefcase' },
    ],
  },
  {
    label: 'Collections',
    items: [
      { key: 'collection_targets', label: 'Collection Targets', path: '/collection-targets', icon: 'Target' },
      { key: 'aging_analysis', label: 'Aging Analysis', path: '/aging-analysis', icon: 'Clock' },
      { key: 'payment_reminders', label: 'Payment Reminders', path: '/payment-reminders', icon: 'Clock' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'receivables', label: 'Receivables', path: '/receivables', icon: 'Receipt' },
      { key: 'payables', label: 'Payables (Suppliers)', path: '/payables', icon: 'ArrowUpRight' },
      { key: 'expenses', label: 'Expenses', path: '/expenses', icon: 'Receipt' },
      { key: 'recurring_expenses', label: 'Recurring Expenses', path: '/recurring-expenses', icon: 'CalendarClock' },
      { key: 'bank_accounts', label: 'Balances', path: '/bank-accounts', icon: 'Landmark' },
    ],
  },
  {
    label: 'Contacts',
    items: [
      { key: 'customers', label: 'Customers', path: '/customers', icon: 'Users' },
      { key: 'vendors', label: 'Vendors', path: '/vendors', icon: 'Building2' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'cash_flow_simulator', label: 'Cash Flow Simulator', path: '/cash-flow-simulator', icon: 'SlidersHorizontal' },
      { key: 'ai_insights', label: 'AI Insights', path: '/ai-insights', icon: 'Sparkles' },
      { key: 'analysis', label: 'Analysis', path: '/analysis', icon: 'BarChart3' },
      { key: 'reports', label: 'Reports', path: '/reports', icon: 'FileText' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'csv_import', label: 'CSV Import', path: '/csv-import', icon: 'Upload' },
      { key: 'admin_panel', label: 'User Admin', path: '/admin-panel', icon: 'Shield' },
      { key: 'audit_logs', label: 'Audit Logs', path: '/audit-logs', icon: 'ClipboardList' },
      { key: 'settings', label: 'Settings', path: '/settings', icon: 'Settings' },
    ],
  },
];

export default function Sidebar({ user, collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const role = user?.role || 'user';
  
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list(),
    refetchInterval: 30000,
  });
  
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50
      ${collapsed ? 'md:w-[68px]' : 'md:w-60'}
      w-72
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Logo */}
      <div className={`flex items-center gap-3 h-14 border-b border-sidebar-border shrink-0 ${collapsed ? 'px-4 justify-center' : 'px-5'}`}>
        <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <IndianRupee className="w-3.5 h-3.5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">CashFlow Pro</h1>
            <p className="text-[9px] text-sidebar-foreground/40 uppercase tracking-widest">Finance Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(item => hasPermission(role, item.key));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">{group.label}</span>
                </div>
              )}
              {collapsed && <div className="mx-3 my-1.5 border-t border-sidebar-border/40" />}
              <div className="px-2 space-y-0.5">
                {visibleItems.map((item) => {
                   const Icon = iconMap[item.icon];
                   const isActive = item.path === '/'
                     ? location.pathname === '/'
                     : location.pathname.startsWith(item.path);

                   const showBadge = item.key === 'notifications' && unreadCount > 0;

                   return (
                     <Link
                       key={item.key}
                       to={item.path}
                       title={collapsed ? item.label : undefined}
                       onClick={onMobileClose}
                       className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative
                         ${isActive
                           ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                           : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                         } ${collapsed ? 'justify-center' : ''}
                       `}
                     >
                       {Icon && <Icon className="w-[16px] h-[16px] flex-shrink-0" />}
                       {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
                       {showBadge && (
                         <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                           {unreadCount > 99 ? '99+' : unreadCount}
                         </span>
                       )}
                     </Link>
                   );
                 })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        {!collapsed && (
          <div className="px-2.5 py-2 mb-1">
            <p className="text-[13px] font-medium text-sidebar-foreground truncate">{user?.full_name || 'User'}</p>
            <p className="text-[11px] text-sidebar-foreground/40">{getRoleLabel(role)}</p>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={`text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs ${collapsed ? 'w-full justify-center px-0' : 'flex-1 justify-start px-2.5'}`}
            onClick={() => base44.auth.logout()}
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span className="ml-1.5">Logout</span>}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}