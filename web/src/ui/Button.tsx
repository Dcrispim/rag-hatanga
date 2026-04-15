import React from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export default function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const base = 'ui-btn';
  const variantClass =
    variant === 'primary' ? 'ui-btn-primary' : variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'ui-btn-ghost';

  return (
    <button {...props} className={twMerge(base, variantClass, className ?? '')}>
      {children}
    </button>
  );
}

