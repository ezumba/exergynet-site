'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function VanguardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/vanguard'); }, [router]);
  return null;
}
