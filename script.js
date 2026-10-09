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

let currentBalances = [];

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
  statusBox.hidden = !message;
}
function clearResults() {
  resultsSection.hidden = true;
  emptyState.hidden = true;
  resultsBox.replaceChildren();
  currentBalances = [];
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
    zone.textContent = "(Your local time)";
    field.append(zone);
  }
  return field;
}
function renderBalances(records) {
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

    card.append(
      makeField("Balance ID", id, { copy: record.id != null }),
      makeField("Amount (Pi)", amount, { copy: record.amount != null, amount: true, pi: true }),
      makeField("Last modified", date, { date: true })
    );
    resultsBox.append(card);
  });
  emptyState.hidden = true;
  resultsSection.hidden = false;
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
  clearResults();

  if (!isPlausiblePiAddress(wallet)) {
    showStatus("Invalid address format. Enter a public Pi wallet address beginning with G and containing 56 characters. Never enter a passphrase or private key.", "error");
    return;
  }

  fetchButton.disabled = true;
  fetchButton.innerHTML = "<span>◌</span> Fetching…";
  showStatus("Loading claimable balances…");
  try {
    const response = await fetch(`/api/balances?wallet=${encodeURIComponent(wallet)}`, {
      headers: { "Accept": "application/json" }
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error("The server returned an unreadable response. Please try again."); }

    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}). Please try again.`);
    const records = payload?._embedded?.records;
    if (!Array.isArray(records)) throw new Error("The Pi API response was unexpected. Please try again later.");

    if (records.length === 0) {
      showStatus("No claimable balances found.", "error");
      emptyState.hidden = false;
      return;
    }
    showStatus("Balances loaded successfully.", "success");
    renderBalances(records);
  } catch (error) {
    showStatus(error.message || "Could not fetch balances. Check your connection and try again.", "error");
  } finally {
    fetchButton.disabled = false;
    fetchButton.innerHTML = "<span>⌕</span> Fetch";
  }
});
copyAllButton.addEventListener("click", () => {
  if (!currentBalances.length) return;
  const lines = currentBalances.map(item => `${item.id ?? ""} + ${item.amount ?? ""}`);
  copyText(lines.join("\n"), copyAllButton);
});
