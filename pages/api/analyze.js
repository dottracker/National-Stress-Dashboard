import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { currentData, forceRefresh, userKey, quantitativeScore, defconLevel } = req.body;

  try {
    // 1. Authorization Verification for Force Refresh
    if (forceRefresh) {
      const allowedKeys = process.env.AUTHORIZED_REFRESH_KEYS?.split(',').map(k => k.trim()) || [];
      if (!userKey || !allowedKeys.includes(userKey)) {
        return res.status(401).json({ 
          error: "SECURITY ALERT: Clearance Key Invalid or Access Revoked." 
        });
      }
    }

    // 2. Cache Lookup (12-hour expiration)
    if (!forceRefresh) {
      const { data: recentBrief, error: sbError } = await supabase
        .from('intel_briefs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentBrief && !sbError) {
        const timeDiff = new Date() - new Date(recentBrief.created_at);
        const twelveHours = 12 * 60 * 60 * 1000;

        if (timeDiff < twelveHours) {
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

    // 3. News Signals Fetching
    let newsArticles = [];
    try {
      const newsRes = await fetch(
        `https://newsapi.org/v2/everything?q=US%20Economy%20AND%20(Recession%20OR%20Fed%20OR%20Inflation)&sortBy=publishedAt&pageSize=6&apiKey=${process.env.NEWS_API_KEY}`
      );
      const newsData = await newsRes.json();
      newsArticles = (newsData.articles || []).map(a => ({
        title: a.title,
        source: { name: a.source?.name || 'OSINT WIRE' },
        publishedAt: a.publishedAt,
        url: a.url
      }));
    } catch (newsErr) {
      console.error("News wire connection error:", newsErr);
    }

    const headlinesText = newsArticles.map(a => `[${a.source.name}] ${a.title}`).join(" | ");

    // 4. Gemini 2.5 Structured Output Prompt
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are the Chief Economic Intelligence Officer in the White House Situation Room.
      
      MATHEMATICAL MACRO MODEL DATA:
      - Composite Recession Probability Score: ${quantitativeScore}%
      - Current DEFCON Status: DEFCON ${defconLevel}
      - Core Indicator States: ${JSON.stringify(currentData)}
      - Real-Time Global OSINT News Wire: ${headlinesText || "No active signals."}

      INSTRUCTIONS:
      1. Write a direct 2-sentence executive summary briefing for the President.
      2. Write a precise 3-4 sentence tactical reasoning section detailing why the indicators triggered these threat levels (mention Sahm Rule, yield curve, or credit spreads if relevant).

      OUTPUT FORMAT MUST BE EXACT JSON:
      {
        "briefing": "string",
        "reasoning": "string"
      }
    `;

    const result = await model.generateContent(prompt);
    const parsedText = result.response.text().trim();
    const analysisJson = JSON.parse(parsedText);

    const fullAnalysisPayload = {
      briefing: analysisJson.briefing,
      reasoning: analysisJson.reasoning,
      stress_score: quantitativeScore,
      defcon_level: defconLevel
    };

    // 5. Database Archive Update
    try {
      await supabase.from('intel_briefs').insert([{
        briefing: fullAnalysisPayload.briefing,
        ai_reasoning: fullAnalysisPayload.reasoning,
        stress_score: quantitativeScore,
        defcon_level: defconLevel,
        news_snapshot: newsArticles
      }]);
    } catch (dbErr) {
      console.error("Supabase archiving failed:", dbErr);
    }

    return res.status(200).json({ 
      analysis: fullAnalysisPayload, 
      news: newsArticles, 
      cached: false 
    });

  } catch (error) {
    console.error("Intel Handler Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate intelligence report" });
  }
}
