/**
 * Default demo loans (folder scroll overflow) when the user has not imported JSON.
 * Loaded via <script> before data-manager.js — works with file:// and HTTP (no fetch).
 * Defines global: DEFAULT_EXAMPLE_DATA
 */
var DEFAULT_EXAMPLE_DATA = {
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
