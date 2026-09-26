'use client'

import { useState } from 'react'
import Modal from './Modal'

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
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-black text-white shadow-lg shadow-blue-300 transition hover:bg-brand-strong active:scale-95"
      >
        ?
      </button>

      <Modal open={open} onClose={() => setOpen(false)} label={title}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close help"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600 transition hover:bg-slate-200"
        >
          ✕
        </button>

        <p className="pr-12 text-sm font-bold text-brand">{title}</p>

        {/* Step content */}
        <div className="mt-4 text-center" aria-live="polite">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl"
          >
            {current.emoji}
          </div>
          <h2 className="text-xl font-black text-balance text-slate-900">{current.title}</h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex justify-center gap-2" aria-label={`Step ${step + 1} of ${steps.length}`} role="img">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all motion-reduce:transition-none ${
                i === step ? 'w-6 bg-brand' : 'w-2 bg-blue-100'
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
            className="min-h-11 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:text-slate-900 disabled:invisible"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={isLast ? () => setOpen(false) : () => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="min-h-11 rounded-2xl bg-brand px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong"
          >
            {isLast ? 'Got it!' : 'Next →'}
          </button>
        </div>
      </Modal>
    </>
  )
}
