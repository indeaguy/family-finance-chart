# Family Finance Chart

A simple web application to visualize financial growth over time, including compound interest, savings, and loan calculations.

## Features

- **Compound Interest Calculation**: See how your savings grow with compound interest
- **Monthly Savings**: Add regular monthly contributions
- **Loan Management**: Add multiple loans with different terms and rates
- **Interactive Charts**: Powered by TradingView's Lightweight Charts library
- **Real-time Updates**: Charts update automatically as you change inputs
- **Financial Summary**: Key metrics displayed in easy-to-read cards

## How to Use

1. Open `index.html` in your web browser
2. Adjust the savings and interest parameters:
   - Initial Amount: Your starting savings
   - Monthly Savings: How much you save each month
   - Annual Interest Rate: Expected return on your savings
   - Time Period: How many years to project

3. Add loans by filling out the loan form:
   - Loan Amount: Total amount borrowed
   - Loan Interest Rate: Annual interest rate for the loan
   - Loan Term: How many years to pay off the loan
   - Start Month: When the loan payments begin

4. The chart will show three lines:
   - **Green**: Total Savings (with compound growth)
   - **Blue**: Net Worth (savings minus loan balances)
   - **Red**: Total Loan Balance (decreases as you pay off loans)

## Chart Features

- Zoom and pan to explore different time periods
- Hover over lines to see exact values
- Responsive design works on desktop and mobile

## Technical Details

- Uses TradingView's Lightweight Charts library for professional-grade charting
- Pure HTML/CSS/JavaScript - no build process required
- Calculations include compound interest and amortization schedules
- Real-time updates with input debouncing for smooth performance

## Getting Started

Simply open `index.html` in any modern web browser. No server or installation required!
