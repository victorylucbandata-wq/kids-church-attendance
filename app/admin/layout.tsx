import { getAdminContext } from '@/app/lib/church'
import AdminNav from './AdminNav'

// Signed in with a church picked: every admin page gets the shared header and tabs.
// Sign-in, and choosing a first church, stay bare.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext()
  if (!ctx) return <>{children}</>
  return (
    <>
      <AdminNav churchName={ctx.church.name} email={ctx.email} role={ctx.role} />
      {children}
    </>
  )
}
