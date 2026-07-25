# Family Finance Chart

A simple web application to visualize financial growth over time, including compound interest, savings, and loan calculations.

## Features

- **Compound Interest Calculation**: See how your savings grow with compound interest
- **Monthly Savings**: Add regular monthly contributions
- **Loan Management**: Add multiple loans with different terms and rates
- **Interactive Charts**: Powered by TradingView's Lightweight Charts library
- **Real-time Updates**: Charts update automatically as you change inputs
- **Financial Summary**: Key metrics displayed in easy-to-read cards
- **Goal Setting**: Set financial goals with visual indicators
- **JSON Import/Export**: Save and load financial scenarios

## How to Use

### Basic Usage
1. Open `index.html` in your web browser
2. Adjust the savings and interest parameters:
   - Initial Amount: Your starting savings
   - Monthly Savings: How much you save each month
   - Annual Interest Rate: Expected return on your savings
   - Time Period: How many years to project
   - Goal Amount: Optional target amount (chart stops when reached)

3. Open the drawer and use the **Loans** folder (manila):
   - Click the rolling pencil **Add Loan** button at the bottom of the folder to open the loose-leaf form
   - Active loans fill the sheet as ruled rows — click a row for details / Remove
   - Scroll over the folder to raise the loose-leaf when loan rows are clipped
   - Switch to the green **Savings** folder tab (sheet content coming later)

4. The chart will show multiple lines:
   - **Green**: Total Savings (with compound growth)
   - **Blue**: Net Worth (savings minus loan balances)
   - **Red**: Total Loan Balance (decreases as you pay off loans)
   - **Orange Dashed**: Goal line (if goal amount is set)

### JSON Import/Export

#### Save Your Configuration
- Click **📤 Export to JSON** to download your current setup
- File saves as `family-finance-YYYY-MM-DD.json`

#### Load a Configuration
- Click **📥 Import JSON** to select and load a saved file
- All settings and loans will be restored

#### Try the Example
- Load `example.json` to see a sample financial scenario with:
  - $25,000 initial savings
  - $1,200 monthly savings
  - 8.5% annual interest rate
  - $1,000,000 goal
  - Three loans: mortgage, car loan (with extra payments), and credit card

## Chart Features

- **Interactive Hover**: Move cursor over chart lines to see values at specific points in time
- **Goal Visualization**: Horizontal goal line with achievement marker
- **Time Formatting**: Displays time in "X years, Y months" format
- **Zoom and pan** to explore different time periods
- **Responsive design** works on desktop and mobile

## Technical Details

- Uses TradingView's Lightweight Charts library for professional-grade charting
- Pure HTML/CSS/JavaScript — no build process required; open `index.html` directly
- Styles split by concern under `css/`: `base.css`, `drawer.css`, `folder.css`, `overlays.css`
- Scripts under `js/`: UI helpers (`format.js`, `folder-sheet.js`, `drawer.js`, `summary-overlay.js`) plus core modules (`calculator.js`, `chart-manager.js`, `field-model.js`, `data-manager.js`, `ui-manager.js`, `override-manager.js`, `app.js`)
- Calculations include compound interest and loan amortization schedules
- Real-time updates with input debouncing for smooth performance
- JSON-based configuration system for saving/loading scenarios
- See `AGENTS.md` for the file map, load order, and DOM ownership (useful when editing)

## Getting Started

Simply open `index.html` in any modern web browser. No server or installation required!

Try importing `example.json` to see a realistic financial scenario in action.

## Tests

```bash
npm install
npm test              # unit + UI suites
npm run test:unit     # field-model / LOAN_FIELDS / remaining balance (no Chrome)
npm run test:ui       # loose-leaf row alignment (needs Chrome)
```

- **Unit** (`tests/field-model.mjs`): field-schema helpers, loan surface/order, JSON serialize/hydrate, `remainingBalanceAsOf`.
- **UI** (`tests/loose-leaf-alignment.mjs`): every Loans loose-leaf `.sheet-ruled-row` sits on the `--leaf-line` grid (prevents table-row height drift). Set `CHROME_PATH` if Chrome is not at the macOS default location.

See `AGENTS.md` → **Tests** for when to run which suite after a change.
