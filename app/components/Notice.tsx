// Inline status message. Errors interrupt screen readers; successes wait their turn.
export default function Notice({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  return kind === 'error' ? (
    <p role="alert" className="rounded-2xl border-2 border-red-100 bg-red-50 p-3 text-center text-sm font-bold text-red-800">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-2xl bg-green-700 p-3 text-center text-sm font-black text-white">
      {children}
    </p>
  )
}
