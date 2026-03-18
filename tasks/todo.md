# Task: PWA Web Share Target Integration (Alternative to Floating Button)

## 📋 Todo
- [x] Analyze technical requirements for a floating button on Android via PWA
- [x] Identify limitations of PWA regarding drawing over other apps (`SYSTEM_ALERT_WINDOW`)
- [x] Determine the best PWA-native alternative for extracting links from OLX natively (Web Share Target API)
- [x] Update `vite.config.js` to include `share_target` in the PWA manifest
- [x] Update `src/ui/App.tsx` and PWA service worker to catch and process incoming shared URLs
- [x] Connect the shared URL to the Orchestrator's input automatically

## 📝 Notes
- Natively drawing a generic floating widget over other OS applications (like OLX) is exclusively a Native App feature (requires Android Action `SYSTEM_ALERT_WINDOW`). PWAs operate securely in a web sandbox and cannot do this.
- The quoted text (position: fixed) only creates a floating button *inside* the PWA browser tab, which is invisible the instant you open the OLX application.
- The best exact alternative: **Web Share Target**. This allows NegoApp to appear directly in the Android OS "Share" menu. A user simply presses "Share" on an OLX listing -> clicks "NegoApp" -> NegoApp opens instantly with the link already captured.

## 🏁 Review
The Web Share Target API has been successfully integrated into the application:
1. `vite.config.js` now exports a PWA manifest with `share_target` configuration pointing to `/`.
2. `OrchestratorView.tsx` parses `window.location.search` for shared parameters (`title`, `text`, `url`), extracts standard HTTP URLs via Regex, and correctly triggers `quickSend()` to start processing OLX links instantly upon sharing them via native OS systems.
