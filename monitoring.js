(function attachPiBalanceMonitor(root, factory) {
  const monitor = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = monitor;
  if (root) root.PiBalanceMonitor = monitor;
})(typeof window !== "undefined" ? window : globalThis, function createPiBalanceMonitor() {
  function compareBalances(previousRecords, currentRecords) {
    const previous = new Map();
    const current = new Map();

    for (const record of previousRecords || []) {
      if (record && record.id != null) previous.set(String(record.id), record);
    }
    for (const record of currentRecords || []) {
      if (record && record.id != null) current.set(String(record.id), record);
    }

    const added = [];
    const missing = [];
    const updated = [];

    for (const [id, record] of current) {
      if (!previous.has(id)) {
        added.push(record);
        continue;
      }

      const oldRecord = previous.get(id);
      if (
        oldRecord.amount !== record.amount ||
        oldRecord.last_modified_time !== record.last_modified_time ||
        JSON.stringify(oldRecord.claimants || []) !== JSON.stringify(record.claimants || [])
      ) {
        updated.push(record);
      }
    }

    for (const [id, record] of previous) {
      if (!current.has(id)) missing.push(record);
    }

    return { added, missing, updated };
  }

  return { compareBalances };
});
