# EcoFlow Monitor App

A mobile/web dashboard that visualizes the live status of an EcoFlow power station: battery level, charge/discharge power flow, connected devices, and power source (AC/solar/USB).

This is the companion app to [`ecoflow-monitor`](../ecoflow-monitor), a sibling Python project that runs a Telegram bot for the same EcoFlow device. Both projects read from the same EcoFlow data source; this repo focuses on the visual dashboard, the bot repo focuses on chat-based notifications and control.

<!-- TODO: add screenshot -->

## Tech stack

- [Expo](https://expo.dev/) (SDK 57) / [React Native](https://reactnative.dev/)
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [react-native-svg](https://github.com/software-mansion/react-native-svg) for the custom battery/device/power-flow icon set
- [EAS](https://docs.expo.dev/eas/) for native builds and OTA updates
- [Vercel](https://vercel.com/) for hosting the web export (live demo)

## Setup

```bash
npm install
npx expo start
```

From the Expo CLI menu you can open the app on iOS, Android, or web (press `w`).

## Project structure

- `App.tsx` — root component, composes the dashboard from the pieces below
- `components/` — `ChargeSummary`, `PowerSummary`, `GroupHeaderIcon`, and other dashboard components
- `components/icons/` — the SVG icon set (battery, fan, device, arrows, percent ring, etc.)
- `hooks/` — shared React hooks
- `utils/` — small utilities (e.g. grouping devices by type)

## Build & deploy

### Native builds (EAS)

Native builds and OTA updates are configured via `eas.json` (development/preview/production profiles) and the EAS project ID in `app.json`.

```bash
npx eas build --profile preview   # or development / production
npx eas update                    # push an OTA update
```

### Web export (Vercel)

The live web demo is a static export deployed to Vercel — this isn't wired up anywhere else, so it's documented here:

```bash
npm run build:web   # runs `expo export -p web`, outputs to dist/
```

`vercel.json` points Vercel at that same command and output directory (`buildCommand: npm run build:web`, `outputDirectory: dist`), so pushing to the connected Vercel project rebuilds and redeploys the web export automatically.

## CI

GitHub Actions runs `typecheck` (`tsc --noEmit`) and `build:web` on every push/PR — see the workflow under `.github/workflows/`.
