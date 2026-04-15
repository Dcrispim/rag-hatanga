import * as DialogPrimitive from '@radix-ui/react-dialog';
import React from 'react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogPortal({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      {children}
    </DialogPrimitive.Portal>
  );
}

export function DialogOverlay(props: any) {
  return <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50" {...props} />;
}

export function DialogContent({ children, ...props }: any) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 text-slate-100 rounded-md p-6 w-full max-w-2xl shadow-lg"
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 text-slate-400 hover:text-slate-200">×</DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

