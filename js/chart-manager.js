/**
 * Chart Manager Component
 * Handles all chart-related operations
 */

class ChartManager {
    constructor() {
        this.chartSeries = {
            savings: null,
            netWorth: null,
            netWorthOriginal: null,
            loanBalance: null,
            goalLine: null
        };
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
                rightOffset: 5,
                leftOffset: 5,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
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
            if (!param.time || !window.app || !window.app.uiManager) {
                return;
            }
            
            // Find the data point for this time
            const chartData = window.app.uiManager.currentChartData;
            if (!chartData || chartData.length === 0) return;
            
            const dataPoint = chartData.find(d => d.timestamp === param.time);
            if (dataPoint && window.showChartHover) {
                window.showChartHover(param, dataPoint);
            }
        });
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
            this.addLoanBalanceLine(chart, results);
            this.addGoalLine(chart, results);
            this.addLoanPayoffMarkers(chart, results);
            
            // Apply chart styling and fit content
            this.applyChartStyling(chart);
            
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
    
    clearSeries(chart) {
        Object.keys(this.chartSeries).forEach(key => {
            if (this.chartSeries[key]) {
                chart.removeSeries(this.chartSeries[key]);
                this.chartSeries[key] = null;
            }
        });
    }
    
    addSavingsLine(chart, results) {
        this.chartSeries.savings = chart.addLineSeries({
            color: '#26a69a',
            lineWidth: 3,
            title: 'Total Savings'
        });
        this.chartSeries.savings.setData(results.savingsData);
    }
    
    addNetWorthLine(chart, results) {
        this.chartSeries.netWorth = chart.addLineSeries({
            color: '#2196f3',
            lineWidth: 3,
            title: 'Net Worth' + (results.hasOverrides ? ' (With Overrides)' : '')
        });
        this.chartSeries.netWorth.setData(results.netWorthData);
        
        // Add comparison line if there are overrides
        if (results.hasOverrides) {
            this.chartSeries.netWorthOriginal = chart.addLineSeries({
                color: '#2196f3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                title: 'Original Net Worth (No Overrides)'
            });
            this.chartSeries.netWorthOriginal.setData(results.netWorthOriginalData);
        }
    }
    
    addLoanBalanceLine(chart, results) {
        if (results.loanBalanceData.length > 0) {
            this.chartSeries.loanBalance = chart.addLineSeries({
                color: '#f44336',
                lineWidth: 2,
                title: 'Total Loan Balance'
            });
            this.chartSeries.loanBalance.setData(results.loanBalanceData);
        }
    }
    
    addGoalLine(chart, results) {
        if (results.goalAmount > 0) {
            this.chartSeries.goalLine = chart.addLineSeries({
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                title: `Goal: $${results.goalAmount.toLocaleString()}`
            });
            
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
            // Add markers to the loan balance line
            this.chartSeries.loanBalance.setMarkers(results.loanPayoffMarkers);
            
            // Add vertical lines for each payoff date
            results.loanPayoffMarkers.forEach(marker => {
                const payoffLine = chart.addLineSeries({
                    color: '#f44336',
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    title: 'Loan Payoff'
                });
                
                // Create vertical line data
                const maxValue = Math.max(
                    ...results.savingsData.map(point => point.value),
                    results.goalAmount || 0
                ) * 1.1;
                
                const verticalLineData = [
                    { time: marker.time, value: 0 },
                    { time: marker.time, value: maxValue }
                ];
                
                payoffLine.setData(verticalLineData);
            });
        }
    }
    
    applyChartStyling(chart) {
        chart.applyOptions({
            rightPriceScale: {
                autoScale: true,
                scaleMargins: {
                    top: 0.15,
                    bottom: 0.15
                }
            },
            timeScale: {
                rightOffset: 5,
                leftOffset: 5,
            }
        });
        
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
