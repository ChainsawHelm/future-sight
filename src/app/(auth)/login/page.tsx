import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = {
  title: 'Sign In — Future Sight',
};

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div className="flex justify-center">
      <Suspense fallback={
        <div className="w-full max-w-md h-96 animate-pulse bg-card border border-border" />
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
