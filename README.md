# Pi Network — Claimable Balances (Desktop-first)

A read-only Pi Mainnet claimable-balance lookup built with plain HTML, CSS, and JavaScript.

## Files
- `index.html` — desktop-first page layout
- `style.css` — desktop dashboard styling with tablet/mobile adaptations
- `script.js` — address validation, API calls, local date formatting, and copy actions
- `api/balances.js` — Vercel serverless proxy for the Pi API

## Deploy
1. Upload the files to a GitHub repository, preserving the `api/balances.js` path.
2. Import the repository into Vercel.
3. Select **Other** as the framework preset if prompted.
4. Leave build command and output directory empty, then deploy.

The route is `/api/balances?wallet=YOUR_PUBLIC_ADDRESS`. It requests up to 10 records.
Never enter a wallet passphrase or private key.
