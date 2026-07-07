# Step Media — Board Stock System (v2, with Admin & Staff panels)

Login-protected board stock tracker. Two access levels:
- **Admin** — full control: add/edit/delete items, grant/remove staff access, stock in/out, view history.
- **Staff** — day-to-day use: stock in/out, view inventory and history. Cannot add/delete items or manage access.

Stock starts at **0 for all 154 items**. On **August 1**, sign in as Admin and use "Stock In" to
enter real opening quantities.

---

## Part 1 — GitHub account & repository

1. Go to https://github.com → Sign up (skip if you already have an account).
2. Click **+** (top right) → **New repository** → name it `board-stock` → set to **Public** → **Create repository**.

## Part 2 — Upload the files

1. Extract the zip file on your computer.
2. On your new repo's page, click **"uploading an existing file"**.
3. Drag in every file from the extracted folder: `index.html`, `dashboard.html`, `style.css`,
   `app.js`, `firebase-config.js`, `logo.png`, `items-seed.json`.
4. Scroll down → **Commit changes**.

## Part 3 — Turn on GitHub Pages

1. Repo → **Settings** → **Pages** (left menu).
2. Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → **Save**.
3. Wait ~1 minute, then your site is live at:
   `https://YOUR-GITHUB-USERNAME.github.io/board-stock/`

(A custom domain can be connected later — not required to start using the system.)

## Part 4 — Create your Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it `stepmedia-stock` → **Create project**.
2. Left menu → **Build → Authentication** → **Get started** → **Sign-in method** tab →
   enable **Email/Password**.
3. **Users** tab → **Add user** → create a login (email + password) for yourself first —
   this will be your **Admin** account.
4. Left menu → **Build → Firestore Database** → **Create database** → **Production mode** →
   pick a nearby region → **Enable**.

## Part 5 — Set Firestore security rules

Firestore → **Rules** tab → replace everything with this, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/roles/$(request.auth.token.email)) &&
        get(/databases/$(database)/documents/roles/$(request.auth.token.email)).data.role == 'admin';
    }
    match /roles/{email} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
    match /items/{itemId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }
    match /transactions/{txId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
    }
  }
}
```

This means: only signed-in people can use the system at all, and only Admins can change
who has Admin/Staff access.

## Part 6 — Make yourself the first Admin (one-time, manual)

The very first Admin has to be set by hand, directly in Firebase — after that, you can
manage everyone else from inside the website itself.

1. Firestore Database → **Data** tab → **Start collection**.
2. Collection ID: `roles` → **Next**.
3. Document ID: type your **own email exactly** (the one you created in Part 4, e.g. `you@example.com`).
4. Add a field: name `role`, type `string`, value `admin` → **Save**.

## Part 7 — Get your Firebase config keys

1. ⚙️ (gear icon, top left) → **Project settings**.
2. Scroll to "Your apps" → click **`</>`** (web icon) → give it a nickname → **Register app**.
3. Copy the whole `firebaseConfig = { ... }` object shown.
4. Open `firebase-config.js` (in your extracted folder) → paste your real values over the
   `PASTE_...` placeholders → save.
5. Back in your GitHub repo, open `firebase-config.js` → pencil (edit) icon → replace the
   content with your updated version → **Commit changes**.

## Part 8 — First login

1. Visit your GitHub Pages link → sign in with the Admin email/password from Part 4.
2. You'll see a badge reading **ADMIN**, plus two extra menu items: **Manage Items** and
   **Manage Access**.
3. Click **"Load item list"** on the Inventory page — loads all 154 items at 0 stock (one-time).

## Part 9 — Add your staff

For each staff member:
1. Firebase Console → Authentication → Users → **Add user** → their email + a password.
   Share these credentials with them directly.
2. In the website, sign in as Admin → **Manage Access** → enter their email → role **Staff** →
   **Save Access**.

They can now sign in and use Stock In / Stock Out and view Inventory & History, but won't see
Manage Items or Manage Access.

## Part 10 — Daily use

- **Stock In**: add received quantity for any item, with date.
- **Stock Out**: record quantity used, with date.
- Every entry is logged under **Usage History** with who did it and when.
- **Manage Items** (Admin only): add a brand-new board type, edit details, or delete one.
- Low stock (below 5, by default) is flagged in red. Change `LOW_STOCK_THRESHOLD` at the top
  of `app.js` to adjust.

---

## Custom domain (smlstore.online) — later

Your `smlstore.online` domain is currently locked for DNS changes because it was claimed
free through WordPress.com's Gravatar program (locked for the first year unless renewed).
Once you renew it or transfer it elsewhere, come back and we'll connect it — the GitHub Pages
link works exactly the same in the meantime.
