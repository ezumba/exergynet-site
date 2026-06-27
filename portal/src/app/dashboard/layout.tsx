'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { SidebarProvider } from '@/lib/SidebarContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!session.exists()) router.replace('/');
  }, [router]);

  if (typeof window !== 'undefined' && !session.exists()) return null;

  return (
    <SidebarProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar />
          <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
