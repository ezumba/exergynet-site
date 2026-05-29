'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!session.exists()) {
      router.replace('/');
    }
  }, [router]);

  // Don't render the layout until session is confirmed
  // (session.exists() is synchronous, so this prevents a flash of authenticated UI)
  if (typeof window !== 'undefined' && !session.exists()) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#0F172A',
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
