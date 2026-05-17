import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Kids Church Attendance
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Use the check-in page to record children&apos;s attendance.
        </p>

        <Link
          href="/kids-attendance"
          className="mt-6 inline-block rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Go to Check-In Form
        </Link>
      </section>
    </main>
  )
}