// Adapters await this so the frontend's loading states are exercised for real
// rather than flashing past on localhost. A summary that returns in 0ms hides
// every spinner bug you have.

const MIN_MS = 800
const MAX_MS = 1200

export function delay(ms?: number): Promise<void> {
  const duration = ms ?? MIN_MS + Math.random() * (MAX_MS - MIN_MS)
  return new Promise((resolve) => setTimeout(resolve, duration))
}
