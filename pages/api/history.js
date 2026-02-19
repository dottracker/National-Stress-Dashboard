// pages/api/history.js
export default async function handler(req, res) {
  const { year, series_id } = req.query;
  const apiKey = process.env.FRED_API_KEY;
  // Fetch data for that specific year (e.g., 2008-01-01 to 2008-12-31)
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${apiKey}&file_type=json&observation_start=${year}-01-01&observation_end=${year}-12-31`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}