import React from 'react';
import { twMerge } from 'tailwind-merge';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      {...props}
      className={twMerge('ui-input', className ?? '')}
    />
  );
});

Input.displayName = 'Input';

export default Input;

