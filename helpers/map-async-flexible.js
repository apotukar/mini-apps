export async function mapAsyncFlexible(items, fn, config = {}) {
  const { sequential = false, sleepDuration = 0 } = config;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  if (sequential) {
    const results = [];
    for (const item of items) {
      results.push(await fn(item));
      if (sleepDuration > 0) {
        await sleep(sleepDuration);
      }
    }
    return results;
  }

  return Promise.all(items.map(fn));
}
