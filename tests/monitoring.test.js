const test = require("node:test");
const assert = require("node:assert/strict");
const { compareBalances } = require("../monitoring.js");

test("compareBalances reports new, no-longer-listed, and changed balance records", () => {
  const before = [
    { id: "unchanged", amount: "1.0000000", last_modified_time: "2026-01-01T00:00:00Z" },
    { id: "changed", amount: "2.0000000", last_modified_time: "2026-01-01T00:00:00Z" },
    { id: "removed", amount: "3.0000000", last_modified_time: "2026-01-01T00:00:00Z" }
  ];
  const after = [
    { id: "unchanged", amount: "1.0000000", last_modified_time: "2026-01-01T00:00:00Z" },
    { id: "changed", amount: "2.5000000", last_modified_time: "2026-01-02T00:00:00Z" },
    { id: "added", amount: "4.0000000", last_modified_time: "2026-01-03T00:00:00Z" }
  ];

  const changes = compareBalances(before, after);

  assert.deepEqual(changes.added.map(record => record.id), ["added"]);
  assert.deepEqual(changes.missing.map(record => record.id), ["removed"]);
  assert.deepEqual(changes.updated.map(record => record.id), ["changed"]);
});

test("compareBalances treats two empty snapshots as unchanged", () => {
  assert.deepEqual(compareBalances([], []), { added: [], missing: [], updated: [] });
});

test("compareBalances uses the latest record when IDs repeat", () => {
  const changes = compareBalances(
    [{ id: "balance", amount: "1" }],
    [{ id: "balance", amount: "1" }, { id: "balance", amount: "2" }]
  );

  assert.deepEqual(changes.updated.map(record => record.amount), ["2"]);
});
