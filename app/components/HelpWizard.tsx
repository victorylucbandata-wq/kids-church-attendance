'use client'

import { useEffect, useState } from 'react'

export type HelpStep = {
  emoji: string
  title: string
  body: string
}

type Props = {
  title?: string
  steps: HelpStep[]
}

export default function HelpWizard({ title = 'How it works', steps }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Reset to the first step whenever the wizard is opened.
  const openWizard = () => {
    setStep(0)
    setOpen(true)
  }

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const isFirst = step === 0
  const isLast = step === steps.length - 1
  const current = steps[step]

  return (
    <>
      {/* Floating help button */}
      <button
        type="button"
        onClick={openWizard}
        aria-label="Open help"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#227EEE] text-2xl font-black text-white shadow-lg shadow-blue-300 transition hover:brightness-95 active:scale-95"
      >
        ?
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 transition hover:bg-slate-200"
            >
              ✕
            </button>

            <p className="text-sm font-bold uppercase tracking-wide text-[#227EEE]">{title}</p>

            {/* Step content */}
            <div className="mt-4 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl">
                {current.emoji}
              </div>
              <h2 className="text-xl font-black text-slate-900">{current.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{current.body}</p>
            </div>

            {/* Progress dots */}
            <div className="mt-6 flex justify-center gap-2">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === step ? 'w-6 bg-[#227EEE]' : 'w-2 bg-blue-100'
                  }`}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={isFirst}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-400 transition hover:text-slate-600 disabled:opacity-0"
              >
                ← Back
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl bg-[#227EEE] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95"
                >
                  Got it!
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="rounded-2xl bg-[#227EEE] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-95"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
