/**
 * LightweightCharts setup: series (savings, net worth, loans, goal), markers, hover, resize.
 * Defines globals: ChartManager, INDIVIDUAL_LOAN_LINES
 * Depends on: window.LightweightCharts; summary-overlay.js (window.showChartHover on crosshair);
 *   DOM: #chart container (passed into createChart)
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
            goalLine: null
        };

        this.individualLoanColors = [
            '#ef9a9a', '#e57373', '#ef5350', '#ff7043', '#ff8a65',
            '#ffab91', '#f48fb1', '#ec407a', '#ce93d8', '#ab47bc',
            '#b39ddb', '#9575cd', '#7986cb', '#64b5f6', '#4dd0e1',
            '#80cbc4', '#a5d6a7', '#c5e1a5', '#fff59d', '#ffcc80'
        ];

        /** @type {Map<object, object>} series API -> hover price line */
        this.hoverPriceLines = new Map();

        /** @type {Map<object, string>} series API -> label shown on hover only */
        this.seriesDisplayNames = new Map();
    }
    
    createChart(container) {
        if (!window.LightweightCharts) {
            console.error('LightweightCharts library not loaded');
            return null;
        }
        
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
    
    setupChartHover(chart) {
        chart.subscribeCrosshairMove(param => {
            this.updateHoverPriceLabels(param);

            if (!param.time || !window.app || !window.app.uiManager) {
                return;
            }

            const chartData = window.app.uiManager.currentChartData;
            if (!chartData || chartData.length === 0) return;

            const dataPoint = chartData.find(d => d.timestamp === param.time);
            if (dataPoint && window.showChartHover) {
                window.showChartHover(param, dataPoint);
            }
        });
    }

    getTrackedSeries() {
        const series = [];
        if (this.chartSeries.savings) series.push(this.chartSeries.savings);
        if (this.chartSeries.netWorth) series.push(this.chartSeries.netWorth);
        if (this.chartSeries.netWorthOriginal) series.push(this.chartSeries.netWorthOriginal);
        if (this.chartSeries.loanBalance) series.push(this.chartSeries.loanBalance);
        if (this.chartSeries.goalLine) series.push(this.chartSeries.goalLine);
        series.push(...this.chartSeries.individualLoans);
        return series;
    }

    registerSeriesDisplayName(series, displayName) {
        if (series && displayName) {
            this.seriesDisplayNames.set(series, displayName);
        }
    }

    clearHoverPriceLines() {
        this.hoverPriceLines.forEach((priceLine, series) => {
            try {
                series.removePriceLine(priceLine);
            } catch (error) {
                // Series may already have been removed during chart refresh.
            }
        });
        this.hoverPriceLines.clear();
    }

    updateHoverPriceLabels(param) {
        if (!param.time || !param.seriesData) {
            this.clearHoverPriceLines();
            return;
        }

        for (const series of this.getTrackedSeries()) {
            const data = param.seriesData.get(series);
            if (!data || data.value == null) {
                const existing = this.hoverPriceLines.get(series);
                if (existing) {
                    series.removePriceLine(existing);
                    this.hoverPriceLines.delete(series);
                }
                continue;
            }

            const color = series.options().color;
            const title = this.seriesDisplayNames.get(series) || '';
            const lineOpts = {
                price: data.value,
                color,
                lineVisible: false,
                axisLabelVisible: true,
                title,
            };

            const existing = this.hoverPriceLines.get(series);
            if (existing) {
                existing.applyOptions(lineOpts);
            } else {
                this.hoverPriceLines.set(series, series.createPriceLine(lineOpts));
            }
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
            
            // Add new series
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
        this.clearHoverPriceLines();
        this.seriesDisplayNames.clear();

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
            lineSeries.setData(series.data);
            this.chartSeries.individualLoans.push(lineSeries);
        });
    }
    
    addSavingsLine(chart, results) {
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
