'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { DashboardApp } from '@/components/ic-os/DashboardApp';
import { InstitutionalLandingPage } from '@/components/auth/InstitutionalLandingPage';

export default function HomePage() {
  const { data: session, status } = useSession();

  // Show loading skeleton while session is being resolved
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading IC-OS...</p>
        </div>
      </div>
    );
  }

  // Authenticated → Dashboard with Sidebar, TopBar, Intelligence Engine, etc.
  if (session) {
    return <DashboardApp />;
  }

  // Unauthenticated → Institutional Landing Page with "Sign In" CTA
  return <InstitutionalLandingPage />;
}
