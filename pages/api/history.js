export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, series_id } = req.query;
  const apiKey = process.env.FRED_API_KEY;

  if (!series_id || !year) {
    return res.status(400).json({ error: 'Missing series_id or year parameter' });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&observation_end=${endDate}&sort_order=asc`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FRED API returned status ${response.status}`);
    }
    const data = await response.json();
    
    const observations = (data.observations || [])
      .map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value)
      }))
      .filter(obs => !isNaN(obs.value));

    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).json({ series_id, year, observations });
  } catch (error) {
    console.error("History fetch error:", error);
    return res.status(500).json({ error: 'Failed to fetch historical series data' });
  }
}
