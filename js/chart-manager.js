/**
 * LightweightCharts setup: series (savings, net worth, loans, goal), markers, hover, resize.
 * Defines globals: ChartManager, INDIVIDUAL_LOAN_LINES, INDIVIDUAL_SAVINGS_LINES
 * Depends on: window.LightweightCharts; format.js (formatCurrency); summary-overlay.js
 *   (window.showChartHover on crosshair); DOM: #chart container (passed into createChart).
 * Hover right-axis labels are DOM (title + amount + interest) with collision stacking —
 * LC native axis pills cannot do adjacent interest or shared stacking with custom badges.
 * Near a line, that series and its axis row emphasize; others dim (see SERIES_HOVER_*).
 * While account cards are open, setAccountCardFocus dims non-card series
 * and Y-axis hover labels show only the focused entity lines.
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

/** Non-hovered series/labels fade to this alpha when the pointer is near a line. */
const SERIES_HOVER_DIM_ALPHA = 0.28;

/** Max vertical distance (px) from pointer to a line before hover emphasis applies. */
const SERIES_HOVER_HIT_PX = 16;

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

        /** @type {Map<object, { color: string, lineWidth: number, lineStyle: number }>} */
        this.seriesBaseStyles = new Map();

        /** @type {object|null} series currently emphasized on line hover */
        this.activeHoveredSeries = null;

        /** @type {object|null} series locked while a drawer list row is hovered */
        this.listHoveredSeries = null;

        /** @type {Map<number, object>} loan id → individual loan line series */
        this.seriesByLoanId = new Map();

        /** @type {Map<number, object>} savings id → individual savings line series */
        this.seriesBySavingsId = new Map();

        /** @type {Set<object>} series emphasized while an account card is open */
        this.accountCardFocusSeries = new Set();

        /** @type {number[]} loan ids with an open account card */
        this.accountCardFocusLoanIds = [];

        /** @type {number[]} savings ids with an open account card */
        this.accountCardFocusSavingsIds = [];

        /** @type {object|null} last crosshair move payload for hover refresh on account-card close */
        this.lastCrosshairParam = null;

        /** @type {object|null} chart data row at last crosshair time */
        this.lastCrosshairDataPoint = null;
    }

    isAccountCardFocusActive() {
        return this.accountCardFocusLoanIds.length > 0 || this.accountCardFocusSavingsIds.length > 0;
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
            localization: {
                priceFormatter: (price) => formatCurrency(price),
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
            const accountCardFocusActive = this.isAccountCardFocusActive();

            if (!param.time || !window.app || !window.app.uiManager) {
                this.lastCrosshairParam = null;
                this.lastCrosshairDataPoint = null;
                this.clearAxisLabels();
                if (!this.listHoveredSeries && !accountCardFocusActive) {
                    this.setHoveredSeries(null);
                }
                return;
            }

            const chartData = window.app.uiManager.currentChartData;
            if (!chartData || chartData.length === 0) {
                this.lastCrosshairParam = null;
                this.lastCrosshairDataPoint = null;
                this.clearAxisLabels();
                if (!this.listHoveredSeries && !accountCardFocusActive) {
                    this.setHoveredSeries(null);
                }
                return;
            }

            const dataPoint = chartData.find(d => d.timestamp === param.time);
            this.lastCrosshairParam = param;
            this.lastCrosshairDataPoint = dataPoint || null;
            if (dataPoint && window.showChartHover) {
                window.showChartHover(param, dataPoint);
            }

            if (!accountCardFocusActive) {
                const chartHoveredSeries = this.resolveHoveredSeries(param);
                const hoveredSeries = chartHoveredSeries ?? this.listHoveredSeries;
                this.setHoveredSeries(hoveredSeries);
                this.updateHoverAxisLabels(param, dataPoint, hoveredSeries);
            } else {
                this.updateHoverAxisLabels(param, dataPoint, null);
            }
        });
    }

    setAccountCardFocus({ loanIds = [], savingsIds = [] }) {
        this.accountCardFocusLoanIds = loanIds.map(Number);
        this.accountCardFocusSavingsIds = savingsIds.map(Number);

        if (this.isAccountCardFocusActive()) {
            // List-row hover from opening a card must not linger after cards close.
            this.listHoveredSeries = null;
        }

        this.resolveAccountCardFocusSeries();
        this.refreshHoverPresentation();
    }

    resolveHoveredSeriesFromLastCrosshair() {
        if (!this.lastCrosshairParam?.time) {
            return null;
        }
        return this.resolveHoveredSeries(this.lastCrosshairParam);
    }

    /** Re-apply line emphasis and Y-axis labels after account cards open/close. */
    refreshHoverPresentation() {
        if (this.isAccountCardFocusActive()) {
            this.applyAccountCardFocusHighlight();
            if (this.lastCrosshairParam?.time && this.lastCrosshairDataPoint) {
                this.updateHoverAxisLabels(this.lastCrosshairParam, this.lastCrosshairDataPoint, null);
            } else {
                this.clearAxisLabels();
            }
            return;
        }

        // Account-card focus ended — reset all lines, then only re-emphasize crosshair proximity.
        this.activeHoveredSeries = null;
        this.applySeriesHoverHighlight(null);

        const chartHoveredSeries = this.resolveHoveredSeriesFromLastCrosshair();
        if (chartHoveredSeries) {
            this.activeHoveredSeries = chartHoveredSeries;
            this.applySeriesHoverHighlight(chartHoveredSeries);
        }

        if (this.lastCrosshairParam?.time && this.lastCrosshairDataPoint) {
            this.updateHoverAxisLabels(this.lastCrosshairParam, this.lastCrosshairDataPoint, chartHoveredSeries);
        } else {
            this.clearAxisLabels();
        }
    }

    resolveAccountCardFocusSeries() {
        this.accountCardFocusSeries.clear();
        for (const id of this.accountCardFocusLoanIds) {
            const series = this.seriesByLoanId.get(id);
            if (series) this.accountCardFocusSeries.add(series);
        }
        for (const id of this.accountCardFocusSavingsIds) {
            const series = this.seriesBySavingsId.get(id);
            if (series) this.accountCardFocusSeries.add(series);
        }
    }

    applyAccountCardFocusHighlight() {
        if (!this.isAccountCardFocusActive()) {
            return;
        }

        for (const series of this.getTrackedSeries()) {
            const base = this.seriesBaseStyles.get(series);
            if (!base) continue;

            const isFocused = this.accountCardFocusSeries.has(series);
            series.applyOptions({
                color: isFocused ? base.color : this.colorWithAlpha(base.color, SERIES_HOVER_DIM_ALPHA),
                lineWidth: isFocused ? base.lineWidth + 1 : base.lineWidth,
                lineStyle: base.lineStyle
            });
        }
    }

    highlightLoanFromList(loanId) {
        if (this.isAccountCardFocusActive()) return;
        const series = this.seriesByLoanId.get(Number(loanId));
        if (!series) return;
        this.listHoveredSeries = series;
        this.setHoveredSeries(series);
    }

    highlightSavingsFromList(accountId) {
        if (this.isAccountCardFocusActive()) return;
        const series = this.seriesBySavingsId.get(Number(accountId));
        if (!series) return;
        this.listHoveredSeries = series;
        this.setHoveredSeries(series);
    }

    clearListHoverHighlight(entityId, kind) {
        if (this.isAccountCardFocusActive()) return;
        const map = kind === 'loan' ? this.seriesByLoanId : this.seriesBySavingsId;
        const series = map.get(Number(entityId));
        if (!series || this.listHoveredSeries !== series) return;
        this.listHoveredSeries = null;
        this.setHoveredSeries(null);
    }

    registerSeriesStyle(series, options) {
        if (!series) return;
        this.seriesBaseStyles.set(series, {
            color: options.color,
            lineWidth: options.lineWidth,
            lineStyle: options.lineStyle ?? LightweightCharts.LineStyle.Solid
        });
    }

    colorWithAlpha(color, alpha) {
        if (!color || typeof color !== 'string') return color;
        if (color.startsWith('#')) {
            const hex = color.length === 4
                ? color.slice(1).split('').map((c) => c + c).join('')
                : color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
        if (rgbaMatch) {
            const parts = rgbaMatch[1].split(',').map((part) => part.trim());
            if (parts.length >= 3) {
                return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
            }
        }
        return color;
    }

    resolveHoveredSeries(param) {
        if (param.hoveredSeries) {
            return param.hoveredSeries;
        }
        if (!param.point || !param.time || !param.seriesData) {
            return null;
        }

        const mouseY = param.point.y;
        let closestSeries = null;
        let closestDistance = Infinity;

        for (const series of this.getTrackedSeries()) {
            const data = param.seriesData.get(series);
            if (!data || data.value == null) continue;

            const y = series.priceToCoordinate(data.value);
            if (y == null || !Number.isFinite(y)) continue;

            const distance = Math.abs(y - mouseY);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSeries = series;
            }
        }

        return closestDistance <= SERIES_HOVER_HIT_PX ? closestSeries : null;
    }

    setHoveredSeries(series) {
        if (this.isAccountCardFocusActive()) {
            return;
        }
        if (this.activeHoveredSeries === series) {
            return;
        }
        this.activeHoveredSeries = series;
        this.applySeriesHoverHighlight(series);
    }

    applySeriesHoverHighlight(hoveredSeries) {
        if (this.isAccountCardFocusActive()) {
            this.applyAccountCardFocusHighlight();
            return;
        }

        for (const series of this.getTrackedSeries()) {
            const base = this.seriesBaseStyles.get(series);
            if (!base) continue;

            if (!hoveredSeries) {
                series.applyOptions({
                    color: base.color,
                    lineWidth: base.lineWidth,
                    lineStyle: base.lineStyle
                });
                continue;
            }

            const isHovered = series === hoveredSeries;
            series.applyOptions({
                color: isHovered ? base.color : this.colorWithAlpha(base.color, SERIES_HOVER_DIM_ALPHA),
                lineWidth: isHovered ? base.lineWidth + 1 : base.lineWidth,
                lineStyle: base.lineStyle
            });
        }
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
    updateHoverAxisLabels(param, dataPoint, hoveredSeries = null) {
        if (!this.axisLabelLayer || !this.chart || !param.seriesData) {
            this.clearAxisLabels();
            return;
        }

        const left = this.chart.timeScale().width();
        const labelHeight = 18;
        let rows = [];

        for (const series of this.getTrackedSeries()) {
            const data = param.seriesData.get(series);
            if (!data || data.value == null) continue;

            const y = series.priceToCoordinate(data.value);
            if (y == null || !Number.isFinite(y)) continue;

            const baseStyle = this.seriesBaseStyles.get(series);
            const interest = this.resolveInterestForSeries(series, dataPoint, param.time);
            rows.push({
                series,
                y,
                color: baseStyle?.color || series.options().color || '#888888',
                title: this.seriesDisplayNames.get(series) || '',
                amount: data.value,
                interest
            });
        }

        if (rows.length === 0) {
            this.clearAxisLabels();
            return;
        }

        if (this.isAccountCardFocusActive()) {
            rows = rows.filter((row) => this.accountCardFocusSeries.has(row.series));
            if (rows.length === 0) {
                this.clearAxisLabels();
                return;
            }
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
            if (hoveredSeries) {
                el.classList.add(
                    row.series === hoveredSeries
                        ? 'chart-hover-axis-pair--active'
                        : 'chart-hover-axis-pair--dimmed'
                );
            }
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

            if (this.isAccountCardFocusActive()) {
                this.resolveAccountCardFocusSeries();
                this.refreshHoverPresentation();
            }
            
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
    
    clearSeries(chart) {
        this.clearAxisLabels();
        this.seriesDisplayNames.clear();
        this.seriesInterestByTime.clear();
        this.seriesBaseStyles.clear();
        this.seriesByLoanId.clear();
        this.seriesBySavingsId.clear();
        this.accountCardFocusSeries.clear();
        this.activeHoveredSeries = null;
        this.listHoveredSeries = null;

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
            const lineOpts = {
                color,
                lineWidth: cfg.lineWidth,
                lineStyle: cfg.lineStyle,
                title: '',
                priceLineVisible: cfg.priceLineVisible,
                lastValueVisible: cfg.lastValueVisible
            };
            const lineSeries = chart.addLineSeries(lineOpts);
            this.registerSeriesStyle(lineSeries, lineOpts);
            if (cfg.showLegendTitle) {
                this.registerSeriesDisplayName(lineSeries, series.name);
            }
            this.registerSeriesInterestByTime(lineSeries, series.data, 'interestPaid');
            // LC only needs time/value; interestPaid is kept in seriesInterestByTime.
            lineSeries.setData(series.data.map((point) => ({
                time: point.time,
                value: point.value
            })));
            if (series.id != null) {
                this.seriesByLoanId.set(series.id, lineSeries);
            }
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
            const lineOpts = {
                color,
                lineWidth: cfg.lineWidth,
                lineStyle: cfg.lineStyle,
                title: '',
                priceLineVisible: cfg.priceLineVisible,
                lastValueVisible: cfg.lastValueVisible
            };
            const lineSeries = chart.addLineSeries(lineOpts);
            this.registerSeriesStyle(lineSeries, lineOpts);
            if (cfg.showLegendTitle) {
                this.registerSeriesDisplayName(lineSeries, series.name);
            }
            this.registerSeriesInterestByTime(lineSeries, series.data, 'interestEarned');
            lineSeries.setData(series.data.map((point) => ({
                time: point.time,
                value: point.value
            })));
            if (series.id != null) {
                this.seriesBySavingsId.set(series.id, lineSeries);
            }
            this.chartSeries.individualSavings.push(lineSeries);
        });
    }
    
    addSavingsLine(chart, results) {
        if (!results.savingsData || results.savingsData.length === 0) {
            return;
        }
        const savingsOpts = {
            color: '#26a69a',
            lineWidth: 3,
            ...SERIES_AXIS_LABEL_OPTS
        };
        this.chartSeries.savings = chart.addLineSeries(savingsOpts);
        this.registerSeriesStyle(this.chartSeries.savings, savingsOpts);
        this.registerSeriesDisplayName(this.chartSeries.savings, 'Total Savings');
        this.chartSeries.savings.setData(results.savingsData);
    }
    
    addNetWorthLine(chart, results) {
        const netWorthOpts = {
            color: '#2196f3',
            lineWidth: 3,
            ...SERIES_AXIS_LABEL_OPTS
        };
        this.chartSeries.netWorth = chart.addLineSeries(netWorthOpts);
        this.registerSeriesStyle(this.chartSeries.netWorth, netWorthOpts);
        this.registerSeriesDisplayName(
            this.chartSeries.netWorth,
            'Net Worth' + (results.hasOverrides ? ' (With Overrides)' : '')
        );
        this.chartSeries.netWorth.setData(results.netWorthData);
        
        // Add comparison line if there are overrides
        if (results.hasOverrides) {
            const netWorthOriginalOpts = {
                color: '#2196f3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                ...SERIES_AXIS_LABEL_OPTS
            };
            this.chartSeries.netWorthOriginal = chart.addLineSeries(netWorthOriginalOpts);
            this.registerSeriesStyle(this.chartSeries.netWorthOriginal, netWorthOriginalOpts);
            this.registerSeriesDisplayName(this.chartSeries.netWorthOriginal, 'Original Net Worth (No Overrides)');
            this.chartSeries.netWorthOriginal.setData(results.netWorthOriginalData);
        }
    }
    
    addLoanBalanceLine(chart, results) {
        if (results.loanBalanceData.length > 0) {
            const loanBalanceOpts = {
                color: '#f44336',
                lineWidth: 2,
                ...SERIES_AXIS_LABEL_OPTS
            };
            this.chartSeries.loanBalance = chart.addLineSeries(loanBalanceOpts);
            this.registerSeriesStyle(this.chartSeries.loanBalance, loanBalanceOpts);
            this.registerSeriesDisplayName(this.chartSeries.loanBalance, 'Total Loan Balance');
            this.chartSeries.loanBalance.setData(results.loanBalanceData);
        }
    }
    
    addGoalLine(chart, results) {
        if (results.goalAmount > 0) {
            const goalLineOpts = {
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                ...SERIES_AXIS_LABEL_OPTS
            };
            this.chartSeries.goalLine = chart.addLineSeries(goalLineOpts);
            this.registerSeriesStyle(this.chartSeries.goalLine, goalLineOpts);
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
