import Link from 'next/link'
import Image from 'next/image'
import HelpWizard, { HelpStep } from './components/HelpWizard'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '👋',
    title: 'Returning Member',
    body: 'If your child has checked in before, tap "Returning Member", pick their age group, then tap their name. Done!',
  },
  {
    emoji: '✨',
    title: 'First Timer',
    body: 'New here? Tap "First Timer" and fill in a few details about your child. They\'ll be registered and checked in at the same time.',
  },
  {
    emoji: '📝',
    title: 'Allergies & Notes',
    body: 'When checking in, you can add allergies or special notes so our volunteers know how to care for your child today.',
  },
  {
    emoji: '🙋',
    title: 'Need a hand?',
    body: 'Tap the blue "?" button anytime to see these tips again, or just ask one of our friendly volunteers!',
  },
]

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-8 pb-24">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden card p-8">
        <div aria-hidden="true" className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
        <div aria-hidden="true" className="absolute -right-10 top-16 h-28 w-28 rounded-full bg-blue-200/60" />
        <div aria-hidden="true" className="absolute bottom-8 -left-10 h-20 w-20 rounded-full bg-pink-200/60" />

        <div className="relative mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-blue-200">
            <Image
              src="/kids_logo.jpg"
              alt="Kids Church logo"
              width={80}
              height={80}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-brand">Kids Church</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            Check-In Time!
          </h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Welcome! Please select how you&apos;d like to check in today.
          </p>
          <div aria-hidden="true" className="mt-4 flex justify-center gap-2 text-2xl">
            <span>🌈</span>
            <span>⭐</span>
            <span>🎨</span>
            <span>📖</span>
          </div>
        </div>

        <div className="relative space-y-4">
          <Link
            href="/check-in/returning"
            className="flex min-h-[80px] w-full items-center justify-between rounded-2xl bg-brand px-6 py-5 shadow-lg shadow-blue-200 transition hover:bg-brand-strong active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <div className="text-left">
              <p className="text-lg font-black text-white">Returning Member</p>
              <p className="text-sm text-blue-50">Already registered? Tap here.</p>
            </div>
            <span aria-hidden="true" className="text-3xl">👋</span>
          </Link>

          <Link
            href="/check-in/new"
            className="flex min-h-[80px] w-full items-center justify-between rounded-2xl border-2 border-blue-100 bg-white px-6 py-5 shadow-md transition hover:border-blue-200 hover:bg-blue-50/50 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <div className="text-left">
              <p className="text-lg font-black text-slate-800">First Timer</p>
              <p className="text-sm text-slate-500">New here? Register your child.</p>
            </div>
            <span aria-hidden="true" className="text-3xl">✨</span>
          </Link>
        </div>

        <div className="relative mt-8 text-center">
          <Link
            href="/admin"
            className="inline-block px-4 py-3 text-sm font-bold text-slate-600 transition hover:text-slate-900"
          >
            Admin
          </Link>
        </div>
      </div>

      <HelpWizard title="How to check in" steps={HELP_STEPS} />
    </main>
  )
}
