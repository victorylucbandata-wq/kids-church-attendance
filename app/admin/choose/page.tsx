import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { listAccess } from '@/app/lib/church'
import Decor from '@/app/components/Decor'
import ChurchChoice from './ChurchChoice'
import SignOutButton from '@/app/admin/SignOutButton'

export default async function ChooseChurchPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/admin/login')

  const { churches, isNetworkAdmin } = await listAccess(user.id)

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-md space-y-4">
        <div className="card p-6 text-center">
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">⛪</span>Choose a church</h1>
          <p className="mt-1 text-sm text-slate-600">Signed in as {user.email}</p>
        </div>

        {churches.length > 0 ? (
          <ChurchChoice churches={churches.map((m) => ({ id: m.church.id, name: m.church.name, role: m.role }))} />
        ) : (
          <div className="card p-6 text-center">
            <p className="font-black text-slate-800">You haven&apos;t been added to a church yet</p>
            <p className="mt-1 text-sm text-slate-600">Ask your church&apos;s kids ministry lead to invite this email address.</p>
          </div>
        )}

        {isNetworkAdmin && (
          <Link href="/network" className="flex min-h-11 items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong">
            Open network overview
          </Link>
        )}

        <div className="text-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  )
}
