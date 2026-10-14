const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { setTimeout: delay } = require("node:timers/promises");
const { compareBalances } = require("../monitoring.js");

function makeElement() {
  return {
    children: [],
    listeners: {},
    classList: { add() {} },
    hidden: true,
    disabled: false,
    textContent: "",
    className: "",
    innerHTML: "",
    value: "",
    addEventListener(type, handler) { this.listeners[type] = handler; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {},
    focus() {}
  };
}

function textContent(node) {
  return [node.textContent, ...node.children.map(textContent)].filter(Boolean).join(" ");
}

function createApp(fetchImpl) {
  const elements = new Map();
  const intervals = new Map();
  const documentListeners = {};
  let nextIntervalId = 1;
  const document = {
    hidden: false,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    createElement: makeElement,
    addEventListener(type, handler) { documentListeners[type] = handler; }
  };
  const window = {
    setInterval(callback, milliseconds) {
      const id = nextIntervalId++;
      intervals.set(id, { callback, milliseconds });
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback) { callback(); }
  };
  const context = {
    document,
    window,
    navigator: { clipboard: { readText: async () => "", writeText: async () => {} } },
    fetch: fetchImpl,
    AbortController,
    PiBalanceMonitor: { compareBalances },
    console,
    Intl,
    Date
  };
  const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  vm.runInNewContext(script, context, { filename: "script.js" });
  return { elements, intervals, documentListeners };
}

const wallet = `G${"A".repeat(55)}`;
const record = (amount, modified) => ({
  id: "balance-1",
  amount,
  last_modified_time: modified
});
const response = records => ({ ok: true, json: async () => ({ _embedded: { records } }) });

test("the open page polls every 30 seconds and displays balance updates in Lagos time", async () => {
  const snapshots = [
    [record("1.25", "2026-01-01T00:00:00Z")],
    [record("1.50", "2026-01-02T00:00:00Z")]
  ];
  const urls = [];
  const app = createApp(async url => {
    urls.push(url);
    return response(snapshots.shift());
  });

  app.elements.get("#wallet").value = wallet;
  await app.elements.get("#lookup-form").listeners.submit({ preventDefault() {} });

  assert.equal(app.intervals.size, 1);
  const timer = [...app.intervals.values()][0];
  assert.equal(timer.milliseconds, 30_000);
  const initialText = textContent(app.elements.get("#results"));
  assert.match(initialText, /balance-1/);
  assert.match(initialText, /1\.25/);
  assert.match(initialText, /Africa\/Lagos time/);
  const expectedDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Africa/Lagos", timeZoneName: "short"
  }).format(new Date("2026-01-01T00:00:00Z"));
  assert.ok(initialText.includes(expectedDate), `expected rendered timestamp ${expectedDate}`);
  assert.equal(app.elements.get("#result-count").textContent, "Found 1 claimable balance");
  assert.match(textContent(app.elements.get("#refresh-state")), /last checked/);

  timer.callback();
  await delay(0);

  assert.equal(urls.length, 2);
  assert.match(textContent(app.elements.get("#change-summary")), /1 updated/);
  assert.match(textContent(app.elements.get("#results")), /1\.50/);
});

test("empty API results show the empty state and keep monitor controls available", async () => {
  const app = createApp(async () => response([]));
  app.elements.get("#wallet").value = wallet;
  await app.elements.get("#lookup-form").listeners.submit({ preventDefault() {} });

  assert.equal(app.elements.get("#empty-state").hidden, false);
  assert.equal(app.elements.get("#results-section").hidden, false);
  assert.equal(app.elements.get("#result-count").textContent, "Found 0 claimable balances");
  assert.equal(app.elements.get("#toggle-refresh-button").disabled, false);
});

test("an automatic refresh error leaves the last successful balance visible", async () => {
  let calls = 0;
  const app = createApp(async () => {
    calls += 1;
    if (calls === 1) return response([record("1.25", "2026-01-01T00:00:00Z")]);
    throw new Error("network unavailable");
  });
  app.elements.get("#wallet").value = wallet;
  await app.elements.get("#lookup-form").listeners.submit({ preventDefault() {} });
  [...app.intervals.values()][0].callback();
  await delay(0);

  assert.match(app.elements.get("#status").textContent, /Automatic refresh failed/);
  assert.match(textContent(app.elements.get("#results")), /balance-1/);
  assert.match(textContent(app.elements.get("#results")), /1\.25/);
});

test("an HTTP API error is shown without replacing the last successful balance", async () => {
  let calls = 0;
  const app = createApp(async () => {
    calls += 1;
    if (calls === 1) return response([record("1.25", "2026-01-01T00:00:00Z")]);
    return { ok: false, status: 502, json: async () => ({ error: "Pi Mainnet API unavailable" }) };
  });
  app.elements.get("#wallet").value = wallet;
  await app.elements.get("#lookup-form").listeners.submit({ preventDefault() {} });
  [...app.intervals.values()][0].callback();
  await delay(0);

  assert.match(app.elements.get("#status").textContent, /Pi Mainnet API unavailable/);
  assert.match(textContent(app.elements.get("#results")), /balance-1/);
  assert.match(textContent(app.elements.get("#results")), /1\.25/);
});
