import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  LineChart, Line, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, AreaChart, Area 
} from 'recharts';
import { INDICES } from '../lib/indices'; 
import { 
  Activity, ShieldAlert, History, Sliders, RefreshCw, Server, Lock, Globe, Radio, Cpu, Zap
} from 'lucide-react';

export default function Dashboard({ initialData, lastUpdated }) {
  // --- STATE MANAGEMENT ---
  const [data, setData] = useState(initialData); 
  const [weights, setWeights] = useState({}); 
  const [analysis, setAnalysis] = useState(null); 
  const [news, setNews] = useState([]); 
  const [comparisonYear, setComparisonYear] = useState('2008'); 
  const [historicalData, setHistoricalData] = useState({});
  
  // UI States
  const [loadingAI, setLoadingAI] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock for the "Situation Room" feel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZoneName: 'short' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 1. INTELLIGENCE FETCHING LOGIC ---
  const fetchIntel = async (force = false) => {
    let key = null;

    if (force) {
      key = window.prompt("/// CLASSIFIED ///\nENTER AUTHENTICATION KEY:");
      if (!key) return; 
    }

    setIsRefreshing(true);
    setLoadingAI(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentData: initialData.map(d => ({ id: d.id, name: d.name, val: d.currentVal })),
          forceRefresh: force,
          userKey: key 
        })
      });
      
      const result = await res.json();

      if (res.status === 401) {
        alert(`ACCESS DENIED: ${result.error}`);
        setIsRefreshing(false);
        setLoadingAI(false);
        return;
      }
      
      if (result.analysis) {
        // FIX: Normalize the reasoning field (DB uses ai_reasoning, API uses reasoning)
        const normalizedAnalysis = {
          ...result.analysis,
          reasoning: result.analysis.ai_reasoning || result.analysis.reasoning || "Tactical assessment pending..."
        };

        setAnalysis(normalizedAnalysis);
        setNews(result.news || []);
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

  useEffect(() => { fetchIntel(false); }, []);

  // --- 2. HISTORICAL DATA ---
  useEffect(() => {
    const fetchHistory = async () => {
      const historyBuffer = {};
      await Promise.all(initialData.map(async (item) => {
        try {
          const res = await fetch(`/api/history?series_id=${item.id}&year=${comparisonYear}`);
          const json = await res.json();
          if (json.observations) {
            historyBuffer[item.id] = json.observations.map(obs => parseFloat(obs.value));
          }
        } catch (e) { console.error(e); }
      }));
      setHistoricalData(historyBuffer);
    };
    if (comparisonYear) fetchHistory();
  }, [comparisonYear]);

  // --- HELPER: CHART DATA ---
  const getChartData = (item) => {
    const current = item.chartData || [];
    const history = historicalData[item.id] || [];
    return current.map((point, i) => ({
      date: point.date,
      value: point.value,
      ghost: history[i] || null 
    }));
  };

  // --- HELPER: STRESS CALC ---
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
    <div className="min-h-screen bg-[#020617] text-cyan-500 font-mono overflow-x-hidden selection:bg-cyan-900 selection:text-white pb-12 relative">
      <Head>
        <title>SITUATION ROOM | DEFCON {currentDefcon}</title>
      </Head>

      {/* CRT SCANLINE EFFECT */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />

      {/* --- TOP HUD --- */}
      <nav className="border-b border-cyan-900/50 bg-[#0a0f16]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex justify-between items-center">
          
          {/* LEFT: LOGO */}
          <div className="flex items-center gap-4">
            <div className={`h-8 w-8 border border-cyan-500 flex items-center justify-center ${loadingAI ? 'animate-pulse bg-cyan-900/50' : 'bg-transparent'}`}>
              <Activity size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[0.2em] text-cyan-100 uppercase">National Stress Dashboard</h1>
              <div className="flex items-center gap-2 text-[10px] text-cyan-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                ONLINE // {currentTime}
              </div>
            </div>
          </div>
          
          {/* RIGHT: CONTROLS */}
          <div className="flex items-center gap-4">
            {isCached && (
              <div className="hidden md:flex items-center gap-2 text-[10px] text-emerald-500 bg-emerald-950/20 px-3 py-1 border border-emerald-900/50">
                <Server size={10} /> DATABASE_ARCHIVE
              </div>
            )}
            
            <button 
              onClick={() => fetchIntel(true)}
              disabled={isRefreshing}
              className={`flex items-center gap-2 text-[10px] px-4 py-2 border transition-all uppercase tracking-wider
                ${isRefreshing 
                  ? 'bg-amber-900/20 border-amber-600 text-amber-500 cursor-wait' 
                  : 'bg-cyan-950/30 border-cyan-800 hover:bg-cyan-900/50 hover:border-cyan-400 text-cyan-400'}`}
            >
              {isRefreshing ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
              {isRefreshing ? "DECRYPTING..." : "OVERRIDE"}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- LEFT COLUMN: DATA STREAMS (3 COLS) --- */}
        <aside className="lg:col-span-3 space-y-6">
          
          {/* DEFCON INDICATOR */}
          <div className="border border-cyan-900/50 bg-[#06090e] p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 p-2 text-[10px] text-cyan-800 tracking-widest">THREAT_LEVEL</div>
            <div className={`text-9xl font-black tracking-tighter z-10 ${
              currentDefcon === 1 ? 'text-red-600 animate-pulse drop-shadow-[0_0_20px_rgba(220,38,38,1)]' :
              currentDefcon <= 3 ? 'text-amber-500' : 'text-cyan-500'
            }`}>
              {currentDefcon}
            </div>
            <div className="w-full mt-4 bg-cyan-950 h-1">
              <div className={`h-full transition-all duration-1000 ${stressPercent > 75 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${stressPercent}%` }} />
            </div>
            <div className="flex justify-between w-full text-[10px] text-cyan-700 mt-1">
               <span>STABILITY</span>
               <span>{100 - Math.round(stressPercent)}%</span>
            </div>
          </div>

          {/* CONTROL PANEL */}
          <div className="border border-cyan-900/50 bg-[#06090e] p-4">
            <div className="flex items-center gap-2 mb-4 border-b border-cyan-900/30 pb-2">
              <Sliders size={14} />
              <h3 className="text-xs font-bold tracking-widest text-cyan-400">VECTOR WEIGHTING</h3>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {data.map(item => (
                <div key={item.id} className="group">
                  <div className="flex justify-between text-[9px] uppercase mb-1 text-cyan-600 group-hover:text-cyan-300">
                    <span>{item.name}</span>
                    <span>{weights[item.id] || 5}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" 
                    value={weights[item.id] || 5}
                    onChange={(e) => setWeights({...weights, [item.id]: parseInt(e.target.value)})}
                    className="w-full h-1 bg-cyan-950 rounded-none appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              ))}
            </div>
          </div>

           {/* GHOST LINE CONTROL */}
           <div className="border border-cyan-900/50 bg-[#06090e] p-4">
            <div className="flex items-center gap-2 mb-4 border-b border-cyan-900/30 pb-2">
              <History size={14} />
              <h3 className="text-xs font-bold tracking-widest text-cyan-400">EPOCH COMPARE</h3>
            </div>
            <select 
              value={comparisonYear}
              onChange={(e) => setComparisonYear(e.target.value)}
              className="w-full bg-cyan-950/20 border border-cyan-800 text-cyan-300 text-xs p-2 outline-none hover:border-cyan-500 focus:border-cyan-400 transition-colors uppercase"
            >
              <option value="2008">2008 // SUBPRIME</option>
              <option value="2020">2020 // PANDEMIC</option>
              <option value="2000">2000 // DOT_COM</option>
              <option value="1974">1974 // STAGFLATION</option>
            </select>
          </div>

        </aside>

        {/* --- CENTER: MAIN INTEL (9 COLS) --- */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* AI BRIEFING TERMINAL */}
          <div className="border border-cyan-800 bg-cyan-950/10 p-6 relative">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-cyan-500"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-cyan-500"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-cyan-500"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-cyan-500"></div>

            <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                 <Cpu size={16} className="text-cyan-400" />
                 <span className="text-xs font-bold tracking-[0.2em] text-cyan-100">INTELLIGENCE SUMMARY</span>
               </div>
               {loadingAI && <span className="text-[10px] animate-pulse text-amber-500">DECRYPTING SIGNAL...</span>}
            </div>

            <p className="text-lg md:text-xl text-cyan-50 font-mono leading-relaxed mb-6 border-l-2 border-cyan-700 pl-4">
              "{analysis?.briefing || "Awaiting uplink..."}"
            </p>

            <div className="bg-black/40 p-4 border border-cyan-900/50">
              <h4 className="text-[10px] text-cyan-600 uppercase font-bold mb-2 flex items-center gap-2">
                <Zap size={10} /> TACTICAL REASONING
              </h4>
              <p className="text-xs text-cyan-400/80 leading-relaxed font-mono">
                {/* FIX: Displays the normalized reasoning field */}
                {analysis?.reasoning || "Analyzing vector fields..."}
              </p>
            </div>
          </div>

          {/* METRIC GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((item) => {
              const chartData = getChartData(item);
              const isStressed = item.stressStatus;

              return (
                <div 
                  key={item.id} 
                  className={`relative p-4 border transition-all duration-300 group
                    ${isStressed 
                      ? 'bg-red-950/10 border-red-900/60' 
                      : 'bg-[#06090e] border-cyan-900/30 hover:border-cyan-600/50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] text-cyan-700 uppercase tracking-widest">{item.category}</span>
                    {isStressed ? <ShieldAlert size={14} className="text-red-500" /> : <div className="w-1.5 h-1.5 bg-cyan-500" />}
                  </div>
                  
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xs font-bold text-cyan-100 uppercase truncate pr-2">{item.name}</h3>
                    <span className={`text-xl font-bold ${isStressed ? 'text-red-500' : 'text-cyan-400'}`}>
                      {item.displayValue}
                    </span>
                  </div>

                  <div className="h-20 w-full opacity-80 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isStressed ? "#ef4444" : "#06b6d4"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isStressed ? "#ef4444" : "#06b6d4"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        {/* GHOST LINE */}
                        <Area 
                          type="monotone" 
                          dataKey="ghost" 
                          stroke="#334155" 
                          strokeWidth={1} 
                          fill="transparent"
                          strokeDasharray="2 2"
                          isAnimationActive={false}
                        />
                        {/* MAIN LINE */}
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke={isStressed ? "#ef4444" : "#06b6d4"} 
                          strokeWidth={2} 
                          fill={`url(#grad-${item.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* --- BOTTOM: OSINT TICKER BANNER --- */}
      <div className="fixed bottom-0 left-0 w-full h-10 bg-[#0a0f16] border-t border-cyan-900 z-50 flex items-center overflow-hidden">
        <div className="bg-cyan-900/30 h-full px-4 flex items-center justify-center border-r border-cyan-800 z-10">
          <Globe size={14} className="text-cyan-400 animate-pulse" />
          <span className="ml-2 text-[10px] font-bold text-cyan-100 tracking-widest hidden md:inline">GLOBAL_WIRE</span>
        </div>
        
        {/* CSS ANIMATION TICKER */}
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="whitespace-nowrap animate-marquee flex gap-12 text-xs font-mono text-cyan-400/80 px-4">
            {news.length > 0 ? news.map((n, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-cyan-700">///</span>
                <span className="font-bold text-cyan-200">{n.source.name}:</span>
                <span>{n.title}</span>
              </span>
            )) : (
              <span>ESTABLISHING SECURE CONNECTION TO NEWS WIRES... WAITING FOR SIGNAL...</span>
            )}
            {/* Duplicate for infinite loop effect */}
            {news.map((n, i) => (
              <span key={`dup-${i}`} className="flex items-center gap-2">
                <span className="text-cyan-700">///</span>
                <span className="font-bold text-cyan-200">{n.source.name}:</span>
                <span>{n.title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* GLOBAL STYLES FOR MARQUEE & SCROLLBAR */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 480s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #020617;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #155e75;
        }
      `}</style>
    </div>
  );
}

// --- SERVER SIDE PROPS (UNCHANGED LOGIC, JUST RE-INCLUDED FOR COMPLETENESS) ---
export async function getServerSideProps() {
  const apiKey = process.env.FRED_API_KEY;
  const baseUrl = 'https://api.stlouisfed.org/fred/series/observations';
  const { INDICES } = require('../lib/indices');

  const results = await Promise.all(INDICES.map(async (idx) => {
    try {
      const response = await fetch(
        `${baseUrl}?series_id=${idx.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=15`
      );
      const data = await response.json();
      if (!data.observations) return null;

      const chartData = data.observations.map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value)
      })).reverse();

      const currentVal = chartData[chartData.length - 1].value;
      const prevVals = chartData.slice(chartData.length - 4, chartData.length - 1);
      const avg3m = prevVals.reduce((sum, item) => sum + item.value, 0) / prevVals.length;

      return {
        ...idx,
        currentVal,
        displayValue: idx.format(currentVal),
        stressStatus: idx.isStress(currentVal, avg3m),
        chartData
      };
    } catch (e) { return null; }
  }));

  return {
    props: {
      initialData: results.filter(Boolean),
      lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  };
}
