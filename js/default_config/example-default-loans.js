/**
 * Default demo loans + savings accounts when the user has not imported JSON.
 * Loaded via <script> before data-manager.js — works with file:// and HTTP (no fetch).
 * Defines global: DEFAULT_EXAMPLE_DATA
 *
 * Savings with an endMonth freeze at that month's balance but still count toward
 * Total Savings for the rest of the chart horizon (unless includeInTotal is false).
 */
var DEFAULT_EXAMPLE_DATA = {
    savings: {
        timePeriod: 20,
        goalAmount: 0,
        accounts: [
            { name: 'Emergency Fund', amount: 12000, monthlyContribution: 200, rate: 4.5, startMonth: 1, startDate: '', endDate: null, endMonth: null, includeInTotal: true },
            { name: '401(k)', amount: 48000, monthlyContribution: 900, rate: 7.2, startMonth: 1, startDate: '', endDate: null, endMonth: null, includeInTotal: true },
            { name: 'Brokerage', amount: 18500, monthlyContribution: 400, rate: 8.0, startMonth: 1, startDate: '', endDate: null, endMonth: null, includeInTotal: true },
            { name: 'Kids College', amount: 9500, monthlyContribution: 250, rate: 6.0, startMonth: 2, startDate: '', endDate: null, endMonth: null, includeInTotal: true },
            { name: 'House Down Payment', amount: 22000, monthlyContribution: 800, rate: 4.0, startMonth: 1, startDate: '', endDate: null, endMonth: 36, includeInTotal: true },
            { name: 'Vacation Fund', amount: 1800, monthlyContribution: 150, rate: 2.5, startMonth: 1, startDate: '', endDate: null, endMonth: 18, includeInTotal: false },
            { name: 'HSA', amount: 4200, monthlyContribution: 175, rate: 5.5, startMonth: 3, startDate: '', endDate: null, endMonth: null, includeInTotal: true },
            { name: 'Wedding Gift', amount: 3000, monthlyContribution: 100, rate: 3.0, startMonth: 4, startDate: '', endDate: null, endMonth: 24, includeInTotal: false }
        ]
    },
    loans: [
        { name: 'Mortgage', amount: 320000, rate: 6.5, term: 30, startMonth: 1, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Car Loan', amount: 28000, rate: 4.9, term: 5, startMonth: 1, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Store Card', amount: 8500, rate: 19.9, term: 4, startMonth: 3, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Personal Loan', amount: 15000, rate: 7.2, term: 6, startMonth: 2, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Family Loan', amount: 4200, rate: 0, term: 2, startMonth: 1, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Student Loan', amount: 12000, rate: 5.5, term: 3, startMonth: 4, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Home Equity', amount: 45000, rate: 3.9, term: 7, startMonth: 1, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Medical Bill', amount: 9500, rate: 11.5, term: 5, startMonth: 2, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Phone Plan', amount: 2200, rate: 0, term: 1, startMonth: 1, startDate: '', monthlyPayment: null, isCustomPayment: false },
        { name: 'Rental Property', amount: 185000, rate: 5.25, term: 15, startMonth: 6, startDate: '', monthlyPayment: null, isCustomPayment: false }
    ],
    version: '2.0'
};
