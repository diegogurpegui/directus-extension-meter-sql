# DG Meter SQL

Insights meter for Directus. It matches the built-in Meter panel, and fills the dial from a SQL query instead of a collection aggregate.

The value is the **first column of the first row**. The dial shows that value as a percentage of **Maximum**.

## Requirements

- Directus 10.10.0 or higher

## Installation

From this extension directory:

```bash
npm install
npm run build
npm run link
```

Or copy this folder into your Directus `extensions` directory after building, then restart Directus.

This bundle includes a panel and a SQL endpoint. The endpoint runs with database access, so self-hosted Marketplace installs may need `MARKETPLACE_TRUST=all`.

## Usage

1. Open an Insights dashboard.
2. Add a panel and choose **DG Meter SQL**.
3. Enter a `SELECT` that returns one number.

```sql
SELECT COUNT(*) FROM orders
```

```sql
SELECT SUM(total) FROM orders WHERE status = 'paid'
```

Add `LIMIT 1` when the query can return more than one row. Only the first row is used.

## Options

Same display options as the built-in Meter:

- **Maximum** — value that fills the dial (100%). Default `100`.
- **Size** — full or half circle.
- **Stroke width** — thin, medium, or broad.
- **Color** — dial color.
- **Rounded stroke** — round line caps.
- **Show percentage** — center label, one decimal.
- **Conditional styles** — recolor the dial from the displayed percentage (`>=`, `>`, `<=`, `<`, `=`, `!=`).

The dashboard refresh interval reloads the query.

## Security

- Only a single `SELECT` or `WITH` … `SELECT` statement is allowed.
- Stacked statements and write keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, and similar) are rejected.
- `INTO OUTFILE` / `INTO DUMPFILE` are rejected.

Anyone who can open the dashboard can run the panel query. Keep queries read-only and limited to data those users may see.

## Development

```bash
npm run build
npm run dev
npm run validate
```
