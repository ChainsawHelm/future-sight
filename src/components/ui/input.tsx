import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full border border-border bg-surface-1 px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-[0_0_8px_hsl(var(--primary)/0.12)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors duration-100 file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
