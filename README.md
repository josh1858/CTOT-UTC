# CTOT Pushback UTC PWA

Installable iPhone/desktop Progressive Web App for CTOT/TSAT pushback planning.

## iPhone installation
A PWA must be hosted on HTTPS before iPhone can install it.

1. Unzip this folder.
2. Upload the folder contents to Netlify Drop, Cloudflare Pages, GitHub Pages, Vercel, or another static HTTPS host.
3. Open the hosted `index.html` link in Safari.
4. Tap **Share > Add to Home Screen**.

## UTC-only mode
All entered and displayed times are UTC/Zulu:
- CTOT (UTC)
- TSAT (UTC)
- Expected Pushback (UTC)
- Earliest/Latest Pushback (UTC)
- Takeoff Window (UTC)
- Latest Engine Start (UTC)
- Current UTC clock

## Features
- Permanent live UTC clock.
- Optional TSAT constraint.
- Earliest pushback countdown.
- Latest engine start countdown based on earliest allowable takeoff.
- Single Engine Taxi mode.
- NOW: Actual Push button.
- Countdown warning states at 10, 5, 2, 1 and 0 minutes.
- Offline caching after installation.

## Calculation rules
- Earliest takeoff = CTOT - 5 min
- Latest takeoff = CTOT + 10 min
- CTOT-only earliest pushback = CTOT - 5 min - taxi time
- Latest pushback = CTOT + 10 min - taxi time
- If TSAT is entered, earliest pushback = later of TSAT or CTOT-only earliest pushback
- Latest engine start = earliest allowable takeoff - 5 min

## Test status
Automated test result: ALL_TESTS_PASS
