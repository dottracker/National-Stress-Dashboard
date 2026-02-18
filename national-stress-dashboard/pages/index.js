import Head from 'next/head';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { INDICES } from '../lib/indices';
import { AlertTriangle, CheckCircle, Activity, TrendingDown, TrendingUp } from 'lucide-react';

export default function Dashboard({ data, lastUpdated, defconLevel }) {
  
  // Helper to determine status color
  const getStatusColor = (isStressed) => isStressed ? "bg-red-500/20 border-red-500 text-red-500" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono selection:bg-red-900">
      <Head>
        <title>National Stress Dashboard</title>
      </Head>

      <div className="max-w-7xl mx-auto p-6">
        {/* HEADER & DEFCON LEVEL */}
        <header className="mb-10 border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-widest text-slate-100 flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-500" />
              US_Econ_Watch
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              System Last Updated: {lastUpdated}
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-widest">Aggregate Stress Level</div>
              <div className={`text-3xl font-bold ${defconLevel >= 4 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                DEFCON {5 - defconLevel}
              </div>
            </div>
            <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center font-bold text-xl border border-slate-700">
              {defconLevel}/5
            </div>
          </div>
        </header>

        {/* GRID OF INDICATORS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((item) => {
            const isStressed = item.stressStatus;
            return (
              <div key={item.id} className={`relative p-6 rounded-xl border ${isStressed ? 'border-red-900/50 bg-red-950/10' : 'border-slate-800 bg-slate-900/50'} transition-all hover:border-slate-600`}>
                
                {/* Header of Card */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500">{item.category}</span>
                    <h3 className="text-lg font-bold text-slate-100 mt-1">{item.name}</h3>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(isStressed)} flex items-center gap-1`}>
                    {isStressed ? <AlertTriangle size={12}/> : <CheckCircle size={12}/>}
                    {isStressed ? "WARNING" : "STABLE"}
                  </div>
                </div>

                {/* Main Value */}
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-4xl font-bold">{item.displayValue}</span>
                  <span className="text-xs text-slate-400 mb-1.5">{item.frequency}</span>
                </div>

                {/* Chart */}
                <div className="h-24 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={item.chartData}>
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} 
                        itemStyle={{ color: '#94a3b8' }}
                        labelStyle={{ display: 'none' }}
                        formatter={(value) => [value, 'Value']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={isStressed ? '#ef4444' : '#10b981'} 
                        strokeWidth={2} 
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Description Footer */}
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// SERVER SIDE DATA FETCHING
export async function getServerSideProps() {
  const apiKey = process.env.FRED_API_KEY;
  const baseUrl = 'https://api.stlouisfed.org/fred/series/observations';

  const results = await Promise.all(INDICES.map(async (idx) => {
    try {
      // Fetch last 12 months/periods of data
      const response = await fetch(
        `${baseUrl}?series_id=${idx.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=13`
      );
      const data = await response.json();
      
      if (!data.observations) return null;

      // Parse data for Chart
      // Reverse because FRED gives us desc (newest first), but charts need asc (oldest left)
      const chartData = data.observations.map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value)
      })).reverse();

      const currentVal = chartData[chartData.length - 1].value;
      
      // Calculate 3-month avg for comparison (excluding current)
      const prev3 = chartData.slice(chartData.length - 4, chartData.length - 1);
      const avg3m = prev3.reduce((sum, item) => sum + item.value, 0) / prev3.length;

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

  // Filter out failed fetches
  const cleanData = results.filter(Boolean);

  // Calculate System DEFCON (0 to 5, where 5 is max stress)
  // Logic: Count how many indicators are in stress.
  const stressCount = cleanData.filter(i => i.stressStatus).length;
  // Cap at 5
  const defconLevel = Math.min(stressCount, 5);

  return {
    props: {
      data: cleanData,
      lastUpdated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      defconLevel
    }
  };
}
