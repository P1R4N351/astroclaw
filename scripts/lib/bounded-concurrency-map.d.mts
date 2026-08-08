export function mapWithBoundedConcurrency<T>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<void> | void,
  concurrency: number,
): Promise<void>;
