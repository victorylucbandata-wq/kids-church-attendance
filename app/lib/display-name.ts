export function formatDisplayName(firstName: string, lastName: string, nickname: string | null): string {
  if (nickname) return `${nickname} (${lastName}, ${firstName})`
  return `${firstName} ${lastName}`
}
