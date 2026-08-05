/**
 * LightweightCharts setup: series (savings, net worth, loans, goal), markers, hover, resize.
 * Defines globals: ChartManager, INDIVIDUAL_LOAN_LINES, INDIVIDUAL_SAVINGS_LINES
 * Depends on: window.LightweightCharts; format.js (formatCurrency); summary-overlay.js
 *   (window.showChartHover on crosshair); DOM: #chart container (passed into createChart).
 * Hover right-axis labels are DOM (title + amount + interest) with collision stacking —
 * LC native axis pills cannot do adjacent interest or shared stacking with custom badges.
 */

/** Per-loan balance line styling — edit here (not exposed in UI). */
const INDIVIDUAL_LOAN_LINES = {
    enabled: true,
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dotted,
    showLegendTitle: true,
    priceLineVisible: false,
    lastValueVisible: false
};

/** Per-savings-account line styling — edit here (not exposed in UI). */
const INDIVIDUAL_SAVINGS_LINES = {
    enabled: true,
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dotted,
    showLegendTitle: true,
    priceLineVisible: false,
    lastValueVisible: false
};

/** Hide static right-axis labels; hover labels are driven from crosshair move. */
const SERIES_AXIS_LABEL_OPTS = {
    lastValueVisible: false,
    priceLineVisible: false,
    title: ''
};

class ChartManager {
    constructor() {
        this.chartSeries = {
            savings: null,
            netWorth: null,
            netWorthOriginal: null,
            loanBalance: null,
            individualLoans: [],
            individualSavings: [],
            goalLine: null
        };

        this.individualLoanColors = [
            '#ef9a9a', '#e57373', '#ef5350', '#ff7043', '#ff8a65',
            '#ffab91', '#f48fb1', '#ec407a', '#ce93d8', '#ab47bc',
            '#b39ddb', '#9575cd', '#7986cb', '#64b5f6', '#4dd0e1',
            '#80cbc4', '#a5d6a7', '#c5e1a5', '#fff59d', '#ffcc80'
        ];

        this.individualSavingsColors = [
            '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b',
            '#66bb6a', '#81c784', '#a5d6a7', '#9ccc65', '#c5e1a5',
            '#4dd0e1', '#26c6da', '#00acc1', '#4fc3f7', '#29b6f6',
            '#7e57c2', '#9575cd', '#b39ddb', '#7986cb', '#64b5f6'
        ];

        /** @type {Map<object, string>} series API -> label shown on hover only */
        this.seriesDisplayNames = new Map();

        /**
         * Per-series interest at a timestamp for hover axis companions.
         * @type {Map<object, Map<number, number>>}
         */
        this.seriesInterestByTime = new Map();

        /** @type {HTMLElement|null} host for stacked right-axis hover labels */
        this.axisLabelLayer = null;

        /** @type {HTMLElement|null} chart container (#chart) */
        this.chartContainer = null;

        /** @type {object|null} LightweightCharts chart instance */
        this.chart = null;
    }
    
    createChart(container) {
        if (!window.LightweightCharts) {
            console.error('LightweightCharts library not loaded');
            return null;
        }

        this.chartContainer = container;
        
        // Calculate proper height
        const calculateHeight = () => {
            const containerHeight = container.clientHeight;
            const windowHeight = window.innerHeight;
            
            // If container has height, use it; otherwise calculate based on window
            if (containerHeight > 100) {
                return containerHeight;
            } else {
                // Use most of the window height, accounting for margins and other elements
                return Math.max(windowHeight - 150, 400);
            }
        };
        
        const chart = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: calculateHeight(),
            layout: {
                backgroundColor: '#ffffff',
                textColor: '#333333',
            },
            grid: {
                vertLines: {
                    color: '#f0f0f0',
                },
                horzLines: {
                    color: '#f0f0f0',
                },
            },
            rightPriceScale: {
                borderColor: '#cccccc',
                autoScale: true,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1
                },
            },
            timeScale: {
                borderColor: '#cccccc',
                timeVisible: true,
                secondsVisible: false,
                fixLeftEdge: false,
                fixRightEdge: false,
                rightOffset: 10,
                leftOffset: 10,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                horzLine: {
                    labelVisible: false,
                },
            },
        });

        this.chart = chart;
        // After LC mounts — it owns #chart children; layer must be a sibling overlay host.
        this.ensureAxisLabelLayer(container);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            chart.applyOptions({ 
                width: container.clientWidth,
                height: calculateHeight()
            });
        });
        
        // Add hover functionality
        this.setupChartHover(chart);
        
        return chart;
    }

    ensureAxisLabelLayer(container) {
        if (this.axisLabelLayer && this.axisLabelLayer.isConnected) {
            return;
        }
        const layer = document.createElement('div');
        layer.className = 'chart-hover-axis-labels';
        layer.setAttribute('aria-hidden', 'true');
        container.appendChild(layer);
        this.axisLabelLayer = layer;
    }
    
    setupChartHover(chart) {
        chart.subscribeCrosshairMove(param => {
            if (!param.time || !window.app || !window.app.uiManager) {
                this.clearAxisLabels();
                return;
            }

            const chartData = window.app.uiManager.currentChartData;
            if (!chartData || chartData.length === 0) {
                this.clearAxisLabels();
                return;
            }

            const dataPoint = chartData.find(d => d.timestamp === param.time);
            if (dataPoint && window.showChartHover) {
                window.showChartHover(param, dataPoint);
            }
            this.updateHoverAxisLabels(param, dataPoint);
        });
    }

    getTrackedSeries() {
        const series = [];
        if (this.chartSeries.savings) series.push(this.chartSeries.savings);
        if (this.chartSeries.netWorth) series.push(this.chartSeries.netWorth);
        if (this.chartSeries.netWorthOriginal) series.push(this.chartSeries.netWorthOriginal);
        if (this.chartSeries.loanBalance) series.push(this.chartSeries.loanBalance);
        if (this.chartSeries.goalLine) series.push(this.chartSeries.goalLine);
        series.push(...this.chartSeries.individualSavings);
        series.push(...this.chartSeries.individualLoans);
        return series;
    }

    registerSeriesDisplayName(series, displayName) {
        if (series && displayName) {
            this.seriesDisplayNames.set(series, displayName);
        }
    }

    /**
     * Store per-timestamp interest for a series (LC strips custom fields from setData).
     * @param {string} [interestKey='interestPaid'] — use interestEarned for savings accounts
     */
    registerSeriesInterestByTime(series, points, interestKey = 'interestPaid') {
        if (!series || !points) return;
        const byTime = new Map();
        for (const point of points) {
            if (point.time == null || point[interestKey] == null) continue;
            if (!Number.isFinite(point[interestKey])) continue;
            byTime.set(point.time, point[interestKey]);
        }
        this.seriesInterestByTime.set(series, byTime);
    }

    clearAxisLabels() {
        if (this.axisLabelLayer) {
            this.axisLabelLayer.innerHTML = '';
        }
    }

    /**
     * Interest companion for a hover axis row.
     * Savings (total + per-account) → earned; loans / net worth / goal → paid.
     */
    resolveInterestForSeries(series, dataPoint, time) {
        if (!dataPoint) return null;

        if (series === this.chartSeries.savings) {
            return Number.isFinite(dataPoint.interestEarned)
                ? { value: dataPoint.interestEarned, tip: 'Interest earned' }
                : null;
        }

        const perSeries = this.seriesInterestByTime.get(series);
        if (perSeries && perSeries.has(time)) {
            const isSavingsAccount = this.chartSeries.individualSavings.includes(series);
            return {
                value: perSeries.get(time),
                tip: isSavingsAccount ? 'Interest earned' : 'Interest paid'
            };
        }

        if (
            series === this.chartSeries.loanBalance ||
            series === this.chartSeries.netWorth ||
            series === this.chartSeries.netWorthOriginal ||
            series === this.chartSeries.goalLine
        ) {
            return Number.isFinite(dataPoint.totalInterestPaid)
                ? { value: dataPoint.totalInterestPaid, tip: 'Interest paid' }
                : null;
        }

        return null;
    }

    /**
     * Build stacked right-axis hover rows: [title][amount][interest].
     * Nudges overlapping rows apart so labels don't collide (LC stacking stand-in).
     */
    updateHoverAxisLabels(param, dataPoint) {
        if (!this.axisLabelLayer || !this.chart || !param.seriesData) {
            this.clearAxisLabels();
            return;
        }

        const left = this.chart.timeScale().width();
        const labelHeight = 18;
        const rows = [];

        for (const series of this.getTrackedSeries()) {
            const data = param.seriesData.get(series);
            if (!data || data.value == null) continue;

            const y = series.priceToCoordinate(data.value);
            if (y == null || !Number.isFinite(y)) continue;

            const interest = this.resolveInterestForSeries(series, dataPoint, param.time);
            rows.push({
                y,
                color: series.options().color || '#888888',
                title: this.seriesDisplayNames.get(series) || '',
                amount: data.value,
                interest
            });
        }

        if (rows.length === 0) {
            this.clearAxisLabels();
            return;
        }

        // Stack top-to-bottom: keep order by price position, nudge when too close.
        rows.sort((a, b) => a.y - b.y);
        for (let i = 1; i < rows.length; i++) {
            const minY = rows[i - 1].y + labelHeight;
            if (rows[i].y < minY) {
                rows[i].y = minY;
            }
        }

        const layer = this.axisLabelLayer;
        layer.innerHTML = '';
        for (const row of rows) {
            const el = document.createElement('div');
            el.className = 'chart-hover-axis-pair';
            el.style.top = `${row.y}px`;
            el.style.left = `${left}px`;
            el.style.setProperty('--axis-color', row.color);

            if (row.title) {
                const titleEl = document.createElement('span');
                titleEl.className = 'chart-hover-axis-title';
                titleEl.textContent = row.title;
                el.appendChild(titleEl);
            }

            const amountEl = document.createElement('span');
            amountEl.className = 'chart-hover-axis-amount';
            amountEl.textContent = formatCurrency(row.amount);
            el.appendChild(amountEl);

            if (row.interest) {
                const interestEl = document.createElement('span');
                interestEl.className = 'chart-hover-axis-interest';
                interestEl.title = row.interest.tip;
                interestEl.textContent = formatCurrency(row.interest.value);
                el.appendChild(interestEl);
            }

            layer.appendChild(el);
        }
    }
    
    updateChart(chart, results) {
        if (!chart || !results) {
            console.error('Chart or results not provided');
            return;
        }
        
        try {
            // Clear existing series
            this.clearSeries(chart);
            
            // Add new series (individuals under totals so totals paint on top)
            this.addIndividualSavingsLines(chart, results);
            this.addSavingsLine(chart, results);
            this.addNetWorthLine(chart, results);
            this.addIndividualLoanLines(chart, results);
            this.addLoanBalanceLine(chart, results);
            this.addGoalLine(chart, results);
            this.addLoanPayoffMarkers(chart, results);
            
            // Apply chart styling with zoom-out padding
            this.applyChartStyling(chart, results);
            
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
    
    clearSeries(chart) {
        this.clearAxisLabels();
        this.seriesDisplayNames.clear();
        this.seriesInterestByTime.clear();

        Object.keys(this.chartSeries).forEach(key => {
            const entry = this.chartSeries[key];
            if (Array.isArray(entry)) {
                entry.forEach(series => {
                    if (series) chart.removeSeries(series);
                });
                this.chartSeries[key] = [];
            } else if (entry) {
                chart.removeSeries(entry);
                this.chartSeries[key] = null;
            }
        });
    }

    addIndividualLoanLines(chart, results) {
        const cfg = INDIVIDUAL_LOAN_LINES;
        if (!cfg.enabled || !results.individualLoanSeries || results.individualLoanSeries.length === 0) {
            return;
        }

        results.individualLoanSeries.forEach((series, index) => {
            if (!series.data || series.data.length === 0) return;

            const color = this.individualLoanColors[index % this.individualLoanColors.length];
            const lineSeries = chart.addLineSeries({
                color,
                lineWidth: cfg.lineWidth,
                lineStyle: cfg.lineStyle,
                title: '',
                priceLineVisible: cfg.priceLineVisible,
                lastValueVisible: cfg.lastValueVisible
            });
            if (cfg.showLegendTitle) {
                this.registerSeriesDisplayName(lineSeries, series.name);
            }
            this.registerSeriesInterestByTime(lineSeries, series.data, 'interestPaid');
            // LC only needs time/value; interestPaid is kept in seriesInterestByTime.
            lineSeries.setData(series.data.map((point) => ({
                time: point.time,
                value: point.value
            })));
            this.chartSeries.individualLoans.push(lineSeries);
        });
    }

    addIndividualSavingsLines(chart, results) {
        const cfg = INDIVIDUAL_SAVINGS_LINES;
        if (!cfg.enabled || !results.individualSavingsSeries || results.individualSavingsSeries.length === 0) {
            return;
        }

        results.individualSavingsSeries.forEach((series, index) => {
            if (!series.data || series.data.length === 0) return;

            const color = this.individualSavingsColors[index % this.individualSavingsColors.length];
            const lineSeries = chart.addLineSeries({
                color,
                lineWidth: cfg.lineWidth,
                lineStyle: cfg.lineStyle,
                title: '',
                priceLineVisible: cfg.priceLineVisible,
                lastValueVisible: cfg.lastValueVisible
            });
            if (cfg.showLegendTitle) {
                this.registerSeriesDisplayName(lineSeries, series.name);
            }
            this.registerSeriesInterestByTime(lineSeries, series.data, 'interestEarned');
            lineSeries.setData(series.data.map((point) => ({
                time: point.time,
                value: point.value
            })));
            this.chartSeries.individualSavings.push(lineSeries);
        });
    }
    
    addSavingsLine(chart, results) {
        if (!results.savingsData || results.savingsData.length === 0) {
            return;
        }
        this.chartSeries.savings = chart.addLineSeries({
            color: '#26a69a',
            lineWidth: 3,
            ...SERIES_AXIS_LABEL_OPTS
        });
        this.registerSeriesDisplayName(this.chartSeries.savings, 'Total Savings');
        this.chartSeries.savings.setData(results.savingsData);
    }
    
    addNetWorthLine(chart, results) {
        this.chartSeries.netWorth = chart.addLineSeries({
            color: '#2196f3',
            lineWidth: 3,
            ...SERIES_AXIS_LABEL_OPTS
        });
        this.registerSeriesDisplayName(
            this.chartSeries.netWorth,
            'Net Worth' + (results.hasOverrides ? ' (With Overrides)' : '')
        );
        this.chartSeries.netWorth.setData(results.netWorthData);
        
        // Add comparison line if there are overrides
        if (results.hasOverrides) {
            this.chartSeries.netWorthOriginal = chart.addLineSeries({
                color: '#2196f3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                ...SERIES_AXIS_LABEL_OPTS
            });
            this.registerSeriesDisplayName(this.chartSeries.netWorthOriginal, 'Original Net Worth (No Overrides)');
            this.chartSeries.netWorthOriginal.setData(results.netWorthOriginalData);
        }
    }
    
    addLoanBalanceLine(chart, results) {
        if (results.loanBalanceData.length > 0) {
            this.chartSeries.loanBalance = chart.addLineSeries({
                color: '#f44336',
                lineWidth: 2,
                ...SERIES_AXIS_LABEL_OPTS
            });
            this.registerSeriesDisplayName(this.chartSeries.loanBalance, 'Total Loan Balance');
            this.chartSeries.loanBalance.setData(results.loanBalanceData);
        }
    }
    
    addGoalLine(chart, results) {
        if (results.goalAmount > 0) {
            this.chartSeries.goalLine = chart.addLineSeries({
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                ...SERIES_AXIS_LABEL_OPTS
            });
            this.registerSeriesDisplayName(
                this.chartSeries.goalLine,
                `Goal: $${results.goalAmount.toLocaleString()}`
            );
            
            // Create horizontal line data for the goal
            const goalLineData = results.savingsData.map(point => ({
                time: point.time,
                value: results.goalAmount
            }));
            this.chartSeries.goalLine.setData(goalLineData);
            
            // Add goal reached marker if applicable
            if (results.goalReachedMonth) {
                const goalPoint = results.data.find(d => d.month === results.goalReachedMonth);
                if (goalPoint) {
                    this.chartSeries.netWorth.setMarkers([{
                        time: goalPoint.timestamp,
                        position: 'aboveBar',
                        color: '#f39c12',
                        shape: 'arrowUp',
                        text: `Goal Reached! ${this.formatTimeDisplay(results.goalReachedMonth)}`
                    }]);
                }
            }
        }
    }
    
    addLoanPayoffMarkers(chart, results) {
        if (results.loanPayoffMarkers && results.loanPayoffMarkers.length > 0 && this.chartSeries.loanBalance) {
            this.chartSeries.loanBalance.setMarkers(results.loanPayoffMarkers);
        }
    }
    
    applyChartStyling(chart, results) {
        // Apply chart styling with automatic zoom-out for breathing room
        
        chart.applyOptions({
            rightPriceScale: {
                autoScale: true,
                scaleMargins: {
                    top: 0.15,
                    bottom: 0.15
                }
            },
            timeScale: {
                rightOffset: 10,
                leftOffset: 10,
            }
        });
        
        // Simple fit content - visual padding handled by CSS
        chart.timeScale().fitContent();
    }
    
    formatTimeDisplay(months) {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        
        if (years === 0) {
            return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
        } else if (remainingMonths === 0) {
            return `${years} year${years !== 1 ? 's' : ''}`;
        } else {
            return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
        }
    }
}
