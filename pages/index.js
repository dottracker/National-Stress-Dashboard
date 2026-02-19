import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { INDICES } from '../lib/indices'; // Ensure this file exists in /lib
import { 
  Activity, ShieldAlert, History, Sliders, Newspaper, RefreshCw, Server, AlertTriangle 
} from 'lucide-react';

export default function Dashboard({ initialData, lastUpdated }) {
  // --- STATE MANAGEMENT ---
  const [data, setData] = useState(initialData); // Economic Data
  const [weights, setWeights] = useState({}); // Indicator Importance (1-10)
  const [analysis, setAnalysis] = useState(null); // Gemini AI Result
  const [news, setNews] = useState([]); // News Headlines
  const [comparisonYear, setComparisonYear] = useState('2008'); // Ghost Line Year
  const [historicalData, setHistoricalData] = useState({}); // Ghost Line Data Store
  
  // Loading States
  const [loadingAI, setLoadingAI] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCached, setIsCached] = useState(false);

  // --- 1. FETCH AI INTELLIGENCE (Client Side) ---
  const fetchIntel = async (force = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentData: initialData.map(d => ({ id: d.id, name: d.name, val: d.currentVal })),
          forceRefresh: force 
        })
      });
      
      const result = await res.json();
      
      if (result.analysis) {
        setAnalysis(result.analysis);
        setNews(result.news || []);
        // Only set weights if AI provided them, otherwise keep defaults
        if (result.analysis.weights) setWeights(result.analysis.weights);
        setIsCached(result.cached);
      }
    } catch (e) {
      console.error("Intel Fetch Failed:", e);
    } finally {
      setIsRefreshing(false);
      setLoadingAI(false);
    }
  };

  // Run AI fetch on initial load
  useEffect(() => {
    fetchIntel();
  }, []);

  // --- 2. FETCH HISTORICAL "GHOST" DATA ---
  useEffect(() => {
    const fetchHistory = async () => {
      const historyBuffer = {};
      
      // We fetch history for all indices in parallel
      await Promise.all(initialData.map(async (item) => {
        try {
          const res = await fetch(`/api/history?series_id=${item.id}&year=${comparisonYear}`);
          const json = await res.json();
          if (json.observations) {
            // Normalize data for chart
            historyBuffer[item.id] = json.observations.map(obs => parseFloat(obs.value));
          }
        } catch (e) {
          console.error(`Failed to fetch history for ${item.id}`);
        }
      }));
      setHistoricalData(historyBuffer);
    };

    if (comparisonYear) fetchHistory();
  }, [comparisonYear]);

  // --- HELPER: MERGE CURRENT & HISTORY FOR CHARTS ---
  const getChartData = (item) => {
    // Current data comes from server props
    const current = item.chartData || [];
    const history = historicalData[item.id] || [];
    
    // We map the current data and attach 'ghost' values from the history array
    // Note: This is a rough overlay (Index 0 matches Index 0)
    return current.map((point, i) => ({
      date: point.date,
      value: point.value,
      ghost: history[i] || null // The historical value
    }));
  };

  // --- HELPER: CALCULATE VISUAL STRESS BAR ---
  // While AI decides the DEFCON, this bar visualizes the specific weighted inputs
  const calculateVisualStress = () => {
    let totalScore = 0;
    let maxScore = 0;
    data.forEach(item => {
      const w = weights[item.id] || 5;
      maxScore += w;
      if (item.stressStatus) totalScore += w;
    });
    return maxScore === 0 ? 0 : (totalScore / maxScore) * 100;
  };

  const currentDefcon = analysis?.defcon_level || 5;
  const stressPercent = calculateVisualStress();

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-300 font-mono selection:bg-blue-500 selection:text-white">
      <Head>
        <title>Pentagon Econ Dashboard | DEFCON {currentDefcon}</title>
      </Head>

      {/* --- TOP STATUS BAR --- */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-500 animate-pulse" size={20} />
            <div>
              <h1 className="text-sm font-bold tracking-widest text-slate-100 uppercase">National Stress Dashboard</h1>
              <p className="text-[10px] text-slate-500">SECURE CONNECTION // LAST UPDATE: {lastUpdated}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isCached && (
              <div className="hidden md:flex items-center gap-2 text-[10px] text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900">
                <Server size={10} /> ARCHIVE_MODE
              </div>
            )}
            <button 
              onClick={() => fetchIntel(true)}
              disabled={isRefreshing}
              className={`flex items-center gap-2 text-[10px] px-3 py-1.5 rounded border transition-all
                ${isRefreshing 
                  ? 'bg-blue-900/20 border-blue-800 text-blue-400 cursor-wait' 
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "ANALYZING..." : "FORCE REFRESH"}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* --- SECTION 1: DEFCON & BRIEFING --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* DEFCON STATUS CARD */}
          <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
            <div className={`absolute inset-0 opacity-10 ${currentDefcon <= 2 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
            
            <h2 className="text-xs font-bold text-slate-500 tracking-[0.2em] mb-4 z-10">THREAT LEVEL</h2>
            <div className={`z-10 text-8xl font-black tracking-tighter ${
              currentDefcon === 1 ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' :
              currentDefcon === 2 ? 'text-orange-500' :
              currentDefcon === 3 ? 'text-yellow-500' :
              'text-blue-500'
            }`}>
              {currentDefcon}
            </div>
            <div className="z-10 mt-4 w-full px-8">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase">
                <span>System Stability</span>
                <span>{100 - Math.round(stressPercent)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-red-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${stressPercent}%` }} 
                />
              </div>
            </div>
          </div>

          {/* INTELLIGENCE BRIEFING */}
          <div className="lg:col-span-8 bg-slate-900/40 border-l-4 border-blue-600 rounded-r-xl p-6 relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Presidential Brief
              </span>
              {loadingAI && <span className="text-[10px] text-slate-500 animate-pulse">Decrypting Gemini Signal...</span>}
            </div>
            
            <p className="text-lg md:text-xl text-slate-200 font-serif italic leading-relaxed mb-6">
              "{analysis?.briefing || "Awaiting intelligence data..."}"
            </p>

            <div className="bg-black/30 p-4 rounded border border-slate-800/50">
              <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                <Sliders size={10} /> AI Technical Reasoning
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {analysis?.ai_reasoning || "Analyzing market vectors..."}
              </p>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: MAIN DASHBOARD --- */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT SIDEBAR */}
          <aside className="space-y-6">
            
            {/* HISTORICAL CONTROL */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <History size={12} /> Comparative Epoch
              </h3>
              <select 
                value={comparisonYear}
                onChange={(e) => setComparisonYear(e.target.value)}
                className="w-full bg-[#0a0e14] border border-slate-700 text-slate-300 text-xs rounded p-2 outline-none focus:border-blue-500"
              >
                <option value="2008">2008 (Financial Crisis)</option>
                <option value="2020">2020 (COVID-19)</option>
                <option value="2000">2000 (Dot Com)</option>
                <option value="1974">1974 (Stagflation)</option>
              </select>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                <span className="w-3 h-0.5 bg-slate-600/50"></span>
                <span>Ghost Line</span>
              </div>
            </div>

            {/* WEIGHTING SLIDERS */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <Sliders size={12} /> Signal Weights
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {data.map(item => (
                  <div key={item.id}>
                    <div className="flex justify-between text-[10px] uppercase mb-1">
                      <span className="text-slate-400 truncate w-24">{item.name}</span>
                      <span className="text-blue-400">{weights[item.id] || 5}</span>
                    </div>
                    <input 
                      type="range" min="1" max="10" 
                      value={weights[item.id] || 5}
                      onChange={(e) => setWeights({...weights, [item.id]: parseInt(e.target.value)})}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* NEWS FEED */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <Newspaper size={12} /> Live Wire
              </h3>
              <div className="space-y-3">
                {news.length > 0 ? news.map((n, i) => (
                  <a key={i} href={n.url} target="_blank" rel="noreferrer" className="block group">
                    <p className="text-[9px] text-blue-500 font-bold mb-0.5 uppercase">{n.source.name}</p>
                    <p className="text-[11px] leading-tight text-slate-400 group-hover:text-white transition-colors">
                      {n.title}
                    </p>
                  </a>
                )) : (
                  <p className="text-[10px] text-slate-600 italic">No signals intercepted.</p>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT GRID: CHARTS */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((item) => {
              const chartData = getChartData(item);
              const isStressed = item.stressStatus;

              return (
                <div 
                  key={item.id} 
                  className={`relative p-5 rounded-lg border transition-all duration-300
                    ${isStressed 
                      ? 'bg-red-950/10 border-red-900/40 hover:border-red-500/50' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-blue-500/30'}`}
                >
                  {/* CARD HEADER */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{item.category}</span>
                      <h3 className="text-sm font-bold text-slate-200">{item.name}</h3>
                    </div>
                    {isStressed ? (
                      <AlertTriangle size={16} className="text-red-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>

                  {/* VALUE DISPLAY */}
                  <div className="flex items-baseline gap-2 mb-4 border-b border-slate-800/50 pb-2">
                    <span className="text-2xl font-black text-white">{item.displayValue}</span>
                    <span className={`text-[10px] font-bold uppercase ${isStressed ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isStressed ? 'CRITICAL' : 'STABLE'}
                    </span>
                  </div>

                  {/* CHART AREA */}
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        {/* GHOST LINE (Historical) */}
                        <Line 
                          type="monotone" 
                          dataKey="ghost" 
                          stroke="#475569" 
                          strokeWidth={1} 
                          strokeDasharray="4 4" 
                          dot={false}
                          isAnimationActive={false} 
                        />
                        {/* MAIN LINE (Current) */}
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke={isStressed ? "#ef4444" : "#3b82f6"} 
                          strokeWidth={2} 
                          dot={false} 
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}

// --- SERVER SIDE DATA FETCHING ---
export async function getServerSideProps() {
  const apiKey = process.env.FRED_API_KEY;
  const baseUrl = 'https://api.stlouisfed.org/fred/series/observations';

  // Import indices on server side
  const { INDICES } = require('../lib/indices');

  // Fetch all indices in parallel
  const results = await Promise.all(INDICES.map(async (idx) => {
    try {
      // Get last 15 periods
      const response = await fetch(
        `${baseUrl}?series_id=${idx.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`
      );
      const data = await response.json();
      
      if (!data.observations) return null;

      // Prepare data for Recharts (reverse to get ascending date)
      const chartData = data.observations.map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value)
      })).reverse();

      const currentVal = chartData[chartData.length - 1].value;
      
      // Calculate 3-period average for logic comparison
      const prevVals = chartData.slice(chartData.length - 4, chartData.length - 1);
      const avg3m = prevVals.reduce((sum, item) => sum + item.value, 0) / prevVals.length;

      return {
        ...idx,
        currentVal,
        displayValue: idx.format(currentVal),
        stressStatus: idx.isStress(currentVal, avg3m),
        chartData
      };
    } catch (e) {
      console.error(`Failed to fetch ${idx.id}`, e);
      return null;
    }
  }));

  const cleanData = results.filter(Boolean);

  return {
    props: {
      initialData: cleanData,
      lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  };
}