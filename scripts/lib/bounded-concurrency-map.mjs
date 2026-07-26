// Bounded-concurrency async map for build/test scripts.
// Kept dependency-free on purpose: the repo manifest declares no `p-map`, so
// importing it from a script makes that script unloadable at module resolution.

/**
 * Applies `mapper` to every item with at most `concurrency` calls in flight.
 * Items are dispatched in order; the returned promise rejects with the first
 * mapper rejection (in-flight mappers are allowed to settle, no new items are
 * dispatched after a rejection).
 *
 * @template T
 * @param {readonly T[]} items
 * @param {(item: T, index: number) => Promise<void> | void} mapper
 * @param {number} concurrency
 * @returns {Promise<void>}
 */
export async function mapWithBoundedConcurrency(items, mapper, concurrency) {
  const total = items.length;
  if (total === 0) {
    return;
  }
  const requested = Number.isFinite(concurrency) ? Math.floor(concurrency) : 1;
  const workerCount = Math.max(1, Math.min(requested, total));
  let nextIndex = 0;
  let halted = false;

  const runWorker = async () => {
    while (!halted) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) {
        return;
      }
      try {
        await mapper(items[index], index);
      } catch (error) {
        halted = true;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}
