import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { calculatedScore, defconLevel, indicatorStates, forceRefresh, userKey } = req.body;

  try {
    // 1. Authorization Gatekeeper
    if (forceRefresh) {
      const allowedKeys = process.env.AUTHORIZED_REFRESH_KEYS?.split(',') || [];
      if (!userKey || !allowedKeys.includes(userKey)) {
        return res.status(401).json({ error: "UNAUTHORIZED: Invalid Security Clearance Key." });
      }
    }

    // 2. Cache Check (12-hour window)
    if (!forceRefresh) {
      const { data: recentBrief } = await supabase
        .from('intel_briefs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentBrief) {
        const timeDiff = new Date() - new Date(recentBrief.created_at);
        if (timeDiff < 12 * 60 * 60 * 1000) {
          return res.status(200).json({
            analysis: {
              briefing: recentBrief.briefing,
              reasoning: recentBrief.ai_reasoning,
              stress_score: recentBrief.stress_score,
              defcon_level: recentBrief.defcon_level
            },
            news: recentBrief.news_snapshot || [],
            cached: true
          });
        }
      }
    }

    // 3. Fetch External Signals (NewsAPI)
    let articles = [];
    try {
      const newsRes = await fetch(
        `https://newsapi.org/v2/everything?q=US%20Economy%20Recession%20OR%20Inflation&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
      );
      const newsData = await newsRes.json();
      articles = newsData.articles || [];
    } catch (e) {
      console.error("News fetch failed:", e);
    }

    const headlines = articles.map(a => `${a.source.name}: ${a.title}`).join(" | ");

    // 4. Gemini Strategic Assessment Synthesis
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are the Chief Macroeconomic Intelligence Officer for the Joint Chiefs of Staff.
      
      QUANTITATIVE AGGREGATE METRICS:
      - Calculated Recession Risk Score: ${calculatedScore}%
      - Current Threat Level: DEFCON ${defconLevel}
      - Metric Breakdown: ${JSON.stringify(indicatorStates)}
      - Real-time News Feeds: ${headlines || "No signals"}

      TASK:
      Generate an executive briefing based on the calculated quantitative status above.
      Do not alter the score or DEFCON level. Synthesize the findings.

      JSON OUTPUT STRUCTURE:
      {
        "briefing": "Direct 2-sentence executive summary for the White House Situation Room.",
        "reasoning": "Technical 3-4 sentence macro analysis referencing Sahm rule, yield curve, or credit spreads."
      }
    `;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    const finalPayload = {
      briefing: parsed.briefing,
      reasoning: parsed.reasoning,
      stress_score: calculatedScore,
      defcon_level: defconLevel
    };

    // 5. Store in Supabase
    try {
      await supabase.from('intel_briefs').insert([{
        briefing: finalPayload.briefing,
        ai_reasoning: finalPayload.reasoning,
        stress_score: calculatedScore,
        defcon_level: defconLevel,
        news_snapshot: articles
      }]);
    } catch (dbErr) {
      console.error("Database archive write failed:", dbErr);
    }

    return res.status(200).json({ analysis: finalPayload, news: articles, cached: false });

  } catch (error) {
    console.error("API handler failure:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
