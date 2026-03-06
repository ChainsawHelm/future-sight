import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-mono font-semibold ring-offset-background transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] tracking-wider uppercase',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.15)]',
        destructive: 'bg-expense/10 text-expense border border-expense/30 hover:bg-expense/15',
        outline:     'border border-border bg-transparent hover:border-primary/40 hover:text-primary text-muted-foreground',
        secondary:   'bg-surface-2 text-foreground border border-border hover:bg-surface-3',
        ghost:       'text-muted-foreground hover:bg-primary/[0.05] hover:text-primary/80',
        link:        'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4',
        sm:      'h-7 px-3 text-xs',
        lg:      'h-11 px-6 text-base',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
