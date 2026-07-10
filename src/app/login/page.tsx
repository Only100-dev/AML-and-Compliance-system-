import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { LoginForm } from '@/components/auth/LoginForm';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  // If already logged in, redirect to home
  if (session) {
    redirect('/');
  }

  // Addendum G: Suspense boundary required for useSearchParams in LoginForm
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
