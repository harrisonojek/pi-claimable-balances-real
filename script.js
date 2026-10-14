const form = document.querySelector("#lookup-form");
const walletInput = document.querySelector("#wallet");
const fetchButton = document.querySelector("#fetch-button");
const pasteButton = document.querySelector("#paste-button");
const copyAllButton = document.querySelector("#copy-all-button");
const statusBox = document.querySelector("#status");
const resultsSection = document.querySelector("#results-section");
const resultsBox = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const refreshNowButton = document.querySelector("#refresh-now-button");
const toggleRefreshButton = document.querySelector("#toggle-refresh-button");
const refreshState = document.querySelector("#refresh-state");
const changeSummary = document.querySelector("#change-summary");

let currentBalances = [];
let monitoredWallet = "";
let previousSnapshot = null;
let refreshTimer = null;
let refreshInProgress = false;
let activeController = null;
let autoRefreshEnabled = true;
let lastSuccessfulRefresh = null;
const REFRESH_INTERVAL_MS = 30_000;

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
  statusBox.hidden = !message;
}
function clearResults() {
  resultsSection.hidden = true;
  emptyState.hidden = true;
  resultsBox.replaceChildren();
  changeSummary.hidden = true;
  currentBalances = [];
}
function stopAutoRefresh() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = null;
}
function startAutoRefresh() {
  stopAutoRefresh();
  refreshNowButton.disabled = !monitoredWallet;
  toggleRefreshButton.disabled = !monitoredWallet;
  toggleRefreshButton.textContent = autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh";
  refreshState.textContent = autoRefreshEnabled
    ? `Automatic refresh is on · every ${REFRESH_INTERVAL_MS / 1000} seconds.`
    : "Automatic refresh is paused.";
  if (!autoRefreshEnabled || !monitoredWallet) return;

  refreshTimer = window.setInterval(() => {
    if (!document.hidden) fetchBalances(monitoredWallet, { automatic: true });
  }, REFRESH_INTERVAL_MS);
}
function isPlausiblePiAddress(address) {
  const cleanedAddress = String(address || "").trim().toUpperCase();
  return /^G[A-Z2-7]{55}$/.test(cleanedAddress);
}
async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const original = button.innerHTML;
      button.textContent = "Copied!";
      window.setTimeout(() => { button.innerHTML = original; }, 1300);
    }
  } catch {
    showStatus("Copy failed. Your browser may block clipboard access. Open this site over HTTPS and try again.", "error");
  }
}
function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Africa/Lagos",
    timeZoneName: "short"
  }).format(date);
}
function makeField(label, value, options = {}) {
  const field = document.createElement("div");
  field.className = "record-field";
  const labelEl = document.createElement("span");
  labelEl.className = "field-label";
  labelEl.textContent = label;
  field.append(labelEl);

  const row = document.createElement("div");
  row.className = "field-value-row";

  if (options.pi) {
    const pi = document.createElement("span");
    pi.className = "pi-symbol";
    pi.textContent = "π";
    pi.setAttribute("aria-hidden", "true");
    row.append(pi);
  }

  const valueEl = document.createElement("span");
  valueEl.className = "field-value";
  if (options.amount) valueEl.classList.add("amount-value");
  if (options.date) valueEl.classList.add("date-value");
  valueEl.textContent = value;
  row.append(valueEl);

  if (options.copy) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy ${label.toLowerCase()}`);
    button.addEventListener("click", () => copyText(value, button));
    row.append(button);
  }
  field.append(row);
  if (options.date) {
    const zone = document.createElement("span");
    zone.className = "date-zone";
    zone.textContent = "(Africa/Lagos time)";
    field.append(zone);
  }
  return field;
}
function renderBalances(records, changes = null) {
  currentBalances = records;
  resultsBox.replaceChildren();
  resultCount.textContent = `Found ${records.length} claimable balance${records.length === 1 ? "" : "s"}`;

  records.forEach((record, index) => {
    const card = document.createElement("article");
    card.className = "balance-card";
    card.setAttribute("aria-label", `Claimable balance ${index + 1}`);

    const id = record.id == null ? "Not provided" : String(record.id);
    const amount = record.amount == null ? "Not provided" : String(record.amount);
    const date = formatDate(record.last_modified_time);
    const changeType = changes?.added.some(item => item.id === record.id)
      ? "New"
      : changes?.updated.some(item => item.id === record.id) ? "Updated" : "";

    if (changeType) {
      const badge = document.createElement("span");
      badge.className = `balance-change ${changeType.toLowerCase()}`;
      badge.textContent = changeType;
      card.append(badge);
    }

    card.append(
      makeField("Balance ID", id, { copy: record.id != null }),
      makeField("Amount (Pi)", amount, { copy: record.amount != null, amount: true, pi: true }),
      makeField("Last modified (WAT)", date, { date: true })
    );
    resultsBox.append(card);
  });
  emptyState.hidden = true;
  resultsSection.hidden = false;
}
function summarizeChanges(changes) {
  const parts = [];
  if (changes.added.length) parts.push(`${changes.added.length} new`);
  if (changes.updated.length) parts.push(`${changes.updated.length} updated`);
  if (changes.missing.length) parts.push(`${changes.missing.length} no longer listed`);

  changeSummary.textContent = parts.length
    ? `Changes since the previous check: ${parts.join(", ")}.`
    : "No balance changes since the previous check.";
  changeSummary.hidden = false;
}
function updateLastChecked() {
  if (!lastSuccessfulRefresh) return;
  refreshState.textContent = autoRefreshEnabled
    ? `Watching ${monitoredWallet.slice(0, 6)}…${monitoredWallet.slice(-4)} · refreshes every ${REFRESH_INTERVAL_MS / 1000}s · last checked ${formatDate(lastSuccessfulRefresh.toISOString())}.`
    : `Auto-refresh paused · last checked ${formatDate(lastSuccessfulRefresh.toISOString())}.`;
}
async function fetchBalances(wallet, { automatic = false } = {}) {
  if (refreshInProgress && automatic) return;
  if (activeController) activeController.abort();

  const controller = new AbortController();
  activeController = controller;
  refreshInProgress = true;
  refreshNowButton.disabled = true;
  fetchButton.disabled = true;
  if (!automatic) {
    fetchButton.innerHTML = "<span>◌</span> Fetching…";
    showStatus("Loading claimable balances…");
  }

  try {
    const response = await fetch(`/api/balances?claimant=${encodeURIComponent(wallet)}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error("The server returned an unreadable response. Please try again."); }

    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}). Please try again.`);
    const records = payload?._embedded?.records;
    if (!Array.isArray(records)) throw new Error("The Pi API response was unexpected. Please try again later.");

    if (controller.signal.aborted || monitoredWallet !== wallet) return;
    const changes = previousSnapshot === null ? null : PiBalanceMonitor.compareBalances(previousSnapshot, records);
    previousSnapshot = records;
    lastSuccessfulRefresh = new Date();
    renderBalances(records, changes);
    emptyState.hidden = records.length > 0;

    if (changes) summarizeChanges(changes);
    else {
      changeSummary.textContent = "Initial check complete. Changes will appear here after the next refresh.";
      changeSummary.hidden = false;
    }

    if (!automatic) showStatus(records.length ? "Balances loaded successfully." : "No claimable balances found.", records.length ? "success" : "");
    else if (!records.length) showStatus("No claimable balances found. Monitoring will continue.", "success");
    else showStatus("Balances refreshed successfully.", "success");
    updateLastChecked();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (controller.signal.aborted || monitoredWallet !== wallet) return;
    if (automatic && previousSnapshot !== null) {
      showStatus(`Automatic refresh failed: ${error.message} Existing results are still shown; the next check will retry.`, "error");
    } else {
      showStatus(error.message || "Could not fetch balances. Check your connection and try again.", "error");
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      refreshInProgress = false;
      fetchButton.disabled = false;
      fetchButton.innerHTML = "<span>⌕</span> Fetch";
      refreshNowButton.disabled = !monitoredWallet;
    }
  }
}
pasteButton.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showStatus("Your clipboard is empty.", "error");
      return;
    }
    walletInput.value = text.trim();
    walletInput.focus();
    showStatus("Address pasted. Click Fetch to continue.", "success");
  } catch {
    showStatus("Clipboard access was blocked. Click the address field and use your browser's Paste command.", "error");
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const wallet = walletInput.value.trim().toUpperCase();

  if (!isPlausiblePiAddress(wallet)) {
    stopAutoRefresh();
    monitoredWallet = "";
    previousSnapshot = null;
    lastSuccessfulRefresh = null;
    clearResults();
    startAutoRefresh();
    showStatus("Invalid address format. Enter a public Pi wallet address beginning with G and containing 56 characters. Never enter a passphrase or private key.", "error");
    return;
  }

  const isNewWallet = wallet !== monitoredWallet;
  if (isNewWallet) {
    stopAutoRefresh();
    monitoredWallet = wallet;
    previousSnapshot = null;
    lastSuccessfulRefresh = null;
    clearResults();
  }
  autoRefreshEnabled = true;
  startAutoRefresh();
  await fetchBalances(wallet);
  startAutoRefresh();
  updateLastChecked();
});
refreshNowButton.addEventListener("click", () => {
  if (monitoredWallet) fetchBalances(monitoredWallet);
});
toggleRefreshButton.addEventListener("click", () => {
  autoRefreshEnabled = !autoRefreshEnabled;
  startAutoRefresh();
  updateLastChecked();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && autoRefreshEnabled && monitoredWallet) fetchBalances(monitoredWallet, { automatic: true });
});
copyAllButton.addEventListener("click", () => {
  if (!currentBalances.length) return;
  const lines = currentBalances.map(item => `${item.id ?? ""} + ${item.amount ?? ""}`);
  copyText(lines.join("\n"), copyAllButton);
});
