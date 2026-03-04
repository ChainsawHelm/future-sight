import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata = {
  title: 'Create Account — Future Sight',
};

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div className="flex justify-center">
      <Suspense fallback={
        <div className="w-full max-w-md h-[600px] animate-pulse bg-card rounded-xl" />
      }>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
