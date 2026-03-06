import { cn } from '@/lib/utils';

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }[size];
  const stroke = { sm: '1.5', md: '1.5', lg: '2' }[size];
  return (
    <svg className={cn('animate-spin text-primary', dims, className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="hsl(var(--surface-3))" strokeWidth={stroke} />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <Spinner size="lg" />
        <div className="absolute inset-0 border border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      {message && <p className="ticker">{message}</p>}
    </div>
  );
}
