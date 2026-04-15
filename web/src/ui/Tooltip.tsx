import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import React from 'react';

export function Tooltip({ children, content }: { children: React.ReactElement; content: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="top" className="bg-gray-800 text-white text-sm px-2 py-1 rounded">
          {content}
          <TooltipPrimitive.Arrow className="fill-gray-800" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

