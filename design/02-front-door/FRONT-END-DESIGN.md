# Front End Design

**Above:** [The architecture](../../ARCHITECTURE.md) §4.1 and the [front door](FRONT-DOOR.md).

**Talks to:** the desk home described by [DESK.md](../03-desk/DESK.md) and [HOME.md](../03-desk/HOME.md); the [Journal](../07-journal/JOURNAL.md) and its [review requirements](../07-journal/REVIEW.md); and the [front-door routes and shared login](FRONT-DOOR.md).

**Reference:** [approved Trade-Disk Trading Station homepage concept](front-end-reference.png), supplied by the trader on 2026-10-13. The written decisions below resolve ambiguous or conflicting labels in the reference.

---

## 1. Purpose and boundary

This document specifies the **Trade-Disk Trading Station home / front-end entry screen**: the first screen a signed-in trader reaches, the four product cards, and the route from that home into the Journal.

It is **not the Journal design**. Journal pages, data, capture, metrics, navigation and responsive behavior remain defined by [JOURNAL.md](../07-journal/JOURNAL.md), [REVIEW.md](../07-journal/REVIEW.md) and [IMPORT.md](../07-journal/IMPORT.md). This document adds the product-level front door that precedes those pages.

The front door remains a thin entry point. It does not own trading records, calculate performance, place orders, authenticate users independently, or make the other tools operational. The front-door component's technical ownership and login/routing rules remain in [FRONT-DOOR.md](FRONT-DOOR.md). The **Station home** (this document) is the launcher; it is distinct from the **desk's operator home** ([HOME.md](../03-desk/HOME.md): Manage tools, the cross-tool comparison), which is not a user screen in the built front end ([HOME.md §3.4](../03-desk/HOME.md)). Any cross-tool list the Station surfaces reads the desk's data; it does not make the Station the desk's home.

### Route ownership

- `/` is the **Trading Station home — the launcher**, after sign-in. It is *not* the desk: the desk is Radar's back end ([FRONT-DOOR.md §3.3](FRONT-DOOR.md)), not the home at `/`.
- `/login` is the shared sign-in route from [FRONT-DOOR.md](FRONT-DOOR.md).
- Each product is a **self-contained app** the Station opens: the Journal at `/journal/`, Radar at `/radar/`, TradeLab at `/tradelab/`. Each app switches its own screens in the browser; the front door serves the app (static) and routes its `/api/…` calls ([FRONT-DOOR.md §3.2–3.3](FRONT-DOOR.md)).
- The Journal's initial screen is its own overview, not a second Trade-Disk home; returning to `/` returns to the Station. Each product remains usable on its own, subject to the account and access design ([ACCOUNTS.md](../13-accounts/ACCOUNTS.md)).

**Implementation boundary:** the static prototypes (`frontend-design/index.html`, `radar.html`, `tradelab.html`) are the design reference, not the production route definition. In the built shape the Station is at `/` and each product app at its own path, served as **static files** (the box in solo, a CDN in hosted) with data from the API — not HTML rendered by the desk on a tool port. In the `index.html` prototype the Station landing and the Journal share one file for convenience; in production the Station is the launcher and the Journal is its own app. Do not deploy the Station as the Journal overview or place the Station route inside the Journal's navigation.

### The prototype is the visual contract

The approved prototypes are the **visual and UX contract** for the Station and the three tools: the layout, the hierarchy, the navigation, the screens each tool shows, and the visual system. **That view — what the trader sees and how they move through each tool — is the one thing that must be preserved.** How the front end is *built* is an implementation choice and may change freely:

- a single prototype file may be **split into several apps** (the Station and the Journal share `index.html` today; in production they are separate apps), and new files, a build step or a component framework may be introduced;
- the prototype's **demo behavior and synthetic data are not the spec** — the final product *looks* like the prototype but is backed by the real data and the real backend ("looks like it, need not function like it in the shadow");
- the screen inventory each tool shows is fixed by the prototype (the Station's cards; the Journal's sections; Radar's Screener/Shortlist/Market/Settings + the analysis workspace; TradeLab's rail), but the wiring behind each screen is the backend's to shape.

So the backend and the front-end structure are shaped **to fit this view** ([FRONT-DOOR.md](FRONT-DOOR.md), [DATA-MODEL.md](../DATA-MODEL.md)); either side may move to meet the other, as long as the view holds. A change to the user-facing view itself needs the trader's re-approval; a change to how it is built or backed does not.

---

## 2. Product inventory and launch state

The home presents four distinct Trade-Disk tools:

| Order | Tool | Home-card purpose | Status for this design | Action |
|---|---|---|---|---|
| 1 | **Trading Journal** | Track real trades, review performance, and improve process | **Available first** | Open `/journal/` |
| 2 | **Radar** | Find and screen stock opportunities | **Preview** (interactive demo prototype) | Opens the Radar preview (`radar.html`), clearly labelled demo / not-live |
| 3 | **TradeLab** | Charting, indicators, strategy development and backtesting | **Preview** (interactive demo prototype) | Opens the TradeLab preview (`tradelab.html`), clearly labelled demo / not-live |
| 4 | **TradePilot** | Algorithmic strategy automation and execution controls | **In development / Coming soon** | Informational card only; no tool route |

**Current status (updated 2026-10-14):** the **Journal is the one production tool**; **TradeLab and Radar are available as interactive demo previews** (their prototype pages, every figure labelled demo / not-live); **TradePilot is still Coming soon** and non-navigable. The preview cards link to their prototype pages and stay honest about being demos — they do not claim a live, backed product. (This supersedes the earlier "Journal only; the other three non-navigable" decision, after the trader had TradeLab and Radar built as previews.)

Do not present a preview as a finished product, invent a release date, or imply a preview places orders or uses live data. A preview card must carry a visible demo / not-live status. When product status changes, update this table and the desk tool registry/route contract together.

---

## 3. Page composition and hierarchy

The desktop layout follows the supplied light/dark concept. The hierarchy is the same in either theme.

### 3.1 Header

- Trade-Disk mark and wordmark at the left; descriptor: **THE TRADING STATION**.
- Product navigation and account actions at the right.
- **Products** scrolls to the four-tool section.
- **Sign in** uses the shared `/login` route when signed out; the signed-in state uses the shared account/sign-out behavior, not a second authentication system.
- **Get Started** is a prominent route to the only currently available product, the Journal at `/journal/`.
- **Pricing**, **Resources**, **About**, and search appear only when their destinations and behavior are defined. They must not be dead links, empty overlays, or fabricated product promises. The desk home specification (`HOME.md`) owns any cross-tool navigation or content not defined here.

### 3.2 Hero

- Eyebrow: **ANALYZE. PLAN. EXECUTE. IMPROVE.**
- Headline: **Your Trading. One Station.** with the second line/accent visually emphasized.
- Supporting message: four tools help the trader find opportunities, analyze, test, trade and improve, on web and Android.
- Primary action: **Open Trading Journal** (or the consistent short label **Open Journal**) routes to `/journal/`.
- Secondary action: **Explore the tools** scrolls to the product cards.
- Three short proof points: web and Android; tools usable independently; built for active traders. Do not claim platform support that has not been implemented.
- A product-workspace visual may show a desktop screen with a companion mobile view. Prefer real UI from this application. If it shows sample figures or sample trades, label them as illustrative/demo; never imply that synthetic figures are the trader's real performance.

### 3.3 Four-tool section

- Section heading: **Four Tools. One Complete Trading Station.** (or the equivalent approved headline **Choose your trading tool**).
- Supporting line clarifies that tools can be used independently; the Journal is the production tool, with TradeLab and Radar available as previews.
- Four cards in the table order above. Each includes its tool name, one-sentence purpose, distinct icon/color treatment, and a visible status label.
- The Journal card is first and visually prioritized (blue primary accent, clear launch action); it links to `/journal/`.
- The **TradeLab and Radar** cards are interactive **Preview** cards linking to their prototype pages (`tradelab.html`, `radar.html`), each carrying a visible demo / not-live status. **TradePilot** is present as a future tool, subdued and non-interactive, with an explicit Coming-soon label.

### 3.4 Journal callout and footer

- A secondary Journal callout may follow the tool grid, reinforcing **Available now** and linking to `/journal/`.
- The footer identifies Trade-Disk and may contain links only to destinations defined by their owning design documents.
- A concise demo/data notice is required anywhere sample market figures or trade outcomes are shown.

---

## 4. Visual system

- **Brand character:** focused, trustworthy, modern trading software; clear data hierarchy, not a noisy broker terminal.
- **Color:** saturated blue is the primary Trade-Disk action/accent, balanced with near-white surfaces in light mode and deep navy surfaces in dark mode. The two themes preserve contrast and meaning. Do not reuse the Journal's green accent as the global Trade-Disk brand accent; Journal may retain its own product accent within its own workspace.
- **Typography:** a clean sans-serif family; bold compact hero headline, restrained navigation, readable card titles and body copy. Avoid condensed all-caps body text.
- **Layout:** wide responsive hero with copy and a product visual side by side on desktop; vertically stacked on phones. Four cards form a balanced row on wide screens and a two-column or single-column stack on narrow screens.
- **Cards:** consistent geometry and spacing; the Journal uses the strongest visual emphasis. Future-tool status is visible without making the entire card resemble an active button.
- **Illustration:** use actual UI screenshots or a clearly labelled interface illustration. Do not present illustrative chart values as live quotes, verified analysis, or account data.
- **Motion:** short, low-amplitude hover/focus transitions only. Respect reduced-motion preferences; do not animate charts as though they are live.

---

## 5. Interaction, accessibility and responsive behavior

### Interactions

- All Journal CTAs and the Journal card resolve to the same `/journal/` destination.
- Products navigation and the secondary hero action scroll to the four-tool section and preserve keyboard access.
- TradePilot (not yet built) is not an anchor or button; it exposes its “Coming soon” status as readable text. TradeLab and Radar are real links to their demo previews, each labelled not-live; they never imply a live, backed product.
- Sign in follows the shared login from [FRONT-DOOR.md](FRONT-DOOR.md). No public registration or subscription workflow is implied by this home-page design.
- Home navigation remains available from Journal pages using the front-door link and route.

### Accessibility

- Use semantic header, navigation, main, section and footer landmarks with a meaningful heading order.
- Provide visible keyboard focus, descriptive link/button labels, and accessible names for icon-only controls.
- Do not communicate availability by color alone; every tool card has text status.
- Maintain WCAG AA text contrast for both themes. Support 200% zoom and reduced motion.

### Responsive requirements

Use the Journal responsive acceptance widths as shared viewport targets: **360, 390, 640, 1024 and 1440 CSS px**. At every width:

- the home fills the available viewport without page-level horizontal scrolling;
- header actions remain reachable (collapse low-priority text navigation before shrinking the Journal CTA);
- the hero text and visual reflow without overlap or clipped labels;
- product cards remain in reading order: Journal, Radar, TradeLab, TradePilot;
- non-available status labels remain visible;
- touch targets are comfortably usable on Android; and
- the Journal action remains obvious without requiring hover.

The Journal's own detailed responsive contract remains in [REVIEW.md §10](../07-journal/REVIEW.md).

---

## 6. Copy and product-truth rules

- The home describes **four tools**, and clearly distinguishes the **production Journal**, the **TradeLab and Radar demo previews**, and **TradePilot (in development)**.
- The first screen's next action is to open the Journal; there is no promise that all four tools are ready.
- Use “trading journal” for recording and analyzing actual trades. Do not imply that the Journal places orders.
- Never display fabricated prices, personal results, integrations, subscriptions, testimonials, or release dates as facts.
- If sample performance data is used inside a UI illustration, mark it as synthetic demo data, consistent with [IMPLEMENTATION-STATUS.md](../07-journal/IMPLEMENTATION-STATUS.md).
- Keep Trading Station home copy and functionality separate from Journal-specific metrics and feature claims.

---

## 7. Contracts and ownership

| Concern | Owner / contract |
|---|---|
| `/` and `/journal/` routing, shared login, URL prefixes | [FRONT-DOOR.md](FRONT-DOOR.md) |
| Home content, tool availability, cross-tool lists, Manage tools | [DESK.md](../03-desk/DESK.md); detailed home behavior belongs in [03-desk/HOME.md](../03-desk/HOME.md) |
| Tool identifiers, configured/running/stopped status and route registry | [DESK.md](../03-desk/DESK.md) and [FILES.md](../04-files/FILES.md) |
| Journal overview, records, metrics, responsive workspace and product boundaries | [JOURNAL.md](../07-journal/JOURNAL.md) and [REVIEW.md](../07-journal/REVIEW.md) |
| Trade capture/import | [IMPORT.md](../07-journal/IMPORT.md) |
| TradeLab capabilities | [QP.md](../05-qp/QP.md) |
| Shared navigation across programs | [FRONT-DOOR.md §3.4](FRONT-DOOR.md#34-the-page-shell-across-programs) |

This front-end document does not define new backend APIs, tool registry fields, release dates, account plans, or Journal calculations. Those belong to their respective design documents.

---

## 8. Completion criteria

The front-end design is complete when an implementation:

1. Opens the signed-in trader at the Trade-Disk home `/`, not at a Journal-only overview.
2. Shows the four tools in the specified order and clearly marks the Journal as the first available tool.
3. Marks TradePilot as coming soon with no launch action, and presents TradeLab and Radar as demo previews that link to their prototype pages and are labelled not-live.
4. Routes the Journal card and primary CTA to `/journal/`; the Journal remains its own product and overview.
5. Preserves the shared login and route behavior in [FRONT-DOOR.md](FRONT-DOOR.md).
6. Matches the approved light/dark visual direction, blue Trade-Disk accent, hierarchy and responsive composition.
7. Works at the required viewport widths, with no page-level horizontal overflow and with keyboard/touch access to the Journal.
8. Labels illustrative sample information honestly and does not claim unbuilt features.
9. Leaves detailed home operations to the desk's `HOME.md` and leaves Journal behavior to its existing design documents; any newly discovered requirement is added to its owning document rather than duplicated here.

### Dependencies and status

The **visual/front-door scope in this document is specified**. Before treating the whole home experience as production-complete, reconcile implementation with the desk's [HOME.md](../03-desk/HOME.md) (cross-tool lists and Manage tools), [WEB.md](../03-desk/WEB.md) (page/request behavior), and the tool registry in [FILES.md](../04-files/FILES.md). A missing detail in those documents is a documented dependency, not permission to invent behavior. This file does not change the build status of Radar, TradeLab or TradePilot, nor claim the front-end is deployed as the permanent production home.
