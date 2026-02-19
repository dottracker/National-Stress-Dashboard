import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { currentData, forceRefresh, userKey } = req.body;

  try {
    // --- STEP 1: AUTHORIZATION GATEKEEPER ---
    if (forceRefresh) {
      const allowedKeys = process.env.AUTHORIZED_REFRESH_KEYS?.split(',') || [];
      if (!userKey || !allowedKeys.includes(userKey)) {
        return res.status(401).json({ 
          error: "UNAUTHORIZED: Invalid Security Clearance Key." 
        });
      }
      console.log("Authorization Confirmed. Bypassing cache for fresh analysis...");
    }

    // --- STEP 2: CACHE LOOKUP (Only if NOT forcing refresh) ---
    if (!forceRefresh) {
      const { data: recentBrief, error: sbError } = await supabase
        .from('intel_briefs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentBrief) {
        const timeDiff = new Date() - new Date(recentBrief.created_at);
        const twelveHours = 12 * 60 * 60 * 1000;

        // If data is less than 12 hours old, serve it instantly
        if (timeDiff < twelveHours) {
          console.log("Serving cached intelligence...");
          return res.status(200).json({ 
            analysis: {
                briefing: recentBrief.briefing,
                reasoning: recentBrief.ai_reasoning,
                weights: recentBrief.weights,
                stress_score: recentBrief.stress_score,
                defcon_level: recentBrief.defcon_level
            }, 
            news: recentBrief.news_snapshot,
            cached: true 
          });
        }
      }
    }

    // 2. FETCH EXTERNAL SIGNALS (NEWS)
    const newsRes = await fetch(`https://newsapi.org/v2/everything?q=US%20Economy%20Recession&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY}`);
    const newsData = await newsRes.json();
    const headlines = newsData.articles?.slice(0, 5).map(a => a.title).join(" | ");

    // 3. GEMINI "QUANT ANALYST" PROMPT
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      You are a Senior Economic Intelligence Officer at the Pentagon. 
      DATA: ${JSON.stringify(currentData)}
      NEWS SIGNALS: ${headlines}

      TASK:
      1. Assign a STRESS_SCORE (0-100) where 0 is perfect growth and 100 is total systemic collapse.
      2. Decide the DEFCON level (1-5) based on this score (5 is healthy, 1 is emergency).
      3. Provide a 'briefing' (2 sentences for the President).
      4. Provide 'reasoning' (a brief technical explanation of why you chose this stress level).
      5. Update 'weights' (1-10) for each indicator based on current market sensitivity.

      OUTPUT VALID JSON ONLY:
      {
        "stress_score": number,
        "defcon_level": number,
        "briefing": "string",
        "reasoning": "string",
        "weights": { "SERIES_ID": number }
      }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(text);

    // 4. ARCHIVE TO SUPABASE
    await supabase.from('intel_briefs').insert([{
      briefing: analysis.briefing,
      ai_reasoning: analysis.reasoning,
      weights: analysis.weights,
      stress_score: analysis.stress_score,
      defcon_level: analysis.defcon_level,
      news_snapshot: newsData.articles
    }]);

    res.status(200).json({ analysis, news: newsData.articles, cached: false });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
