import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';

export function Button({ className = '', ...props }: ComponentProps<typeof BaseButton>) {
  return <BaseButton data-slot="button" className={`button ${className}`} {...props} />;
}
