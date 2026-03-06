import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Sign In — Future Sight',
};

export default function RegisterPage() {
  redirect('/login');
}
