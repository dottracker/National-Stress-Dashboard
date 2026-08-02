export const INDICES = [
  {
    id: 'UNRATE',
    name: 'Unemployment Rate (Sahm Rule Proxy)',
    category: 'LABOR MARKET',
    unit: '%',
    format: (v) => `${v.toFixed(1)}%`,
    description: 'Tracks labor market weakening. Sahm Rule triggers when 3mo avg rises 0.50% above 12mo low.',
    evalStress: (data) => {
      // Calculate Sahm Rule threshold
      if (data.length < 12) return { stressed: false, score: 0 };
      const values = data.map(d => d.value);
      const current3moAvg = (values[0] + values[1] + values[2]) / 3;
      const min12mo = Math.min(...values.slice(0, 12));
      const sahmValue = current3moAvg - min12mo;
      return {
        stressed: sahmValue >= 0.5,
        score: Math.min(Math.max((sahmValue / 0.5) * 25, 0), 30), // Max 30 pts weight
        meta: `Sahm Indicator: +${sahmValue.toFixed(2)}%`
      };
    }
  },
  {
    id: 'T10Y2Y',
    name: '10Y-2Y Treasury Spread',
    category: 'CREDIT / YIELD',
    unit: 'bps',
    format: (v) => `${(v * 100).toFixed(0)} bps`,
    description: 'Yield curve inversion historically precedes recessions by 10 to 18 months.',
    evalStress: (data) => {
      const val = data[0]?.value || 0;
      const isInverted = val < 0;
      const score = val < 0 ? 25 : val < 0.2 ? 10 : 0;
      return {
        stressed: isInverted,
        score,
        meta: isInverted ? 'CURVE INVERTED' : 'NORMAL'
      };
    }
  },
  {
    id: 'STLFSI3',
    name: 'St. Louis Financial Stress Index',
    category: 'SYSTEMIC RISK',
    unit: 'pts',
    format: (v) => v.toFixed(2),
    description: 'Measures financial market strain across 18 daily data series.',
    evalStress: (data) => {
      const val = data[0]?.value || 0;
      const stressed = val > 0; // 0 is average market stress
      const score = Math.min(Math.max(val * 15 + 10, 0), 25);
      return { stressed, score, meta: val > 0 ? 'ABOVE AVERAGE STRESS' : 'STABLE' };
    }
  },
  {
    id: 'BAMLH0A0HYM2',
    name: 'US High Yield Option-Adjusted Spread',
    category: 'CREDIT MARKETS',
    unit: '%',
    format: (v) => `${v.toFixed(2)}%`,
    description: 'Spreads widen sharply when corporate default expectations spike.',
    evalStress: (data) => {
      const val = data[0]?.value || 0;
      const stressed = val > 5.0; // High yield spread spike
      const score = val > 6.0 ? 20 : val > 4.5 ? 10 : 0;
      return { stressed, score, meta: `${val.toFixed(2)}% Credit Premium` };
    }
  },
  {
    id: 'UMCSENT',
    name: 'Univ. of Michigan Consumer Sentiment',
    category: 'CONSUMER DEMAND',
    unit: 'pts',
    format: (v) => v.toFixed(1),
    description: 'Consumer confidence drives ~70% of US GDP.',
    evalStress: (data) => {
      const val = data[0]?.value || 100;
      const stressed = val < 65;
      const score = val < 60 ? 15 : val < 70 ? 8 : 0;
      return { stressed, score, meta: val < 65 ? 'DEPRESSED SENTIMENT' : 'HEALTHY' };
    }
  }
];
