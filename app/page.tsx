import Image from 'next/image'
import { createAdminClient } from '@/app/lib/supabase/admin'
import ChurchPicker from '@/app/components/ChurchPicker'

// The list of churches is public information (names and kiosk links only).
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { data } = await createAdminClient()
    .from('churches')
    .select('name, slug')
    .eq('is_active', true)
    .order('name')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-8 pb-24">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden card p-8">
        <div aria-hidden="true" className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-yellow-200/70" />
        <div aria-hidden="true" className="absolute -right-10 top-16 h-28 w-28 rounded-full bg-blue-200/60" />

        <div className="relative mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-blue-200">
            <Image src="/kids_logo.jpg" alt="Kids Church logo" width={80} height={80} priority className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Check-In Time!</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">Which church are you at today?</p>
        </div>

        <div className="relative">
          <ChurchPicker churches={data ?? []} />
        </div>
      </div>
    </main>
  )
}
