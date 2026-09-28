# SML Inventory ERP

**Step Media Ltd — Firebase-backed inventory management system**

The active application is served from `index.html`. It uses Firebase Authentication and Firestore.

## Firestore structure

- `erp/main` — inventory master, settings, suppliers, sequences and item metadata
- `erp_txns/{id}` — stock movement records
- `erp_audit/{id}` — audit records
- `roles/{email}` — ERP access mapping

## Access levels

| Access | Stock operations | Item / Supplier management | Users / Settings |
|---|---|---|---|
| Super Admin | Full | Full | Full |
| Admin | Stock In / Out / Return / Adjustment | Full | No |
| Store | Stock In / Out / Return | View | No |
| Viewer | View only | View | No |

## Main features

- Item master with Category, Type, Color, Thickness, Page, Unit and Alarm Qty
- Stock In / Stock Out with date and reference information
- Stock Return register
- Stock Adjustment without deleting history
- Supplier master
- Date-range transaction history
- Reports: transactions, item-wise, category-wise, type-wise, ledger, supplier and low stock
- Excel export and bulk Stock In import
- Audit Trail
- JSON backup and restore
- Responsive layout and keyboard shortcuts

## Bulk Stock In

Use **Stock In → Import Template**. For an existing item, enter its **Item SL**. For a new item, leave Item SL blank and provide the item details; the ERP assigns the next available SL.

The importer validates quantities, dates, item references, duplicate new items and suppliers before committing the upload.

## Firebase setup

Enable **Authentication → Email/Password** and create the first login. Create Firestore and publish the repository `firestore.rules`. The Super Admin email is defined by `SUPER_ADMIN_EMAIL` in the active app and protected again in Firestore rules.

## Legacy files

The repository also contains `app.js`, `style.css`, `dashboard.html`, `firebase-config.js` and `items-seed.json`. The current ERP page does not load the first, second, fourth or fifth legacy files; `dashboard.html` redirects to `index.html#stockin`. They are retained for reference/backward compatibility and are not the active data path.

## Data integrity notes

Stock movements use Firestore transactions, so the server-side transaction re-reads current stock before committing. Historical reports load transactions through the current date when needed to calculate opening stock for older periods, while displayed report rows still respect the selected end date.

The Firestore rules do not allow ordinary users to delete the canonical `erp/main` document.
