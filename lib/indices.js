export const INDICES = [
  {
    id: 'UNRATE',
    name: 'Civilian Unemployment (Sahm Rule)',
    category: 'LABOR DYNAMICS',
    unit: '%',
    defaultWeight: 9,
    format: (v) => `${v.toFixed(1)}%`,
    description: 'Tracks labor market weakening. Sahm Rule triggers when 3-month moving average rises 0.50% above 12-month low.',
    evalStress: (data) => {
      if (!data || data.length < 12) return { stressed: false, score: 0, delta: 0, meta: 'INSUFFICIENT DATA' };
      const values = data.map(d => d.value);
      const current3moAvg = (values[0] + values[1] + values[2]) / 3;
      const min12mo = Math.min(...values.slice(0, 12));
      const sahmValue = current3moAvg - min12mo;
      const isStressed = sahmValue >= 0.50;
      const score = Math.min(Math.max((sahmValue / 0.50) * 100, 0), 100);
      return {
        stressed: isStressed,
        score,
        delta: sahmValue,
        meta: `Sahm Spread: +${sahmValue.toFixed(2)}% ${isStressed ? '[TRIGGERED]' : '[NOMINAL]'}`
      };
    }
  },
  {
    id: 'T10Y2Y',
    name: '10Y - 2Y Treasury Yield Spread',
    category: 'CREDIT / YIELD CURVE',
    unit: 'bps',
    defaultWeight: 10,
    format: (v) => `${(v * 100).toFixed(0)} bps`,
    description: 'Yield curve inversion (negative spread) historically precedes US recessions by 10 to 18 months.',
    evalStress: (data) => {
      if (!data || data.length === 0) return { stressed: false, score: 0, delta: 0, meta: 'N/A' };
      const val = data[0].value;
      const prev = data[1]?.value || val;
      const isInverted = val < 0;
      let score = 0;
      if (val < -0.50) score = 100;
      else if (val < 0) score = 75;
      else if (val < 0.20) score = 40;
      return {
        stressed: isInverted,
        score,
        delta: val - prev,
        meta: isInverted ? 'INVERTED CURVE WARNING' : 'NORMAL SLOPE'
      };
    }
  },
  {
    id: 'STLFSI3',
    name: 'St. Louis Financial Stress Index',
    category: 'SYSTEMIC STABILITY',
    unit: 'pts',
    defaultWeight: 8,
    format: (v) => v.toFixed(2),
    description: 'Measures financial market strain across 18 daily series (0 represents normal market conditions).',
    evalStress: (data) => {
      if (!data || data.length === 0) return { stressed: false, score: 0, delta: 0, meta: 'N/A' };
      const val = data[0].value;
      const prev = data[1]?.value || val;
      const isStressed = val > 0.5;
      const score = Math.min(Math.max(((val + 1) / 3) * 100, 0), 100);
      return {
        stressed: isStressed,
        score,
        delta: val - prev,
        meta: val > 0 ? `ABOVE AVG STRESS (+${val.toFixed(2)})` : `NORMAL MARKET STRESS (${val.toFixed(2)})`
      };
    }
  },
  {
    id: 'BAMLH0A0HYM2',
    name: 'US High Yield Option-Adjusted Spread',
    category: 'CREDIT RISK',
    unit: '%',
    defaultWeight: 8,
    format: (v) => `${v.toFixed(2)}%`,
    description: 'Measures risk premium required for high-yield corporate bonds. Spreads spike before default cycles.',
    evalStress: (data) => {
      if (!data || data.length === 0) return { stressed: false, score: 0, delta: 0, meta: 'N/A' };
      const val = data[0].value;
      const prev = data[1]?.value || val;
      const isStressed = val > 5.0;
      let score = 0;
      if (val > 6.0) score = 100;
      else if (val > 4.5) score = 60;
      else if (val > 3.5) score = 25;
      return {
        stressed: isStressed,
        score,
        delta: val - prev,
        meta: `${val.toFixed(2)}% Corporate Risk Premium`
      };
    }
  },
  {
    id: 'ICSA',
    name: 'Initial Jobless Claims (4-Wk Avg Proxy)',
    category: 'LABOR DYNAMICS',
    unit: 'k',
    defaultWeight: 7,
    format: (v) => `${(v / 1000).toFixed(0)}k`,
    description: 'High-frequency weekly metric tracking layoffs and immediate labor market dislocations.',
    evalStress: (data) => {
      if (!data || data.length < 4) return { stressed: false, score: 0, delta: 0, meta: 'N/A' };
      const val = data[0].value;
      const avg4wk = data.slice(0, 4).reduce((a, b) => a + b.value, 0) / 4;
      const isStressed = avg4wk > 260000;
      const score = Math.min(Math.max(((avg4wk - 200000) / 100000) * 100, 0), 100);
      return {
        stressed: isStressed,
        score,
        delta: val - data[1].value,
        meta: `4-Wk Avg: ${(avg4wk / 1000).toFixed(0)}k Claims`
      };
    }
  },
  {
    id: 'UMCSENT',
    name: 'Univ. of Michigan Consumer Sentiment',
    category: 'CONSUMER DEMAND',
    unit: 'pts',
    defaultWeight: 6,
    format: (v) => v.toFixed(1),
    description: 'Tracks US consumer confidence and spending expectations, driving ~70% of US GDP.',
    evalStress: (data) => {
      if (!data || data.length === 0) return { stressed: false, score: 0, delta: 0, meta: 'N/A' };
      const val = data[0].value;
      const prev = data[1]?.value || val;
      const isStressed = val < 65.0;
      let score = 0;
      if (val < 55.0) score = 100;
      else if (val < 65.0) score = 65;
      else if (val < 75.0) score = 30;
      return {
        stressed: isStressed,
        score,
        delta: val - prev,
        meta: val < 65.0 ? 'DEPRESSED CONSUMER CONFIDENCE' : 'HEALTHY CONSUMER DEMAND'
      };
    }
  }
];
