// lib/indices.js

export const INDICES = [
  {
    id: 'T10Y2Y',
    name: 'Yield Curve (10Y-2Y)',
    category: 'Recession Signal',
    description: 'The difference between long and short term bonds. Negative = Recession Warning.',
    frequency: 'Daily',
    isStress: (current) => current < 0, // Stress if negative
    format: (val) => `${val.toFixed(2)}%`,
  },
  {
    id: 'SAHMREALTIME',
    name: 'Sahm Rule',
    category: 'Recession Signal',
    description: 'Real-time recession indicator based on unemployment.',
    frequency: 'Monthly',
    isStress: (current) => current >= 0.50, // Recession active if > 0.50
    format: (val) => `${val.toFixed(2)} pts`,
  },
  {
    id: 'PCU322211322211',
    name: 'Cardboard Box Index',
    category: 'Supply Chain',
    description: 'Price of corrugated boxes. Drops indicate slowing retail orders.',
    frequency: 'Monthly',
    isStress: (current, avg3m) => current < avg3m * 0.98, // Stress if drops 2% vs 3m avg
    format: (val) => val.toFixed(1),
  },
  {
    id: 'AWOTMAN',
    name: 'Manufacturing Overtime',
    category: 'Labor Market',
    description: 'Avg weekly overtime hours. The first thing cut before layoffs start.',
    frequency: 'Monthly',
    isStress: (current, avg3m) => current < avg3m * 0.95, // Stress if drops 5%
    format: (val) => `${val.toFixed(1)} hrs`,
  },
  {
    id: 'BAMLH0A0HYM2',
    name: 'High Yield Bond Spread',
    category: 'Financial Fear',
    description: 'Risk premium on "Junk Bonds". Spikes mean investors are scared of defaults.',
    frequency: 'Daily',
    isStress: (current, avg3m) => current > avg3m * 1.10, // Stress if spikes 10%
    format: (val) => `${val.toFixed(2)}%`,
  },
  {
    id: 'TRUCKD11',
    name: 'Truck Tonnage',
    category: 'Supply Chain',
    description: 'Weight of freight moved by truck. Captures real economic movement.',
    frequency: 'Monthly',
    isStress: (current, avg3m) => current < avg3m * 0.98,
    format: (val) => val.toFixed(1),
  },
  {
    id: 'DRCCLACBS',
    name: 'Credit Card Delinquency',
    category: 'Consumer Health',
    description: 'Delinquency rate on credit cards (commercial banks).',
    frequency: 'Quarterly',
    isStress: (current, avg3m) => current > avg3m * 1.05, // Rising delinquency is bad
    format: (val) => `${val.toFixed(2)}%`,
  },
  {
    id: 'VIXCLS',
    name: 'The VIX (Fear Index)',
    category: 'Financial Fear',
    description: 'Stock market volatility expectation.',
    frequency: 'Daily',
    isStress: (current) => current > 20, // >20 is elevated fear
    format: (val) => val.toFixed(1),
  }
];