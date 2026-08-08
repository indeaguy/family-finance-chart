# Historical balance import examples

Sample files for **Import history** on an account card (Edit) or in the Date Overrides modal.

Organized by format; each folder has a **savings** and a **loan** example spanning **2020 through 2025** so the chart rewinds to include that history on import.

## How import works

1. Pick a loan or savings account → **Edit** → **Import history** (or open **Date overrides** → **Import history…**).
2. Choose a `.csv`, `.ofx` / `.qfx`, or `.qif` file from the folders below.
3. Every dated balance observation is kept; for each calendar month the **last available date** in that month becomes `balanceOverrides[YYYY-MM]`.
4. Import **merges**: months in the file overwrite existing date overrides; other months stay.
5. If the earliest imported month is before the chart start, the projection **start date rewinds** (and the time span grows) so those months appear on the chart. The account’s start is aligned to the earliest imported month when needed.

Balances are stored as non-negative amounts (absolute value).

## Where these formats come from

| Format | Typical sources |
|--------|-----------------|
| **CSV** | Bank/credit-union “export,” spreadsheet save-as, budgeting apps. Use any file with a date column and a balance column (see CSV tips below). |
| **OFX / QFX** | **Open Financial Exchange** — what many US banks and brokerages offer as “Download transactions,” “Export for Quicken/Microsoft Money,” or **Web Connect**. **`.ofx`** is the open form; **`.qfx`** is Intuit’s Quicken-branded OFX (same structure for our purposes). Also common from investment sites when you pick Quicken/OFX download. |
| **QIF** | **Quicken Interchange Format** — older Quicken/QuickBooks-style export (`!Type:Bank`, `D`/`T`/`P` records). Still produced by classic Quicken “Export,” some banks’ legacy “Quicken (QIF)” download, and apps such as GnuCash / other personal-finance tools that speak QIF. Best when the file has an **Opening Balance** plus transactions so we can rebuild a running balance. |

Bank portals often bury these under **Statements → Download / Export**, **Account services → Download transactions**, or a Quicken/Money logo. Prefer a date range that covers the history you want; a single “current balance” OFX snapshot only fills one month.

## Layout

| Path | Format | Account |
|------|--------|---------|
| [`csv/savings-balances.csv`](csv/savings-balances.csv) | CSV | Growing savings; mid-month + month-end rows |
| [`csv/loan-balances.csv`](csv/loan-balances.csv) | CSV | Declining loan principal |
| [`ofx/savings-ledger.ofx`](ofx/savings-ledger.ofx) | OFX | Quarterly `LEDGERBAL` / `BAL` / `AVAILBAL` snapshots |
| [`ofx/loan-ledger.ofx`](ofx/loan-ledger.ofx) | OFX | Quarterly declining balance snapshots |
| [`qif/savings-running.qif`](qif/savings-running.qif) | QIF | Opening balance + monthly contribution/fee → running balance |
| [`qif/loan-running.qif`](qif/loan-running.qif) | QIF | Opening principal + monthly payments → running balance |

## CSV tips

Recognized date headers include `Date`, `As Of`, `Balance Date`. Balance headers include `Balance`, `Ending Balance`, `Ledger Balance`, `Current Balance`.

Headerless files work as `date,balance` per row. Currency symbols and commas are stripped.
