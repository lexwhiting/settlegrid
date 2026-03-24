/**
 * settlegrid-sentiment-api — Sentiment Analysis MCP Server
 *
 * Provides text sentiment analysis with SettleGrid billing.
 * No external API key required (uses built-in analysis).
 *
 * Methods:
 *   analyze_sentiment(text)               (1¢)
 *   analyze_batch(texts)                  (2¢)
 *   get_keywords(text)                    (2¢)
 *   analyze_emotion(text)                 (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface TextInput { text: string }
interface BatchInput { texts: string[] }

const POSITIVE_WORDS = new Set(["good","great","excellent","amazing","wonderful","fantastic","love","happy","best","awesome","perfect","beautiful","outstanding","brilliant","superb","delightful","pleasant","enjoyable","marvelous","terrific"])
const NEGATIVE_WORDS = new Set(["bad","terrible","awful","horrible","hate","worst","ugly","poor","disappointing","dreadful","miserable","disgusting","annoying","boring","pathetic","lousy","appalling","atrocious","abysmal","vile"])
const EMOTION_WORDS: Record<string, string[]> = {
  joy: ["happy","joy","delight","pleased","cheerful","excited","thrilled","elated"],
  anger: ["angry","furious","rage","mad","irritated","outraged","livid","hostile"],
  sadness: ["sad","depressed","unhappy","grief","sorrow","heartbroken","miserable","gloomy"],
  fear: ["afraid","scared","terrified","anxious","worried","frightened","panic","dread"],
  surprise: ["surprised","amazed","astonished","shocked","stunned","startled","unexpected"],
}

function analyzeSentimentScore(text: string): { score: number; label: string; confidence: number } {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/)
  let pos = 0, neg = 0
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) pos++
    if (NEGATIVE_WORDS.has(w)) neg++
  }
  const total = Math.max(pos + neg, 1)
  const score = (pos - neg) / total
  const confidence = Math.min((pos + neg) / Math.max(words.length, 1) * 5, 1)
  const label = score > 0.1 ? "positive" : score < -0.1 ? "negative" : "neutral"
  return { score: Math.round(score * 100) / 100, label, confidence: Math.round(confidence * 100) / 100 }
}

const sg = settlegrid.init({
  toolSlug: "sentiment-api",
  pricing: {
    defaultCostCents: 1,
    methods: {
      analyze_sentiment: { costCents: 1, displayName: "Analyze text sentiment" },
      analyze_batch: { costCents: 2, displayName: "Batch sentiment analysis" },
      get_keywords: { costCents: 2, displayName: "Extract keywords with sentiment" },
      analyze_emotion: { costCents: 2, displayName: "Detect emotions in text" },
    },
  },
})

const analyzeSentiment = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const result = analyzeSentimentScore(args.text)
  return { text: args.text.slice(0, 100), ...result }
}, { method: "analyze_sentiment" })

const analyzeBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.texts) || args.texts.length === 0) throw new Error("texts array is required")
  if (args.texts.length > 100) throw new Error("Maximum 100 texts per batch")
  const results = args.texts.map((text) => ({ text: text.slice(0, 50), ...analyzeSentimentScore(text) }))
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length
  return { count: results.length, average_score: Math.round(avg * 100) / 100, results }
}, { method: "analyze_batch" })

const getKeywords = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const words = args.text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 3)
  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1
  const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({
    word, count, sentiment: POSITIVE_WORDS.has(word) ? "positive" : NEGATIVE_WORDS.has(word) ? "negative" : "neutral",
  }))
  return { keywords }
}, { method: "get_keywords" })

const analyzeEmotion = sg.wrap(async (args: TextInput) => {
  if (!args.text || typeof args.text !== "string") throw new Error("text is required")
  const words = args.text.toLowerCase().split(/\s+/)
  const emotions: Record<string, number> = {}
  for (const [emotion, emotionWords] of Object.entries(EMOTION_WORDS)) {
    emotions[emotion] = words.filter((w) => emotionWords.includes(w)).length
  }
  const dominant = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]
  return { emotions, dominant: dominant[1] > 0 ? dominant[0] : "neutral" }
}, { method: "analyze_emotion" })

export { analyzeSentiment, analyzeBatch, getKeywords, analyzeEmotion }

console.log("settlegrid-sentiment-api MCP server ready")
console.log("Methods: analyze_sentiment, analyze_batch, get_keywords, analyze_emotion")
console.log("Pricing: 1-2¢ per call | Powered by SettleGrid")
