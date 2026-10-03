'use client'

import { useState } from 'react'
import Link from 'next/link'
import HelpWizard, { HelpStep } from '@/app/components/HelpWizard'
import Notice from '@/app/components/Notice'
import Decor from '@/app/components/Decor'
import { requestJson } from '@/app/lib/api'
import type { ImportRow } from '@/app/lib/member-import'

const HELP_STEPS: HelpStep[] = [
  {
    emoji: '📄',
    title: 'Fill in the template',
    body: 'Download the template and open it in Google Sheets or Excel. Put one child or serve team member on each row. Only First Name and Last Name are required.',
  },
  {
    emoji: '🎂',
    title: 'Birthdays and roles',
    body: 'Write birthdays as YYYY-MM-DD, e.g. 2018-03-25. Role is Child or Serve Team (blank means Child). Age Group must match a group on the Age Groups page.',
  },
  {
    emoji: '💾',
    title: 'Save as CSV',
    body: 'Google Sheets: File → Download → Comma-separated values (.csv). Excel: File → Save As → CSV UTF-8.',
  },
  {
    emoji: '🔍',
    title: 'Check, then import',
    body: 'Choose the file to see every row first. Nothing is saved until you tap Import. People already in your list are skipped, so you can fix the file and upload it again.',
  },
]

type Preview = { rows: ImportRow[]; imported: number }

const STATUS = {
  ok: { label: 'Ready', className: 'bg-green-50 text-green-800' },
  duplicate: { label: 'Skipped', className: 'bg-slate-100 text-slate-700' },
  error: { label: 'Problem', className: 'bg-red-50 text-red-800' },
} as const

export default function ImportMembersPage() {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  const send = (text: string, confirm: boolean) =>
    requestJson<Preview>('/api/admin/members/import', { method: 'POST', body: { csv: text, confirm } })

  const handleFile = async (file: File | undefined) => {
    setPreview(null)
    setError('')
    setDone(null)
    if (!file) return
    setBusy(true)
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    const res = await send(text, false)
    if (res.ok) setPreview(res.data)
    else setError(res.error)
    setBusy(false)
  }

  const handleImport = async () => {
    setBusy(true)
    setError('')
    const res = await send(csv, true)
    if (res.ok) {
      setDone(res.data.imported)
      setPreview(null)
    } else {
      setError(res.error)
    }
    setBusy(false)
  }

  const count = (s: ImportRow['status']) => preview?.rows.filter((r) => r.status === s).length ?? 0
  const ready = count('ok')
  // Problems first, so they're not missed at the bottom of a long list.
  const order = { error: 0, ok: 1, duplicate: 2 }
  const rows = [...(preview?.rows ?? [])].sort((a, b) => order[a.status] - order[b.status] || a.line - b.line)

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50 px-4 pt-6 pb-24">
      <Decor />
      <div className="relative mx-auto max-w-2xl space-y-4">
        <Link href="/admin/members" className="inline-block py-3 text-sm font-bold text-brand hover:underline">← Back to Members</Link>

        <div>
          <h1 className="text-2xl font-black text-slate-900"><span aria-hidden="true" className="mr-2">📥</span>Import Members</h1>
          <p className="text-sm text-slate-600">Add many kids and serve team members at once from a spreadsheet.</p>
        </div>

        <div className="card p-4 space-y-3">
          <p className="text-sm font-bold text-slate-700">1. Download the template and fill it in.</p>
          <a
            href="/member-template.csv"
            download="member-template.csv"
            className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-blue-100 bg-white px-4 py-2.5 text-sm font-black text-brand transition hover:bg-blue-50"
          >
            Download template (CSV)
          </a>
          <p className="text-xs text-slate-600">
            Columns: Last Name, First Name, Nickname, Birthday (YYYY-MM-DD), Role (Child or Serve Team), Age Group,
            Parent / Guardian, Contact Number, Notes. Tap the ? button for step-by-step help.
          </p>

          <p className="pt-2 text-sm font-bold text-slate-700">2. Save it as CSV and choose the file.</p>
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-brand-strong focus-within:ring-4 focus-within:ring-blue-200">
            {fileName ? `Choose a different file (${fileName})` : 'Choose CSV file'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={busy}
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
            />
          </label>
        </div>

        {busy && <p role="status" className="py-2 text-center text-sm text-slate-600">Checking…</p>}
        {error && <Notice kind="error">{error}</Notice>}
        {done !== null && (
          <Notice kind="success">
            {done === 0 ? 'Nothing new to import.' : `Imported ${done} member${done === 1 ? '' : 's'}.`}{' '}
            <Link href="/admin/members" className="underline">View members</Link>
          </Notice>
        )}

        {preview && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">3. Check the rows, then import.</p>
            <p className="text-sm text-slate-700">
              <strong>{ready}</strong> ready · <strong>{count('duplicate')}</strong> already in your list ·{' '}
              <strong>{count('error')}</strong> with problems
            </p>
            {count('error') > 0 && (
              <p className="text-xs text-slate-600">
                Rows with problems are not imported. Fix them in the spreadsheet and upload it again later; the ones already imported will be skipped.
              </p>
            )}

            <button
              onClick={handleImport}
              disabled={busy || ready === 0}
              className="w-full rounded-2xl bg-brand px-4 py-3.5 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-brand-strong disabled:opacity-60"
            >
              {ready === 0 ? 'Nothing to import' : `Import ${ready} member${ready === 1 ? '' : 's'}`}
            </button>

            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.line} className="rounded-2xl border-2 border-blue-50 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-800">{r.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[r.status].className}`}>
                      {STATUS[r.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Row {r.line}
                    {r.member && ` · ${r.member.role === 'volunteer' ? 'Serve Team' : 'Child'}`}
                    {r.member?.birthday && ` · Birthday ${new Date(`${r.member.birthday}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </p>
                  {r.problems.map((p) => (
                    <p key={p} className={`text-xs font-bold ${r.status === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{p}</p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <HelpWizard title="Import guide" steps={HELP_STEPS} />
    </main>
  )
}
