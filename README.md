# Pi Network — Claimable Balances (Desktop-first)

A read-only Pi Mainnet claimable-balance monitor built with plain HTML, CSS, and JavaScript. Enter a public wallet address to view up to 10 claimable balances and keep the page open to refresh them automatically every 30 seconds.

## Files
- `index.html` — desktop-first page layout
- `style.css` — desktop dashboard styling with tablet/mobile adaptations
- `script.js` — address validation, polling controls, rendering, Lagos-time formatting, and copy actions
- `monitoring.js` — compares consecutive balance snapshots
- `tests/app-monitoring.test.js` — in-memory UI checks for polling, timestamp display, empty results, and errors
- `tests/monitoring.test.js` — Node's built-in tests for balance-change detection
- `api/balances.mjs` — Vercel serverless proxy for the Pi API

## Monitoring behavior
- The first lookup starts browser-side monitoring. The page polls `/api/balances` every 30 seconds while open.
- Use **Refresh now** for an immediate check or **Pause auto-refresh** to stop polling.
- The dashboard reports new, updated, and no-longer-listed balances. The API returns up to 10 records, so absence means an item was not in the latest response, not necessarily that it was permanently removed. A failed refresh leaves the last successful results visible and retries on the next interval.
- Refresh requests use `Cache-Control: no-store`. Polling pauses while the tab is hidden and resumes with a check when the page becomes visible again.
- Timestamps are shown in Africa/Lagos time (WAT).
- This is page-session monitoring, not a background worker. It stops when the page is closed and does not submit transactions.

## Security
Only public wallet addresses are used. The app never requests or stores a wallet passphrase or private key. The balance endpoint is read-only and requires no API key.

## Tests
Node.js 18 or newer is required for the built-in test runner. Run:

```sh
node --test
```

## Deploy
1. Push the repository to GitHub, preserving the `api/balances.mjs` path.
2. Import the repository into Vercel.
3. Set the Vercel Root Directory to the repository root and select **Other** as the Framework Preset.
4. Leave the Build Command blank. Keep the Output Directory at Vercel's default (`.` / repository root); do not set `dist` or `build` because this project has no build step or `public` folder.
5. Deploy. Vercel serves the root HTML/CSS/JS files and the `api/balances.mjs` function at `/api/balances`.

The route is `/api/balances?claimant=YOUR_PUBLIC_ADDRESS`. It requests up to 10 records from Pi Mainnet and disables response caching for fresh polling results.

## Manual checks
1. Enter a valid public address and confirm IDs, amounts, and last-modified timestamps appear.
2. Leave the page open and confirm the last-checked timestamp advances after each refresh.
3. Pause and resume auto-refresh, then use **Refresh now**.
4. If possible, compare a wallet with changing balances and confirm new, changed, and no-longer-listed records are summarized. If no live balance changes are available, use `node --test` to verify snapshot-diff logic.
5. Temporarily disable the network or API and confirm the error appears while prior results remain visible; restore connectivity and confirm the next poll recovers.
6. Deploy a preview on Vercel and run the same checks against the deployed `/api/balances` route.
