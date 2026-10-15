import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const styles = cva('button', {
  variants: { variant: { primary: 'button-primary', secondary: 'button-secondary', quiet: 'button-quiet' } },
  defaultVariants: { variant: 'primary' },
});

type Props = ComponentProps<'button'> & VariantProps<typeof styles> & { asChild?: boolean };

export function Button({ asChild = false, variant, className, ...props }: Props) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(styles({ variant }), className)} {...props} />;
}
