# RateBoard (Stereolinkz)

## Overview

RateBoard is an internal web app for Stereolinkz that turns the day's
forex, proof-of-funds (POF) and crypto rates into branded 1080 × 1920 images
for WhatsApp Status. Today an admin checks the rates, edits the numbers
in a design tool, exports the graphic and posts it. RateBoard replaces
that manual design step. The admin updates rates in a table, sees a
live preview of the board and generates a sharp PNG ready to post. The
app also keeps every rate change and every generated board, so a board
from last Tuesday still shows last Tuesday's rates. A public landing
page at `/` tells customers what Stereolinkz does and shows the latest
published rates.

It is a rate management, publishing and image generation system, not a
rate calculator.

## Goals

1. From sign-in, an admin can update a rate and download a finished
   board in under 60 seconds, on a phone or a laptop.
2. Banks, currencies and coins are database records. Adding "Access
   Bank", "CAD" or "TON" never needs a code or schema change.
3. Every rate change is kept as history, and every generated board keeps
   an immutable snapshot of the exact data it showed.
4. Rate data and visual design are separate. The same data can be
   rendered by any template of the right type.
5. Generated PNGs are pixel-exact renders of the template (SVG → PNG on
   the server), never browser screenshots.

## Core User Flow

1. Admin signs in with Clerk (`/login`) and lands on the dashboard (`/admin`).
2. Admin updates a rate, either from the dashboard's pencil buttons or
   from `/admin/forex`, `/admin/pof` or `/admin/crypto`, in a side drawer. Saving adds a
   new rate record; the old one stays in history.
3. Admin opens the generator (`/admin/generator`) and picks a board type
   (Forex, POF or Crypto).
4. Admin picks a template. The organization default is preselected.
5. The current active rates are prefilled. Admin can untick rows or make
   last-minute edits, which are highlighted in gold.
6. Admin can adjust the headline, subheading, note and small print.
7. The live preview updates on every keystroke. The "WhatsApp view"
   toggle shows where WhatsApp's top bar, caption and Reply bar will sit.
8. Admin clicks Generate image. Edited rates are saved as current, a
   snapshot is stored, and the PNG is rendered and uploaded.
9. Admin downloads the PNG and posts it to WhatsApp Status.
10. Later, the admin can find the board in `/admin/history`, view it,
    download it again, regenerate it (same rates, optionally another
    template) or reuse its rates in the generator.

## Features

### Public landing page (`/`)

- The public face of Stereolinkz: what we do, today's rates, and a fast
  way into a WhatsApp chat. No sign-in.
- Shows the rates from the **latest generated board of each type**
  (Forex, Crypto, POF), never the live rate tables, so the website only
  changes when the team presses Generate. Each section shows the
  board's "Updated" time.
- A calculator ("How much will I get?") estimates the naira amount from
  those rates and opens WhatsApp with the amount, currency and rate
  already written.
- Sections: hero with a 3D phone showing the latest board, rate
  tickers, services (pinned phone that changes screen per service),
  rates and calculator, payments abroad (animated globe), school fees,
  how it works, FAQ and a final call to action. Motion-led design in
  the brand colours; a still version for people who prefer reduced motion.
- WhatsApp number, email, logo and colours come from Settings.
- Never shows invented reviews, figures or licence claims: those
  sections stay hidden until real content is added.

### Authentication

- Sign-in with Clerk (Google or email). No custom password auth.
- Only members of the organization can open `/admin/*`. This is
  checked on the server, not just hidden in the UI.

### Forex rates (`/admin/forex`)

- Table of currencies with buy, sell, spread, change since the previous
  rate, last updated, and an active switch.
- Edit and add in a side drawer (bottom sheet on phones) that shows
  recent history. Edit changes rates only; a currency's code, name,
  symbol and flag are fixed once it is added.
- Activate/deactivate currencies; drag rows to set their order on boards.
- Validation: buy > 0, sell > 0, sell ≥ buy, currency code is 3 letters
  and unique.

### POF rates (`/admin/pof`)

- Table of banks with current POF rate (percent per month), optional
  note (e.g. "New account"), change in percentage points, and a switch
  controlling whether the rate shows on POF boards.
- Edit and add in a side drawer. Validation: 0 ≤ rate ≤ 100.
- Callout for active banks that have no rate yet.

### Crypto rates (`/admin/crypto`)

- Table of coins (BTC, USDT, ETH and alt coins) with buy, sell, spread,
  change since the previous rate, networks (for example TRC20, BEP20),
  last updated, and an active switch.
- Rates are **naira per $1 of coin value**. For stablecoins (USDT,
  USDC) that is the same as naira per coin. Example: a customer selling
  $500 of BTC at ₦1,580 receives ₦790,000.
- Edit and add in a side drawer with recent history. Add takes a
  ticker, name, networks, an optional icon (otherwise a letter badge)
  and the first rates. Edit changes the rates, the networks and the
  icon; the ticker is fixed once the coin is added.
- Activate/deactivate coins; drag rows to set their order on boards.
- Validation: buy > 0, sell > 0, sell ≥ buy; the ticker is 2–6
  uppercase letters or digits and unique.
- A crypto board fits 6 coins. A note in the card covers coins that
  are not on the board ("Also trading TRX, LTC and TON. Ask for a rate.").

### Banks (`/admin/banks`)

- Add, edit, activate and deactivate banks. Upload a logo; set a short
  name that is printed on boards.
- Duplicate names are blocked ("Eco Bank" and "Ecobank" count as the same).
- Delete is allowed only when a bank has no rate history. Otherwise the
  admin deactivates it.

### Templates (`/admin/templates`)

- Browse templates by type (Forex, POF, Crypto, Custom placeholder) with live
  thumbnails drawn from current rates.
- Set the default template per board type; open a template in the generator.
- MVP ships two templates per type: "Purple Signal" (dark) and "Daylight" (light).

### Generator (`/admin/generator`)

- Four steps: board type, template, rates, content. Live preview beside
  them (above them on phones).
- Capacity bar and a clear error when more rows are selected than the
  template fits.
- Generate saves edited rates, stores the snapshot, renders the PNG and
  shows Download / View in history / Make another.

### History (`/admin/history`)

- Boards grouped by day with thumbnail, type, time, template and the
  rates they showed.
- Board detail shows the saved rates, and "Now X" in gold where the
  current rate has changed since.
- Download, Regenerate (new image from the same snapshot; original
  kept) and "Use these rates again".

### Dashboard (`/admin`)

- Four stats: active currencies, active POF banks, boards today, last rate change.
- Today's forex and POF rates with inline edit, the 3 most recent
  boards and the 5 most recent rate changes (forex, POF and crypto).

### Settings (`/admin/settings`)

- Company name, WhatsApp number, email, logo, brand colours, time zone
  (default Africa/Lagos) and default small print.
- Changes apply to new boards only.

## Scope

### In Scope

- Single organization (Stereolinkz), seeded at setup, with the data
  model already organization-scoped for later
- Admin sign-in and server-side membership checks
- Currency and forex rate management with history
- Bank management with logos, and POF rate management with history
- Coin and crypto rate management with history, and crypto boards
- Two templates each for Forex, POF and Crypto, defined in code
- Generator with live preview, 1080 × 1920 PNG generation, and download
- Board history with immutable snapshots, view, download and regenerate
- Settings for company details and brand colours
- A public landing page at `/` showing the latest published board rates
- Responsive layout for desktop, tablet and phone; the generator must
  be fully usable on a phone

### Out of Scope

- Multiple companies / SaaS sign-up (the schema allows it later)
- Roles beyond a single admin level (Owner/Admin/Editor/Viewer come later)
- Automatic rate feeds or external rate APIs
- Gift card, wire transfer or custom board types (enum room only)
- Live crypto prices or exchange feeds; crypto rates are set by hand
- Per-network or per-amount crypto rates (one buy/sell per coin)
- Visual template editor; templates are code
- Posting directly to WhatsApp (the admin downloads and posts)
- Online ordering, customer accounts or payments on the website (every
  deal starts in a WhatsApp chat)
- A blog or CMS; landing page copy lives in code
- Board drafts (a board exists only once generated)
- Extra image formats (square feed, landscape)
- React Flow, Liveblocks, Trigger.dev, Zustand, TanStack Query

## Success Criteria

1. A signed-in member can add a currency, edit its rate, and see the
   previous rate in its history.
2. A non-member with a valid Clerk session gets no admin data and
   cannot run any server action.
3. A new bank can be added with a logo and given a POF rate without
   touching code or the Prisma schema.
4. A bank with rate history cannot be deleted; deactivating it removes
   it from new boards but not from old ones.
5. Editing a rate in the generator updates the preview immediately
   without a page reload.
6. Generating a board produces a 1080 × 1920 PNG stored in Vercel Blob
   and downloadable from history.
7. After changing USD from 1365/1378 to 1370/1385, a board generated
   earlier still shows 1365/1378 in history, and regenerating it still
   renders 1365/1378.
8. The PNG matches the preview. The ₦ sign, flags and bank logos render,
   and the board date uses Africa/Lagos time.
9. The full flow (update rate → generate → download) works on a
   390px-wide phone screen.
10. `npm run build` passes with TypeScript strict mode and no `any`.
11. A coin (for example TON) can be added with its rate and shown on a
    new crypto board without touching code or the Prisma schema, and a
    crypto board made before a rate change still shows the old rate.
12. A signed-out visitor can open `/` on a phone and see the rates of
    the latest generated boards. Generating a new board updates `/`
    within a minute; editing a rate without generating does not.
