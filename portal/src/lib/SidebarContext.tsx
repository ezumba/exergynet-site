'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface SidebarCtx { open: boolean; toggle: () => void; close: () => void; }

const SidebarContext = createContext<SidebarCtx>({ open: true, toggle: () => {}, close: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const toggle = useCallback(() => setOpen(v => !v), []);
  const close  = useCallback(() => setOpen(false), []);
  return <SidebarContext.Provider value={{ open, toggle, close }}>{children}</SidebarContext.Provider>;
}

export const useSidebar = () => useContext(SidebarContext);
