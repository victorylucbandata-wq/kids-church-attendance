'use client'

import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  label: string
  children: React.ReactNode
}

// Native <dialog>: focus trap, Escape to close, and focus return come for free.
export default function Modal({ open, onClose, label, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Focus the panel, not the first field, so phones don't pop the keyboard on open.
      panelRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // Clicks on the backdrop land on the <dialog> itself; clicks inside land on the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-[2rem] bg-transparent p-0 text-slate-900"
    >
      {open && (
        <div ref={panelRef} tabIndex={-1} className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[2rem] bg-white p-6 shadow-2xl outline-none">
          {children}
        </div>
      )}
    </dialog>
  )
}
