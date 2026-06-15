/**
 * Bounded fetch for Synapse E2E scripts (CI runners must not hang forever).
 *
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
