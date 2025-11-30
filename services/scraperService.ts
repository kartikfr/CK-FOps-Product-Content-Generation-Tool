import { ScrapedContent } from "../types";
import { scrapeContentWithGenAI } from "./geminiService";

// This service now delegates the "Scraping" task to Gemini with Search Grounding.
// This allows the frontend app to "read" any URL via the LLM's access to Google Search index.

export const scrapeUrl = async (url: string): Promise<ScrapedContent> => {
  try {
    // Call Gemini to get the content
    // This replaces the backend Selenium/Playwright scraper for this demo architecture
    const extractedText = await scrapeContentWithGenAI(url);

    // Simple heuristic to extract a title from the returned text
    // Usually the first line or a line starting with "Title:" is the title
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    let inferredTitle = "Scraped Page Content";
    
    // Attempt to find a title in the first few lines
    for(let i=0; i<Math.min(lines.length, 5); i++) {
        const line = lines[i];
        if (line.toLowerCase().startsWith('title:') || line.toLowerCase().startsWith('product name:')) {
            inferredTitle = line.replace(/^(Title:|Product Name:)/i, '').trim();
            break;
        }
        if (i === 0 && line.length < 100) {
            inferredTitle = line;
        }
    }

    return {
      url,
      title: inferredTitle,
      description: "Content extracted via Gemini AI Search Grounding",
      content: extractedText,
      h1: [inferredTitle],
      links: 0, // We don't count links in the AI summary
      status: 'success',
      metadata: {
        source: 'Gemini Search Grounding'
      }
    };
  } catch (error: any) {
    console.error("Scraper Service Error:", error);
    return {
      url,
      title: "Extraction Failed",
      description: "Could not retrieve content.",
      content: "",
      h1: [],
      links: 0,
      status: 'failed',
      error: error.message || "Failed to scrape URL via AI"
    };
  }
};