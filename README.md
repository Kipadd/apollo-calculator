# Shutters Calculator

A mobile-first, installable quote calculator for shutters. It uses only HTML, CSS and vanilla JavaScript, works offline after the first successful load, and stores the current quote and pricing locally in the browser.

## Run locally

From this folder, start any static HTTP server. Python is one simple option:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080` in a browser. Do not open `index.html` directly with `file://`: service workers require a secure context (`https://` or localhost), and ES modules are also subject to browser origin rules.

## Test the PWA

1. Open `http://localhost:8080/tests.html` and confirm that all calculation tests pass.
   If Node.js is available, the same core checks can be run with `node tests.mjs`.
2. In Chromium DevTools, open **Application → Manifest** and **Application → Service Workers**.
3. Load the app once, select **Offline** in DevTools, and reload. The calculator should still open.
4. In Safari on iPhone, load the deployed HTTPS site once, close it, enable airplane mode, then launch it again from the Home Screen.

## Publish free with GitHub Pages

1. Create a GitHub repository and commit all files in this folder.
2. Push the repository to GitHub.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select the branch and `/ (root)`, then save.
5. Open the HTTPS URL shown by GitHub after deployment completes.

Relative URLs are used throughout, so the app also works when GitHub Pages hosts it under a repository subpath. It can likewise be deployed as-is to Cloudflare Pages, Netlify or Vercel.

## Install on iPhone

1. Open the deployed HTTPS URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Confirm the name and tap **Add**.

## Project guide

- Calculation and inch-to-metre conversion: `calculator.js`
- UI state, validation and localStorage: `app.js`
- Visual design and iPhone safe areas: `styles.css`
- PWA metadata: `manifest.json` and the iOS meta tags in `index.html`
- Offline caching: `sw.js`
- Dependency-free calculation tests: `tests.html`
- Command-line calculation checks: `tests.mjs`

Pricing defaults to €0/m² for Wood, €0/m² for PVC and 25% for Hidden Tilt. **Reset Quote** clears only the current customer and shutter items; saved pricing is preserved.

## Updating the offline cache

Whenever cached app files change, update `CACHE_VERSION` near the top of `sw.js` (for example, from `shutters-calculator-v1` to `shutters-calculator-v2`). The new service worker installs the new cache and removes earlier app-cache versions during activation.
