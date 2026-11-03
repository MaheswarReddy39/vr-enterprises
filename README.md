# VR Enterprises

Premium e-commerce platform for purifier products. Monorepo with a React storefront/admin and an Express API.

**Status: Milestone 6 built, then changed to product booking.** There are **no online payments**: customers book products, the business confirms them and arranges payment itself. Razorpay and invoices have been removed.

## Stack

| Layer    | Technology                                                                           |
| -------- | ------------------------------------------------------------------------------------ |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router                                         |
| Backend  | Node.js (>= 20), Express 4, Mongoose, Zod, Helmet, CORS, rate limiting, sharp        |
| Data     | MongoDB: a plain local mongod or Atlas (no replica set needed)                         |
| Images   | MongoDB GridFS in the same database (no separate image service, no extra credentials) |
| Auth     | JWT access + rotating refresh tokens, bcrypt (`bcryptjs`, cost 12), role-based access |
| Orders   | Product booking requests (no online payment)                                        |

## Structure

```
client/                React + Vite app (storefront at /, admin at /admin)
  src/components/ui/     design system primitives (Button, Input, Modal, Toast, SafeImage, ...)
  src/admin/             responsive admin shell, pages and components
  src/api/               API client (no secrets, base URL only)
server/
  src/config/            env validation, MongoDB connection
  src/models/            User, Product, Category, Brand, InventoryLog (+ shared GridFS image schema)
  src/services/          business logic (gridfs, image, product, category, inventory, auth)
  src/routes/ controllers/ middleware/ validators/
  scripts/               create-admin, seed-demo, generate-demo-images
  seed/demo-images/      placeholder images + SOURCES.md (licences)
  tests/                 node:test suites
scripts/                 root helpers: init-env (npm run setup), preflight (runs before npm run dev)
```

## Quick start

Prerequisites: Node.js 20+ and MongoDB: either a normal local install (`mongodb://localhost:27017/vr_enterprises`) or a **MongoDB Atlas** cluster. No replica set is needed.

```bash
npm install
npm run setup          # creates server/.env with freshly generated JWT secrets
```

Open `server/.env` and set `MONGODB_URI` to your Atlas connection string (Atlas > Connect > Drivers; allow your IP under Network Access). Then:

```bash
npm run create-admin   # first administrator (password prompt is hidden)
npm run dev            # API on :5000, web on :5173
```

- Storefront: http://localhost:5173
- Admin: http://localhost:5173/admin
- Health: http://localhost:5000/api/v1/health
- Design system reference (dev only): http://localhost:5173/design-system

`npm run dev` first runs a preflight check and tells you in plain words if `server/.env`, `MONGODB_URI` or the JWT secrets are missing. In development Vite proxies `/api` to the API, so the browser only talks to one origin. Run either half alone with `npm run dev:server` or `npm run dev:client`.

### Demo data (optional)

```bash
npm run seed:demo                  # 6 clearly marked DEMO purifier products with placeholder images
npm run seed:demo -- --remove      # delete all demo products, images and the demo category
```

Names end in "(DEMO)", SKUs start with `DEMO-`, descriptions say they are sample data, and prices/stock are invented for layout only (stock is varied so the low-stock and out-of-stock alerts show). They contain **no** technical claims, certifications or warranty. The images are generated placeholder illustrations, not photographs; see `server/seed/demo-images/SOURCES.md` for why and how to replace them. The seed refuses to run when `NODE_ENV=production`.

### Local MongoDB (instead of Atlas)

A normal standalone `mongod` works. Set `MONGODB_URI=mongodb://localhost:27017/vr_enterprises` in `server/.env`. When the site is finished, replace it with your Atlas connection string; nothing else changes.

### Create the first admin

```bash
npm run create-admin
# or: npm run create-admin -- --name "Full Name" --email you@example.com
```

The password is prompted for with hidden input (never passed as an argument). For non-interactive use set `ADMIN_PASSWORD` in the environment for that one command. The script refuses to run if an admin already exists. Password policy: at least 10 characters with lower case, upper case, a digit and a symbol.

## Environment variables

`server/.env` (see `server/.env.example`):

| Variable                                  | Required            | Purpose                                                              |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| `MONGODB_URI`                             | yes                 | MongoDB connection string: local `mongodb://localhost:27017/vr_enterprises` or Atlas. Holds data AND images |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes                 | 32+ chars each, must differ (`npm run setup` generates them)          |
| `PORT`                                    | no (5000)           | API port                                                             |
| `CLIENT_URL`                              | no (localhost:5173) | Allowed CORS origin(s), comma-separated                              |
| `COOKIE_SAME_SITE`                        | no (lax)            | `none` only if site and API are on different domains (HTTPS)         |

`client/.env` is optional; only `VITE_API_BASE_URL` (production API URL). Everything with a `VITE_` prefix is public, so never put secrets there. The server validates its environment at startup and exits with a clear message if something is wrong. There are no Cloudinary variables any more.

## Image storage (GridFS)

- Uploads go to the API (`POST /api/v1/admin/products/:id/images`, field `images`), are validated (JPEG/PNG/WebP, 5 MB each, 10 per product; the real file bytes are checked and the file must decode as an image), **converted to WebP (max 1600 px) with a 480 px thumbnail, metadata stripped**, and stored in the `images` GridFS bucket (`images.files` / `images.chunks`).
- Product and category documents hold only ids and metadata (`fileId`, `thumbFileId`, size, dimensions...). Image bytes are never embedded or base64-encoded.
- Images are served publicly at `GET /api/v1/media/:id` with `Cache-Control: immutable`, ETag/304 support and `nosniff`. Only image files from the bucket are served; a missing file returns 404 (the admin UI then shows a neutral placeholder).
- Upload, reorder, primary and delete endpoints require an admin/staff token. Deleting an image, replacing a category image or permanently deleting a product removes the GridFS files too. A failed or partly failed upload leaves nothing behind.
- Same driver and code on Atlas; no extra service. If you later outgrow it, only `services/gridfs.service.js` and `image.service.js` need to change.
- Atlas storage note: the free tier has 512 MB. Optimised images are typically 20-200 KB each, so 20 products with several images each use a few MB.

## Inventory consistency

The app does not use MongoDB transactions, so it runs on a standalone MongoDB. Instead, every write is a single atomic update and multi-step changes are done in a safe order with undo on failure:

- **Stock adjustments** apply one guarded update (`stock >= quantity` is part of the update, so concurrent removals can never go below zero), then write the `InventoryLog` entry. If the log write fails, the stock change is reversed.
- **Creating a product with opening stock** saves the product, then the log entry; if the entry fails the product is removed again.
- **Confirming a booking** is described under "Product booking".
- **Crash recovery (bookings):** while a confirmation is in progress, each product records the booking ID in the same atomic update that deducts its stock, and the booking records when it was claimed. If the server stops half-way, `recoverBookings()` runs at start-up (and every 5 minutes) and restores exactly the stock that was really taken, removes the history entries, and returns the booking to Pending so it can simply be confirmed again. It leaves confirmations younger than 2 minutes alone, is safe to run twice, and logs a "Recovered interrupted confirmation" warning.
- Remaining limitation: a crash between an admin stock adjustment (or product creation) and its history entry can leave one stock change without a history line. Nothing is lost or double-counted; the stock number itself is correct.

## Health endpoints

- `GET /api/v1/health`: liveness. Always 200; reports `database` and `imageStorage` (never any secrets).
- `GET /api/v1/health/ready`: readiness. 503 until MongoDB is connected.

## Tests

```bash
npm test                                   # server + client (database suites are skipped without a URI)
```

Database suites run on any MongoDB (a normal local mongod is fine) and use a throwaway database that is dropped afterwards:

```bash
TEST_MONGODB_URI="mongodb://localhost:27017/" npm test            # macOS/Linux/Git Bash
$env:TEST_MONGODB_URI="mongodb://localhost:27017/"; npm test      # PowerShell
```

Pointing `TEST_MONGODB_URI` at a standalone server fails loudly rather than passing misleadingly.

## Troubleshooting the Render deployment

- **Opening the bare address (`https://<service>.onrender.com/`)**: it answers with a small JSON pointer. The API itself lives under `/api/v1`. Check `/api/v1/health/ready` (should say `"status":"ready"` and `"environment":"production"`), then `/api/v1/store/settings`, `/api/v1/store/products?featured=true&limit=4`, `/api/v1/store/categories` and `/api/v1/store/banners`. Older builds returned `404 Route not found: GET /` at the bare address; that was not a fault.
- **`"environment":"development"` in the health response, or a startup warning that NODE_ENV is not production**: the Render environment has `NODE_ENV=development`, usually because the local `server/.env` was pasted into Render. In Render > Environment set `NODE_ENV=production`, delete any `PORT` variable (Render provides it) and redeploy. In development mode the refresh cookie is not marked Secure, error responses include debug details and client IPs are wrong behind the proxy.
- **Startup log says `localhost`**: ignore the word; the server listens on all interfaces. Older builds printed `API listening on http://localhost:<port>` even on Render.

## Troubleshooting `npm run dev`

- **"Lifecycle script `dev` failed ... command failed vite"** after you press Ctrl+C is just npm reporting that the process was stopped; it is not a Vite error. If Vite printed its `Local:` URL and served pages, Vite was working.
- **Vite proxy `ECONNREFUSED` for `/api/...`**: the API is not running. Run the API alone (`npm run dev:server`) to see why; the usual cause is a missing `server/.env` (`npm run setup`, then set `MONGODB_URI`).
- **A page goes blank, or the console says "Failed to fetch dynamically imported module"**: the browser could not download that page's file, usually because the Vite dev server was stopped or restarted (or, in production, the site was redeployed while the tab was open). The storefront now shows a "This page could not be loaded" message with a **Reload page** button instead of a blank screen, keeps the header and footer working, and retries the download once automatically. Reload the tab after restarting `npm run dev`.
- **Stopping one server stops both**: `npm run dev` runs the API and Vite together and stops both if either exits (that is what the "exited with code 1 / 143" lines are). Run `npm run dev:server` and `npm run dev:client` in two terminals if you want them independent.
- **"Port 5173 is in use, trying another one"**: an old Vite is still running. Open the URL Vite prints, or stop the stale process.

## Design system

Tokens live in `client/src/index.css` (`@theme`). The palette (deep teal + brass), the "VR Enterprises" wordmark and the font pairing (Fraunces headings, Inter body) are **placeholders** until the official logo and brand colours are supplied; swapping the token values restyles everything. No product data, contact details or policies are hardcoded: these are managed from the admin.

## Storefront (Milestone 3)

| Route | Page |
| --- | --- |
| `/` | Home: hero, featured purifiers, shop by category, why choose us, product benefits, trust and service, testimonials, contact and enquiry |
| `/shop` | All products: search, category filter, price/name sorting, pagination (URL-driven: `?q=&category=&sort=&page=`) |
| `/product/:slug` | Gallery, price, availability, quantity, add to cart, description, specifications from MongoDB, related products |
| `/about`, `/contact`, `/faq` | Information pages (contact has a working enquiry form) |
| `/shipping-policy`, `/return-refund-policy`, `/privacy-policy`, `/terms-and-conditions` | Policy templates |

**Public API** (no login; read-only): `GET /api/v1/store/products`, `/store/products/:slug-or-id`, `/store/products/:key/related`, `/store/categories`, and `POST /store/enquiries`. Only **published** products in **active** categories are ever returned, through an explicit field allow-list: no `createdBy`, exact stock, thresholds or image internals. Unpublished/archived products return 404 by slug and by id. Images load from `/api/v1/media/:id` (GridFS).

**Enquiries:** visitors' messages are stored in MongoDB (name, email, optional phone, message, optional product) with validation, a honeypot field and a rate limit (8 per hour per connection). Admins read and triage them under **Admin > Enquiries**. There is no email sending yet, so check the dashboard.

### Editing the placeholder content

Nothing about the business is invented. Everything that needs your real information is a clearly flagged placeholder:

- `client/src/config/business.js`: name, phone, email, address, hours (shown as "[Add phone number]" until replaced; placeholders are never turned into links), the demo testimonials, and `isPreview`.
- `client/src/content/pages.js`: About, FAQ and the four policy pages. They are **templates with [bracketed] prompts**, not real policies. Have the legal pages reviewed before publishing.
- **Testimonials are DEMO content**, labelled as such on the page. Replace them with genuine, permission-based reviews or set `demoTestimonials` to `[]` to hide the section.
- **Preview mode:** while `isPreview` is `true` the site shows a "Preview site" bar and every page carries `noindex, nofollow`. Set it to `false` when the real content is in place.
- **Demo products:** the six `(DEMO)` products (`npm run seed:demo`) show a "Demo" badge and "Demo placeholder image" label on the storefront. Remove them with `npm run seed:demo -- --remove`. Editing the business info from the admin dashboard arrives with the Store settings milestone.

### SEO and performance notes

Each page sets its own `<title>` and description (React 19 head tags), and real products emit schema.org `Product` JSON-LD (not for demo products). This is a client-rendered app: Google and Bing run JavaScript and will see these tags, but crawlers that do not would need server-side rendering, which is outside this milestone. `robots.txt` blocks `/admin` and `/api`. There is no sitemap yet (it should list real products once the site goes live). Pages are code-split, images are lazy-loaded below the fold and sized with width/height, and the home route loads without the admin bundle.

## Customer accounts, cart, wishlist and banners (Milestone 4)

| Route | Page |
| --- | --- |
| `/account/register`, `/account/login` | Customer sign-up and sign-in |
| `/account` | Profile, change password, links to cart, wishlist and My bookings |
| `/cart` | Cart with quantities, availability warnings and a total of the displayed prices; **Book now** |
| `/wishlist` | Saved products with add-to-cart |

- **Accounts:** public sign-up creates **customers only**: the request body is strict, so a `role` field is rejected and the server always assigns the customer role. Admins still come only from `npm run create-admin`. Passwords follow the same policy as admins (10+ characters, mixed case, number, symbol), are hashed with bcrypt, and changing one signs out the user's other devices. Customers and admins use the same login endpoint and the same refresh cookie; a customer is refused by every `/api/v1/admin/*` route (403) and bounced from `/admin`. **Not built yet:** email verification and "forgot password" (there is no email service). One browser holds one session at a time, so signing in as admin replaces a customer session in that browser.
- **Cart:** guests' carts live in the browser (`localStorage`, product ids and quantities only) and are **priced by the server on every view** (`POST /api/v1/store/cart/quote`); signed-in carts are stored in MongoDB (`/api/v1/account/cart`). Signing in merges the guest cart into the account. Prices, names and availability always come from the catalogue: a client-supplied price is rejected, quantities are capped by stock (max 10 per product, 20 products), and unpublished or sold-out products are flagged instead of silently dropped. The cart does **not** reserve stock; stock is only reduced when orders exist.
- **Wishlist:** same pattern (guest list in the browser, account list in MongoDB, merged on sign-in). Products that are later unpublished disappear from it.
- **Banners:** **Admin > Homepage banners** manages title, subtitle, button label, link, picture (stored in GridFS like other images), an active switch, optional show-from/show-until dates and display order. The homepage shows active, in-schedule banners with a picture as a manual (no auto-advance) carousel. Links must be a site path (`/shop...`) or an `https://` URL; `javascript:`, `http:` and protocol-relative links are rejected.
- **Session hint:** the browser stores a harmless flag (`vr_session`) after sign-in and only then asks the server to restore a session, so anonymous visitors never trigger authentication requests.

## Product booking

No money is collected on the site and there is no payment gateway.

- **Book Now** (product page, or the cart) needs a signed-in customer; guests are sent to sign in and returned. The form collects name, mobile number and delivery address (pre-filled from the saved default address). Prices and names are always read from the database, never from the browser.
- A booking gets a unique ID (`VR-BK-YYMMDD-XXXXXX`), is saved with status **Pending** and the customer sees a confirmation with that ID. Booking from the cart removes those items from the cart.
- **Stock:** a booking can never ask for more than the stock available when it is made (duplicate lines are merged first), but **stock is not deducted on submission**. It is deducted only when an admin **confirms** the booking, in safe sequential steps: (1) the booking is claimed atomically (only one request can win, so a double click, two admins or a retry can never deduct twice); (2) each item is deducted with a guarded update that cannot go below zero; (3) the inventory history and the status change are written. If anything fails, the stock already taken is put back and the booking stays Pending. If an item has become short, nothing changes and the admin is told to restock or reject. Rejecting is only possible while no stock is held, so it cannot race with a confirmation. Every other status change is one atomic "only if currently X" update.
- **Duplicate submissions:** the same customer, the same items and the same 2-minute window share a unique key in the database, so a double click, a retry or a second tab creates ONE booking (the others receive it back). The booking form also locks itself while sending. Once a booking is rejected or confirmed, the same items can be booked again.
- **Statuses:** Pending > Confirmed > Processing > Completed, or Rejected (from Pending only; rejecting never touches stock).
- **Customers:** `/account/bookings` (My bookings with status, progress and history) and `/account/bookings/:id`. Every query is scoped to the signed-in user; another customer's booking is a 404.
- **Admin > Bookings:** unread bookings are highlighted with a **New** badge, counted in the sidebar and header, and listed in an alert on the dashboard (refreshed every 30 seconds). Opening a booking marks it read; it can also be marked read/unread, or all at once. Admin and staff can see the customer, mobile, email, products, quantities, address and date, and can confirm, reject, process and complete. Search by booking ID, name, mobile or email; filter by status, unread or customer.
- **Dashboard:** total, pending, confirmed, processing, completed and rejected bookings, unread alert, customers, published products, stock warnings and recent bookings. There are no revenue figures.

## Store management (Milestone 6)

- **Admin > Store settings** (admin only, stored in MongoDB): business name, tagline, logo, address, phone, email, hours and GSTIN (format only). The storefront header, footer and contact page read from it; nothing is pre-filled with invented details. Visitors get a public subset (no GSTIN) from `GET /api/v1/store/settings`. The earlier shipping, tax and invoice settings were removed with payments.
- **Customers:** search, status filter and pagination; profile with addresses, totals and recent orders; link to that customer's orders. Admins can deactivate/reactivate an account (this ends their sessions immediately); staff can view only. Passwords and tokens are never returned.

## Admin area

Dashboard, bookings and customers are visible to admin and staff; Store settings and customer deactivation are admin only. Sign in at `/admin/login` with the account created by `npm run create-admin`.

- **Security:** there is no public registration. Every `/api/v1/admin/*` route sits behind one guard (valid access token, then role `admin` or `staff`); deleting products/categories is admin-only. The role is always read from the database, never from the token or request. Access tokens last 15 minutes and live only in memory; the refresh token is an httpOnly cookie, rotated on every use, stored hashed, and reuse of an old one revokes all sessions. Accounts lock for 15 minutes after 5 failed logins.
- **Products:** create/edit, draft / published / archived, featured toggle, SKU (auto-generated `VR-XXXXXX` or your own), search, filters and pagination. Publishing requires at least one image. Prices are validated on the server (max 2 decimals, MRP >= price).
- **Specifications:** fully admin-defined groups and fields; nothing is predefined.
- **Images:** multi-upload with preview and progress, drag-and-drop (or arrow-button) reordering, primary image, confirmed delete (see Image storage above).
- **Categories and brands:** create/edit, active/inactive, category images, one level of nesting; categories in use cannot be deleted.
- **Inventory:** add / remove / set stock, low-stock alerts per product, full history with who and why.
- **Enquiries:** messages from the storefront, with new/read/resolved status.
- **Homepage banners:** see above.

## WhatsApp notifications (Meta WhatsApp Business Cloud API)

The website sends two kinds of WhatsApp message, using only the **official Meta WhatsApp Business Cloud API** (no unofficial libraries, WhatsApp Web or browser automation):

1. **To the business** (the number you put in `WHATSAPP_ADMIN_NUMBER` in `server/.env`; no number is pre-filled) when a customer submits a booking.
2. **To the customer's mobile number** when an admin sets a booking to Confirmed, Rejected, Processing or Completed.

Behaviour you can rely on:
- **No credentials, no messages.** Until `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set, nothing is ever sent and no network call is made; each message is saved as "Not sent (WhatsApp not set up)" and can be retried later. Tests can never send real messages.
- **A WhatsApp problem never affects a booking.** Messages are sent in the background after the booking or status change is saved. Failures (wrong token, network, Meta error, invalid number) are stored with a sanitised error and shown in **Admin > WhatsApp messages** and on each booking page, with a **Retry** button. The dashboard shows a count of failed messages.
- **No duplicates.** There is one message per booking for the alert and one per booking and status for customer updates (a unique key in the database), and a message that was already sent can never be sent again, even by double-clicking Retry.
- **Indian numbers.** `9876543210`, `+91 98765 43210`, `919876543210`, `09876543210` and `0091 98765 43210` are all converted to `919876543210`. Anything that is not a 10-digit mobile number starting 6-9 is recorded as failed ("not a valid Indian mobile number") without calling WhatsApp.
- **Secrets.** The access token exists only in server environment variables. It is never sent to the browser, never stored in the database and is removed from any error text before it is saved or logged. The screens show recipient numbers masked (`+91 ••••• 43210`).

### What you need to set up in Meta (owner actions)

WhatsApp only lets a business START a conversation with a pre-approved **message template**, so the setup has four parts. Nothing below has been done for you and no credentials are included.

1. **Meta developer app and WhatsApp Business Account.** Create a Meta Business portfolio (business.facebook.com), then at developers.facebook.com create an app of type **Business** and add the **WhatsApp** product. Complete business verification when Meta asks for it (needed before you can send to the public at volume).
2. **Sending phone number.** Add and verify the phone number the messages will come FROM. While testing you can use the free test number Meta gives you (you must add each recipient to its allowed list and verify them). **Important:** a number cannot message itself, so the sending number and the business alert number (`WHATSAPP_ADMIN_NUMBER`) must be different numbers, and a number already registered in the normal WhatsApp or WhatsApp Business app has to be removed from it (or migrated) before it can be used with the Cloud API. Write down the **Phone number ID** shown on API Setup (this is not the phone number).
3. **Permanent access token.** The token on the API Setup page expires in 24 hours (testing only). For real use create a **System User** in Business Settings > Users > System users, assign it your WhatsApp account and the app with full control, and generate a token with the permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Treat it like a password.
4. **Two approved templates** (WhatsApp Manager > Message templates > Create; category **Utility**; language **English**; the names must match `WHATSAPP_TEMPLATE_ADMIN` and `WHATSAPP_TEMPLATE_CUSTOMER`). The variables must be in exactly this order, because the server fills them by position. Approval usually takes minutes to a few hours.

   **`vr_new_booking_alert`** (to the business), body:

   ```
   New booking alert from {{1}}: booking {{2}} was submitted by {{3}} (mobile {{4}}) for {{5}}. Please review it in the admin panel. Business contact: {{6}}.
   ```

   Variables: 1 business name, 2 booking ID, 3 customer name, 4 customer mobile, 5 product and quantity, 6 business contact number. Sample values for the form: VR Enterprises, VR-BK-261103-ABC234, Asha Rao, 9876543210, Aqua Pearl Copper RO Water Purifier x 2, 9876543210.

   **`vr_booking_status_update`** (to the customer), body:

   ```
   Update from {{1}}: Hello {{2}}, your booking {{3}} for {{4}} is now {{5}}. For any questions please call {{6}}.
   ```

   Variables: 1 business name, 2 customer name, 3 booking ID, 4 product and quantity, 5 status (Confirmed, Rejected, Processing or Completed), 6 business contact number. Sample values: VR Enterprises, Asha Rao, VR-BK-261103-ABC234, Aqua Pearl Copper RO Water Purifier x 2, Confirmed, 9876543210.

   If Meta asks you to change the wording, keep the variables and their order, or change the order in `server/src/services/notification.service.js` (the two template functions at the top).

Then set these in `server/.env` locally (and in the Render dashboard for production), restart the API, make a test booking and look at Admin > WhatsApp messages:

| Variable | Meaning |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | The permanent System User token (secret). |
| `WHATSAPP_PHONE_NUMBER_ID` | The Phone number ID of the sending number. |
| `WHATSAPP_ADMIN_NUMBER` | **You add this**: the business number that receives new-booking alerts, for example `9XXXXXXXXX` (Indian mobile, with or without +91). Empty by default. |
| `WHATSAPP_TEMPLATE_ADMIN` / `WHATSAPP_TEMPLATE_CUSTOMER` | The approved template names (defaults above). |
| `WHATSAPP_TEMPLATE_LANGUAGE` | The template language code (default `en`; use the code you chose, for example `en_US`). |
| `WHATSAPP_API_VERSION` | Graph API version (default `v21.0`). |
| `WHATSAPP_BUSINESS_CONTACT` | Optional. Contact number printed in messages when Admin > Store settings has no phone number (that number is used first). |

If the Meta messages fail, the reason appears next to the message in the admin panel (for example an unapproved template, a recipient who is not on the test list, or an expired token). Fix it and press Retry.

## Brand, content and product data

- **Logo and favicon:** an original VR monogram: a water drop whose centre is one continuous "VR" ligature (the V's right arm is also the R's stem), in aqua with a charcoal and copper wordmark. SVG files are in `client/public/brand/` (`logo.svg` for light backgrounds, `logo-light.svg` for dark ones, `logo-mark.svg` the drop alone, plus transparent `logo.png` and `logo-mark.png`); `client/public/favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` are the favicon set. The wordmark text is converted to outlines (Poppins, SIL Open Font License) so it looks identical everywhere. A logo uploaded in Admin > Store settings takes over from it.
- **Design system:** editorial and product-first. Warm white pages, charcoal type, water-aqua as the brand colour and copper as the accent (the purifiers use copper), Bricolage Grotesque for headlines and Inter for text. Colours, fonts and motion are all defined in `client/src/index.css` (`@theme` tokens), so the storefront and the admin change together. Motion is scroll-triggered and cheap (opacity, transform and clip-path only): headline lines slide up out of a mask, pictures are uncovered while they settle, sections fade and lift, product tiles zoom on hover, links draw their underline, and pages fade in on navigation. It is switched off automatically for visitors who ask their device for reduced motion (`prefers-reduced-motion`) and for browsers without IntersectionObserver.
- **Homepage banner:** it is the existing admin-managed banner (Admin > Homepage banners), so the headline, text, button and picture can all be changed without code. The artwork source is `client/public/brand/banner.svg` and the uploaded picture is `server/seed/banner/vr-banner.jpg`.
- **Business details:** phone, email and address are entered in Admin > Store settings (and used as defaults in `client/src/config/business.js`). Opening hours and GSTIN were not supplied, so they are not shown until entered.
- **Products:** `npm run seed:vr` (re-runnable; it only fills in what is still empty and never overwrites what you edited) loads the business details, the "Water Purifiers" category, the five purifier products with their photos, and the banner. Descriptions, specifications and features use only facts from the supplied product titles.
- **TEMPORARY PRICES AND STOCK: the business owner must verify every one.** The owner asked for the products to go in before final figures were known, so these starting values are placeholders chosen only as plausible figures, not quotes. Change them in Admin > Products (price) and Inventory (stock); no code change is needed:

  | Product | Temporary price (INR) | Temporary stock |
  | --- | --- | --- |
  | Aqua Pearl Copper RO Water Purifier | 7,999 | 5 |
  | G+ Series 3+ Copper Triple Layer Protection Water Purifier | 11,499 | 5 |
  | G+ Series Copper Rich Digital Display Water Purifier | 9,499 | 5 |
  | G Series RO + UV Water Purifier | 8,499 | 5 |
  | G+ Series DigiPro RO UV UF Water Purifier | 10,999 | 5 |

  **Four more products from supplied photos (published with TEMPORARY values, wording limited to what is printed on the units):**

  | Product | Temporary price (INR) | Temporary stock |
  | --- | --- | --- |
  | AQUA Water Purifier (RO+UV+UF) | 6,499 | 5 |
  | Sapphire Vogue Signature PRO Series Water Purifier | 11,999 | 5 |
  | Pearl Copper Water Purifier (RO+UV+UF+TDS Control) | 8,499 | 5 |
  | Purosis Elite Water Purifier (RO+UV+UF+TDS) | 12,499 | 5 |

  No manufacturer page or specification sheet was found for these four (see `server/seed/products-pending/RESEARCH.md`), so every detail other than the printed labels reads "Not verified". Their photos are the original supplied files, unmodified. Added with `node scripts/add-pending-products.js` then `node scripts/publish-pending-products.js` (both re-runnable, never overwriting what you edit). Replace the "Not verified" lines in Admin > Products when you have real details.

  The opening stock entries in the Inventory history are labelled "TEMPORARY opening stock (5 units): the owner must verify and correct this". No MRP or discount was set.
- **Photos:** `server/seed/products/` holds the three confirmed photos (Aqua Pearl, G Series, G+ DigiPlus), each cropped around the purifier. The two products without a confirmed photo (G+ Series 3+ Triple Layer, G+ Series Copper Rich) use a neutral "Product photo coming soon" placeholder (`server/seed/placeholders/`, alt text says it is a placeholder). Replace it in Admin > Products > Images. Photos B (Pearl Copper), E (Vogue Signature) and F (Purosis) are NOT used on any product and wait in `server/seed/images-to-confirm/`.
- Products with no price (price 0) cannot be added to a cart, booked or published.
- **Price of 0** means "not entered yet": it is shown as "Price on request" and booking totals read "To be confirmed".

## Deployment (Vercel + Render + MongoDB Atlas)

Nothing here is deployed for you; these are the steps for the owner. Never commit `.env` files (they are git-ignored) and never paste secrets into chat or code.

1. **Atlas:** create a free cluster, a database user, and under Network Access allow Render (or `0.0.0.0/0` for the free tier). Copy the connection string, with a database name: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/vr_enterprises?retryWrites=true&w=majority`.
2. **Render (API):** New > Blueprint, pick this repository (it reads `render.yaml`), then fill in the two values it asks for: `MONGODB_URI` and `CLIENT_URL` (your Vercel address, for example `https://vr-enterprises.vercel.app`). The JWT secrets are generated by Render. Check `https://<service>.onrender.com/api/v1/health/ready`. The free plan sleeps when idle, so the first request after a pause is slow.
3. **Vercel (website):** import the repository and set **Root Directory** to `client`. Vercel reads `vercel.json` only from the Root Directory, so the file that counts is **`client/vercel.json`** (build output `dist`); `vercel.json` at the repository root is for a project whose Root Directory is the repository root (output `client/dist`). Both forward `/api` to the Render service (`https://vr-enterprises.onrender.com`; change that address if your service has another name) and send every other path to the single-page app. **Symptom if the file is not picked up:** `/api/...` and even pages such as `/shop` or `/admin/login` return Vercel's own `NOT_FOUND` while `/` works. Leave `VITE_API_BASE_URL` unset. Also set `CLIENT_URL` on Render to your Vercel address (for example `https://vr-enterprises-zeta.vercel.app`).
4. **First admin:** in the Render service shell, or locally with the Atlas string in `server/.env`, run `npm run create-admin` and choose your own strong password. Sign in at `/admin/login`.
5. **Business information:** fill in Admin > Store settings, the policy pages (`client/src/content/pages.js`), and set `isPreview: false` in `client/src/config/business.js` when the placeholders and demo products are replaced (this removes the preview banner and the noindex tag).

Production settings already in place: Helmet security headers, CORS limited to `CLIENT_URL`, httpOnly rotating refresh cookies (`Secure` in production), rate limits on the API, login, registration and enquiries, no stack traces in error responses, and `TRUST_PROXY_HOPS` (set to 2 in `render.yaml` because both Vercel and Render are proxies). If you would rather call the API directly from the browser on another domain, set `VITE_API_BASE_URL` on Vercel, `COOKIE_SAME_SITE=none` on Render and `TRUST_PROXY_HOPS=1`; some browsers block such third-party cookies, which is why the rewrite is recommended.

## Roadmap

| Milestone | Scope                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| 1         | Foundation (done)                                                                                             |
| 2         | Admin core: auth and roles, products, images, categories, brands, specifications, inventory, **featured products** (done) |
| 3         | Customer-facing storefront (done)                                                                              |
| 4         | Customer accounts, cart, wishlist, **homepage banners** (done)                                                 |
| 5-6       | Checkout and store management (built, then payments removed in favour of product booking) |
| 7-8       | Polish, security review, deployment                                                                           |

The admin shell is already fully responsive (fixed sidebar on desktop, off-canvas drawer on mobile); each later module must keep that.

## Security notes

- Secrets are only read on the server from environment variables; `.env` files are git-ignored.
- Helmet headers, strict CORS allow-list, request size limits, NoSQL-operator sanitising, API rate limiting (login is stricter), and error responses that never leak stack traces in production.
- Passwords are hashed with bcrypt (cost 12) and never returned by the API (`select: false` plus `toJSON` stripping).
- Uploads are never written to disk, are size- and type-checked on the server, decoded and re-encoded (which also strips EXIF/GPS data and defuses polyglot files).
