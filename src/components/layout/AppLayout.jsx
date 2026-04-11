import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ user }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'ml-[68px]' : 'ml-60'}`}>
        <TopBar user={user} />
        <main className="flex-1 p-5 md:p-7 overflow-x-hidden">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}