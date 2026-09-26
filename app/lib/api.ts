type ApiBody = { success?: boolean; error?: string }

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'

// Every client call goes through here: network drops and API errors come back
// as a readable message instead of a throw, so no button is left stuck on "Saving…".
export async function requestJson<T extends object = ApiBody>(
  url: string,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json()) as T & ApiBody
    if (!res.ok || data.success === false) {
      return { ok: false, error: data.error || 'That did not save. Please try again.' }
    }
    return { ok: true, data }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return { ok: false, error: NETWORK_ERROR }
  }
}
