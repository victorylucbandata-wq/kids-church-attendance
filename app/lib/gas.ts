export async function callGas<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const url = process.env.GOOGLE_SCRIPT_URL
  const secret = process.env.ATTENDANCE_SECRET

  if (!url || !secret) {
    throw new Error('GOOGLE_SCRIPT_URL or ATTENDANCE_SECRET is not set.')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, action, ...payload }),
    cache: 'no-store',
  })

  const text = await res.text()

  let data: T & { success: boolean; error?: string }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Apps Script returned non-JSON: ' + text.slice(0, 200))
  }

  if (!data.success) {
    throw new Error(data.error ?? 'Apps Script action failed')
  }

  return data
}
