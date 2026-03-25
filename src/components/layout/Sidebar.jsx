import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, Receipt, 
  Landmark, Users, Building2, LogOut, ChevronLeft, ChevronRight,
  IndianRupee, Briefcase, Target
} from 'lucide-react';
import { getNavigationItems, getRoleLabel } from '@/lib/utils/roles';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const iconMap = {
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, Receipt,
  Landmark, Users, Building2, Briefcase, Target,
};

export default function Sidebar({ user, collapsed, onToggle }) {
  const location = useLocation();
  const role = user?.role || 'user';
  const navItems = getNavigationItems(role);

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <IndianRupee className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-sidebar-foreground">CashFlow Pro</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Finance Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.key}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25' 
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              {Icon && <Icon className="w-[18px] h-[18px] flex-shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || 'User'}</p>
            <p className="text-xs text-sidebar-foreground/50">{getRoleLabel(role)}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent justify-start"
            onClick={() => base44.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2 text-xs">Logout</span>}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}