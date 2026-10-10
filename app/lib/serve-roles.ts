// The roles of a usual Lucban service, in the order the leaders list them.
export const SERVE_ROLES = [
  'Team Leader (& Tithes and Offering)',
  'Asst Team Leader (& House Rules)',
  'Preacher',
  'Registration',
  'Games',
  'Music Team',
  'Tech/Comms',
  'Door Keeper',
  'Communion',
]

/** Sorts roster entries by that order; other roles come after, A to Z. */
export const byServeRole = (a: { serveRole: string }, b: { serveRole: string }) => {
  const rank = (r: string) => (SERVE_ROLES.includes(r) ? SERVE_ROLES.indexOf(r) : SERVE_ROLES.length)
  return rank(a.serveRole) - rank(b.serveRole) || a.serveRole.localeCompare(b.serveRole)
}
