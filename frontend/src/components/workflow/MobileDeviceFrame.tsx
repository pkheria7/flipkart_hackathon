import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface MobileDeviceFrameProps {
  children: ReactNode
  title?: string
  className?: string
}

export function MobileDeviceFrame({
  children,
  title = 'Officer Mobile',
  className,
}: MobileDeviceFrameProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-sm rounded-[2rem] border-4 border-slate-800 bg-slate-900 p-2 shadow-panel',
        className,
      )}
    >
      <div className="rounded-[1.5rem] bg-white overflow-hidden">
        <div className="bg-btp-blue px-4 py-2 text-center text-xs font-semibold text-civic-white">
          {title}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
