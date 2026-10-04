// Sunday in the Philippines, regardless of which region the server runs in.
export function todayInManila(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}
