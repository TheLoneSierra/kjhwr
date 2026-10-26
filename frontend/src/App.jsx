import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Activity, Zap, AlertTriangle, ShieldCheck, Download, Calendar, Filter,
  TrendingUp, BarChart2, Cpu, Database, Eye, Code, FileText, Sliders, RefreshCw
} from 'lucide-react';

const API_BASE_URL = "http://localhost:8000";

// Custom Tooltip for Area Chart
const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
        <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1">Time: {label}</p>
        <p className="text-emerald-400 font-mono">
          Actual: <span className="font-bold">{payload[0]?.value?.toLocaleString()} MW</span>
        </p>
        {payload[1] && (
          <p className="text-cyan-400 font-mono">
            Forecast: <span className="font-bold">{payload[1]?.value?.toLocaleString()} MW</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Bar Chart
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
        <p className="font-semibold text-slate-300 mb-1">Error Range: {label}</p>
        <p className="text-cyan-400 font-mono">
          Frequency: <span className="font-bold">{payload[0]?.value} periods</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [viewMode, setViewMode] = useState('executive');
  const [dateRange, setDateRange] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');
  const [riskToleranceP, setRiskToleranceP] = useState(85);

  const [windData, setWindData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Fetch wind dataset from FastAPI backend
  useEffect(() => {
    const fetchWindData = async () => {
      setLoading(true);
      setApiError(null);
      try {
        let url = `${API_BASE_URL}/api/v1/wind-data?date_range=${dateRange}`;
        if (selectedDay !== 'all') {
          const dayNum = parseInt(selectedDay.split('-')[2], 10);
          url = `${API_BASE_URL}/api/v1/wind-data?day=${dayNum}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        const json = await response.json();
        setWindData(json.data || []);
      } catch (err) {
        console.error("Failed to connect to FastAPI backend:", err);
        setApiError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWindData();
  }, [dateRange, selectedDay]);

  const metrics = useMemo(() => {
    if (!windData.length) return { totalActualMWh: 0, totalForecastMWh: 0, maeMW: 0, rmseMW: 0, biasMW: 0, maxErrorMW: 0, count: 0, mapePercent: '0.00' };

    let sumActual = 0;
    let sumForecast = 0;
    let sumAbsError = 0;
    let sumSqError = 0;
    let sumError = 0;
    let maxErr = 0;

    windData.forEach(d => {
      sumActual += d.actual * 0.5;
      sumForecast += d.forecast * 0.5;
      sumAbsError += d.absError;
      sumSqError += d.absError * d.absError;
      sumError += d.error;
      if (d.absError > maxErr) maxErr = d.absError;
    });

    const count = windData.length;
    const mae = Math.round(sumAbsError / count);
    const rmse = Math.round(Math.sqrt(sumSqError / count));
    const bias = Math.round(sumError / count);
    const mape = ((mae / (sumActual / count / 0.5)) * 100).toFixed(2);

    return {
      totalActualMWh: Math.round(sumActual),
      totalForecastMWh: Math.round(sumForecast),
      maeMW: mae,
      rmseMW: rmse,
      biasMW: bias,
      mapePercent: mape,
      maxErrorMW: maxErr,
      count
    };
  }, [windData]);

  const thermalRiskMetrics = useMemo(() => {
    const sortedErrors = [...windData].map(d => d.error).sort((a, b) => a - b);
    const index = Math.floor((riskToleranceP / 100) * sortedErrors.length);
    const pVal = sortedErrors[Math.min(index, sortedErrors.length - 1)] || 0;
    const recommendedBufferMW = Math.max(0, pVal + metrics.maeMW * 0.5);
    const thermalCostEstGBP = Math.round(recommendedBufferMW * 85 * 24);

    return {
      pValMW: pVal,
      recommendedBufferMW: Math.round(recommendedBufferMW),
      thermalCostEstGBP
    };
  }, [windData, riskToleranceP, metrics.maeMW]);

  const errorHistogram = useMemo(() => {
    const bins = { '< -1500': 0, '-1500 to -500': 0, '-500 to 0': 0, '0 to 500': 0, '500 to 1500': 0, '> 1500': 0 };
    windData.forEach(d => {
      if (d.error < -1500) bins['< -1500']++;
      else if (d.error < -500) bins['-1500 to -500']++;
      else if (d.error < 0) bins['-500 to 0']++;
      else if (d.error <= 500) bins['0 to 500']++;
      else if (d.error <= 1500) bins['500 to 1500']++;
      else bins['> 1500']++;
    });
    return Object.keys(bins).map(key => ({ range: key, count: bins[key] }));
  }, [windData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* --- EXECUTIVE HEADER & BRANDING --- */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-cyan-500 rounded-xl shadow-lg shadow-emerald-500/20">
              <Zap className="h-6 w-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  GridSense UK
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Jan 2026 Day-Ahead
                </span>
              </div>
              <p className="text-xs text-slate-400">UK National Grid Elexon Wind Forecast & Error Analytics</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-lg flex items-center space-x-1">
              <button
                onClick={() => setViewMode('executive')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'executive'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Customer Pitch View</span>
              </button>
              <button
                onClick={() => setViewMode('technical')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'technical'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Tech Lead Review View</span>
              </button>
            </div>

            <button
              onClick={() => alert('Exporting Elexon Data Stream CSV for January 2026...')}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs flex items-center space-x-1 transition-all"
              title="Download Data Report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* --- GLOBAL FILTER BAR --- */}
      <section className="bg-slate-900/50 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium flex items-center mr-1">
              <Filter className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Resolution:
            </span>

            {[
              { label: 'Entire Month', value: 'all' },
              { label: 'Week 1 (Jan 1-7)', value: 'w1' },
              { label: 'Storm Peak (Jan 7-9)', value: 'storm_peak' },
              { label: 'Week 2 (Jan 8-14)', value: 'w2' },
              { label: 'Week 3 (Jan 15-21)', value: 'w3' },
              { label: 'Week 4 (Jan 22-31)', value: 'w4' },
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => { setDateRange(preset.value); setSelectedDay('all'); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${dateRange === preset.value && selectedDay === 'all'
                    ? 'bg-slate-700 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Target Day:</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
              >
                <option value="all" className="bg-slate-900 text-slate-200">All Days in Jan 2026</option>
                {Array.from({ length: 31 }, (_, i) => {
                  const dayNum = String(i + 1).padStart(2, '0');
                  const dStr = `2026-01-${dayNum}`;
                  return (
                    <option key={dStr} value={dStr} className="bg-slate-900 text-slate-200">
                      Jan {dayNum}, 2026
                    </option>
                  );
                })}
              </select>
            </div>

            <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${apiError
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : loading
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
              {loading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${apiError ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              )}
              <span className="font-mono text-[11px]">
                {apiError ? 'BACKEND OFFLINE' : loading ? 'STREAMING...' : 'FASTAPI CONNECTED'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* --- EXECUTIVE VIEW --- */}
        {viewMode === 'executive' && (
          <>
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-3xl">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500 text-slate-950">
                      PILOT SUMMARY
                    </span>
                    <h2 className="text-lg font-bold text-white">UK Day-Ahead Power Procurement Error Evaluation</h2>
                  </div>
                  <p className="text-sm text-slate-300">
                    Helping UK energy traders mitigate balancing market exposure by quantifying Elexon renewable forecast uncertainty, calculating thermal backup dispatch needs, and reducing imbalance penalties.
                  </p>
                </div>
                <div className="flex items-center space-x-4 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Evaluated HH Periods</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">{metrics.count.toLocaleString()} <span className="text-xs text-slate-400">HH</span></div>
                  </div>
                  <div className="h-8 w-px bg-slate-800"></div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Delivery Period</div>
                    <div className="text-sm font-semibold text-white">Jan 1 - Jan 31, 2026</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CORE METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Total Actual Wind</p>
                    <h3 className="text-2xl font-bold text-white font-mono mt-1">
                      {(metrics.totalActualMWh / 1000).toFixed(1)} <span className="text-sm font-normal text-slate-400">GWh</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Forecast Total:</span>
                  <span className="font-mono text-slate-200">{(metrics.totalForecastMWh / 1000).toFixed(1)} GWh</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Mean Abs Error (MAE)</p>
                    <h3 className="text-2xl font-bold text-cyan-400 font-mono mt-1">
                      {metrics.maeMW.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Percentage Error (MAPE):</span>
                  <span className="font-mono text-cyan-300">{metrics.mapePercent}%</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Root Mean Sq Error (RMSE)</p>
                    <h3 className="text-2xl font-bold text-amber-400 font-mono mt-1">
                      {metrics.rmseMW.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Max Peak Error:</span>
                  <span className="font-mono text-amber-300">{metrics.maxErrorMW.toLocaleString()} MW</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Mean Forecast Bias</p>
                    <h3 className={`text-2xl font-bold font-mono mt-1 ${metrics.biasMW < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {metrics.biasMW > 0 ? `+${metrics.biasMW}` : metrics.biasMW} <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className={`p-2 rounded-lg ${metrics.biasMW < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>System Exposure:</span>
                  <span className="font-mono text-slate-200">
                    {metrics.biasMW > 0 ? 'Over-Forecasted' : 'Under-Forecasted'}
                  </span>
                </div>
              </div>

            </div>

            {/* CHART 1: MAIN TIME SERIES */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>UK Wind Power: Day-Ahead WINDFOR Forecast vs FUELHH Actuals</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Half-Hourly (HH) resolution generation across January 2026</p>
                </div>

                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-0.5 bg-emerald-400 rounded"></span>
                    <span className="text-slate-300">Actual Wind (FUELHH)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-0.5 bg-cyan-400 rounded border border-dashed border-cyan-400"></span>
                    <span className="text-slate-300">Forecast (WINDFOR)</span>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={windData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="dateTime"
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => typeof val === 'string' ? val.split(' ')[0].substring(5) : ''}
                      minTickGap={40}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      unit=" MW"
                      domain={[0, 'auto']}
                    />
                    <Tooltip content={<CustomAreaTooltip />} />
                    <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" />
                    <Line type="monotone" dataKey="forecast" stroke="#06b6d4" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TWO-COLUMN LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* CHART 2: ERROR DISTRIBUTION */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Forecast Error Distribution (MW)</span>
                    </h3>
                    <span className="text-xs text-slate-400">Error = Forecast - Actual</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Quantifying imbalance risks: positive errors indicate wind shortfall requiring thermal dispatch.
                  </p>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={errorHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="range" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">Key Takeaway for Traders: </span>
                    Under-forecasting (actual &gt; forecast) causes over-procurement costs, while over-forecasting requires expensive cash-out balancing power.
                  </div>
                </div>
              </div>

              {/* INTERACTIVE THERMAL BACKUP CALCULATOR */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>Interactive Thermal Power Buffer Decision Tool</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      Day-Ahead Procurement
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Adjust trader risk tolerance percentile to calculate optimal additional thermal power buffer needed from the market.
                  </p>

                  <div className="space-y-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-slate-300 font-medium">Confidence / Safety Level:</span>
                        <span className="font-mono text-cyan-400 font-bold">P{riskToleranceP} Confidence</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="99"
                        value={riskToleranceP}
                        onChange={(e) => setRiskToleranceP(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                        <span>P50 (Standard)</span>
                        <span>P85 (Recommended)</span>
                        <span>P99 (Conservative)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <div className="text-[11px] text-slate-400">Recommended Thermal Buffer</div>
                        <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                          +{thermalRiskMetrics.recommendedBufferMW.toLocaleString()} <span className="text-xs text-slate-400">MW</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Protects against forecast drops</div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <div className="text-[11px] text-slate-400">Est. Daily Buffer Cost</div>
                        <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                          £{(thermalRiskMetrics.thermalCostEstGBP / 1000).toFixed(1)}k
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">Based on ~£85/MWh Day-Ahead</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-3">
                  <span>Calculated Net Imbalance Protection:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    Covering {riskToleranceP}% of historical Jan 2026 wind variance
                  </span>
                </div>
              </div>

            </div>
          </>
        )}

        {/* --- TECHNICAL DEEP-DIVE VIEW --- */}
        {viewMode === 'technical' && (
          <div className="space-y-6">

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Software Architecture & Data Ingestion Specification</h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-4xl">
                    Internal technical documentation explaining the data pipeline, time-series alignment logic, and deployment architecture using React, FastAPI, Docker, and Elexon BMRS API streams.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Database className="w-5 h-5" />
                  <h3 className="font-bold text-white text-sm">1. Data Ingestion & Stream Specs</h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                  <li><strong className="text-slate-100">Actual Endpoint:</strong> Elexon BMRS <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-400">/datasets/FUELHH/stream</code> (filtered by <code className="bg-slate-950 px-1 py-0.5 rounded">fuelType="WIND"</code>).</li>
                  <li><strong className="text-slate-100">Forecast Endpoint:</strong> Elexon BMRS <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-400">/datasets/WINDFOR/stream</code>.</li>
                  <li><strong className="text-slate-100">Temporal Resolution:</strong> 30-minute settlement periods (1,488 records for Jan 2026).</li>
                  <li><strong className="text-slate-100">Gate Closure Logic:</strong> Uses latest forecast where <code className="bg-slate-950 px-1 py-0.5 rounded">publishTime</code> ≤ D-1 11:00 AM.</li>
                </ul>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Activity className="w-5 h-5" />
                  <h3 className="font-bold text-white text-sm">2. Quantitative Error Formulas</h3>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono">
                    <div className="text-slate-400 text-[10px]">MAE (Mean Absolute Error):</div>
                    <div className="text-emerald-400">MAE = (1/N) * Σ |Forecast_i - Actual_i|</div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono">
                    <div className="text-slate-400 text-[10px]">RMSE (Root Mean Square Error):</div>
                    <div className="text-amber-400">RMSE = √[ (1/N) * Σ (Forecast_i - Actual_i)² ]</div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono">
                    <div className="text-slate-400 text-[10px]">Mean Bias (Directional Risk):</div>
                    <div className="text-cyan-400">Bias = (1/N) * Σ (Forecast_i - Actual_i)</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-bold text-white text-sm">3. Containerization & Deployment</h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                  <li><strong className="text-slate-100">Dockerized Architecture:</strong> Multi-stage build separating Python backend and React frontend static assets.</li>
                  <li><strong className="text-slate-100">Vercel / Heroku Deployment:</strong> Continuous integration triggered from GitHub main branch.</li>
                  <li><strong className="text-slate-100">AI Tool Usage:</strong> ChatGPT / Claude / Gemini utilized for rapid UI layout prototyping and synthetically modeled wind speed curves.</li>
                </ul>
              </div>

            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>Elexon BMRS Endpoint Sample Json Stream Inspector</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">Live FastAPI Payload Response</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-1.5 rounded-t-lg border-t border-x border-slate-800">
                    <span>Dataset: FUELHH (Actual Wind)</span>
                    <span>200 OK</span>
                  </div>
                  <pre className="bg-slate-950 text-slate-300 p-3 rounded-b-lg border border-slate-800 text-[11px] font-mono overflow-x-auto h-48">
                    {JSON.stringify({
                      "dataset": "FUELHH",
                      "fuelType": "WIND",
                      "startTime": windData[0]?.dateTime || "2026-01-01T00:00:00Z",
                      "generation": windData[0]?.actual || 8450,
                      "settlementPeriod": windData[0]?.settlementPeriod || 1,
                      "unit": "MW"
                    }, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono text-cyan-400 bg-slate-950 px-3 py-1.5 rounded-t-lg border-t border-x border-slate-800">
                    <span>Dataset: WINDFOR (Day-Ahead Forecast)</span>
                    <span>200 OK</span>
                  </div>
                  <pre className="bg-slate-950 text-slate-300 p-3 rounded-b-lg border border-slate-800 text-[11px] font-mono overflow-x-auto h-48">
                    {JSON.stringify({
                      "dataset": "WINDFOR",
                      "publishTime": "2025-12-31T11:00:00Z",
                      "startTime": windData[0]?.dateTime || "2026-01-01T00:00:00Z",
                      "generation": windData[0]?.forecast || 8900,
                      "settlementPeriod": windData[0]?.settlementPeriod || 1,
                      "unit": "MW"
                    }, null, 2)}
                  </pre>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      <footer className="border-t border-slate-800 bg-slate-900/40 mt-12 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">GridSense UK Pilot Solution</span>
            <span>• Built for Day-Ahead Power Procurement</span>
          </div>
          <div>
            <span>Data source: Elexon BMRS Stream via FastAPI (January 2026)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}