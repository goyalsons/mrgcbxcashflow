import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout({ user }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <Sidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'md:ml-[68px]' : 'md:ml-60'}`}>
        <TopBar user={user} onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 p-5 md:p-7 overflow-x-hidden">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
        <footer className="border-t bg-card py-3 px-6">
          <a
            href="https://www.ceoitbox.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <img
              src="https://media.base44.com/images/public/69de1de00c0dbb6d8107d446/acbbaab0a_CEOITBOXLogoSmall.png"
              alt="CEOITBOX Logo"
              className="h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-xs">
              © {new Date().getFullYear()} CEOITBOX Tech Services LLP. All rights reserved.
            </span>
          </a>
        </footer>
      </div>
    </div>
  );
}