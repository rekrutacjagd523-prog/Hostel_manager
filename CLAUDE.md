# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hostel Manager — a PWA for managing hostel/property residents, bookings, finances, and reporting. Built with vanilla JavaScript (ES6 modules) and Firebase backend. Deployed to Cloudflare Pages.

## Tech Stack

- **Frontend:** Vanilla JS (ES6 modules), no framework, no build step
- **Backend:** Firebase Firestore (real-time) + Firebase Auth (Email/Password + Google OAuth)
- **CDN libs:** XLSX (Excel/CSV export), PDFMake (PDF generation), DM Sans font
- **Hosting:** Cloudflare Pages (hostel-manager.pages.dev)
- **PWA:** Service worker (`sw.js`) with cache-first strategy, cache name `hostel-v3`

## Development

No build system, no package.json, no npm. Open `index.html` directly or serve with any static server. All JS modules load via ES6 imports from `js/modules/`.

Firebase project ID: `hostel-manager-8d837`.

## Architecture

### Single-Page App Structure

- `index.html` — single HTML file with all screens embedded (auth, main app, modals)
- `js/main.js` — entry point, imports all modules, sets up event listeners
- `js/modules/` — 13 feature modules (~3,400 lines total)
- `styles/main.css` — all styles with CSS variable-based dark/light theming

### State Management

All app state lives on `window` globals:
- `window._residents`, `window._properties`, `window._expenses`, `window._bookings` — data arrays
- `window._settings` — user settings (currency, language, plan)
- `window._currentUser` — authenticated Firebase user
- `window._fb` — Firebase API handlers

Firebase `onSnapshot` listeners (set up in `firebase-api.js`) update these globals and trigger `window.render()`.

### Firestore Schema

Per-user collections under `users/{uid}/`:
- `residents`, `properties`, `expenses`, `bookings` — data collections
- `settings/main` — single document for user preferences
- `members` — workspace team members

### Rendering Pattern

No virtual DOM. Modules export render functions (e.g., `renderBookings()`, `renderExpenses()`) that build HTML strings and inject via `innerHTML`. Event handling uses inline `onclick` attributes in generated HTML.

### Module Map

| Module | Responsibility |
|---|---|
| `firebase-api.js` | Firebase init, auth state, real-time Firestore listeners |
| `auth.js` | Login/register UI, Google OAuth |
| `ui.js` | Master render engine, filtering, pagination, section toggling |
| `residents.js` | Resident CRUD, check-in/out, rate changes, long-press selection |
| `properties.js` | Property/room management, occupancy tracking |
| `bookings.js` | Booking system (pending/confirmed/checked-in), calendar view |
| `finance.js` | Expenses, income, categories, P&L calculations |
| `subscription.js` | Freemium limits, upgrade modal, referral codes |
| `report-export.js` | Period-based reports, CSV/PDF export |
| `settings.js` | Theme, language, currency, field manager, team members |
| `constants.js` | i18n dictionaries (5 langs), currencies, housing types |
| `utils.js` | Format helpers, ID generation, Firestore ref shortcuts |
| `rate-history.js` | Payment calculations with historical rate changes |

## i18n

5 languages: RU, PL, UA, EN, LT. Translations in `constants.js` via `LANG` object. Two accessor functions:
- `t(key)` — current user language
- `at(key)` — auth screen language (persists before login via localStorage)

## Freemium Limits

```
FREE_LIMITS = { residents: 6, properties: 3, expenses: 50, bookings: 30 }
```

Pro status checked via `isPro()` which reads `_settings.plan` and `validUntil`.

## Cloudflare Headers

`_headers` file sets COOP/COEP headers required for Google OAuth popup to work.

## Commit Convention

Prefix commits with `feat:`, `fix:`, etc. Development follows phases (Auth → Properties → Finance → Bookings).
