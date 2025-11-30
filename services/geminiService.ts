import { GoogleGenAI } from "@google/genai";

// Using Gemini 2.5 Flash - The current state-of-the-art for high-speed, high-accuracy text processing.
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Helper to get the Gemini Client, prioritizing the user's local key.
 */
const getGenAIClient = () => {
  const userKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const apiKey = userKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set it in the Settings.");
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * Uses Gemini with Google Search grounding to simulate a web scrape.
 * This allows the model to "read" the page content via search results and knowledge.
 */
export const scrapeContentWithGenAI = async (url: string): Promise<string> => {
  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `
      Role: Expert Web Scraper & SEO Analyst.
      Task: Access the live URL: "${url}" and perform a comprehensive content extraction.

      STRICT EXTRACTION RULES:
      1. **Full Fidelity**: Extract ALL available text content, including main body, technical specifications, product details, pricing, and FAQ.
      2. **SEO Metadata**: Explicitly look for and extract the Page Title, Meta Description, and H1 tags.
      3. **Structure**: Maintain the original logical hierarchy of the page (Headers -> Subheaders -> Content).
      4. **No Hallucinations**: Only output information present on the page or in the search index. If a specific detail is missing, state "Not specified".
      
      OUTPUT FORMAT:
      PAGE_TITLE: <Exact Page Title>
      META_DESCRIPTION: <Meta Description>
      MAIN_CONTENT:
      <Full structured content>
      TECHNICAL_SPECS:
      <Table or list of specs>
      REVIEWS_SUMMARY:
      <Brief summary of user sentiment if available>
      `,
      config: {
        tools: [{googleSearch: {}}], // Critical: Enables access to live web info
      }
    });

    return response.text || "Unable to extract content from this URL. It may be blocked or not indexed.";
  } catch (error: any) {
    console.error("Gemini Scraping Error:", error);
    // Provide a more helpful error if it's likely an auth issue
    if (error.message?.includes('API key')) {
        return "Error: Invalid or missing API Key. Please check your settings.";
    }
    return `Error accessing page: ${error.message}. Please check the URL.`;
  }
};

export const transformContent = async (
  content: string, 
  userPrompt: string,
  sampleFileContent?: string,
  modelName: string = MODEL_NAME
): Promise<string> => {
  try {
    const ai = getGenAIClient();
    let transformationInstructions = "";
    
    // Check if the user specifically asked for Markdown
    const isMarkdownRequested = userPrompt.toLowerCase().includes('markdown');
    
    // Logic to determine strictness of template following
    if (sampleFileContent) {
        transformationInstructions = `
        ### CRITICAL: SAMPLE FILE MAPPING
        The user has provided a SAMPLE FILE (below). You act as a migration engine.
        Your ONLY Goal: Map the "Source Content" into the EXACT structure of the "Sample File".
        
        - If Sample is CSV: output ONLY CSV rows matching headers.
        - If Sample is JSON: output ONLY valid JSON matching keys.
        - If Sample is Text/List: Match the tone, bullet style, and spacing exactly.

        --- SAMPLE FILE START ---
        ${sampleFileContent.substring(0, 10000)}
        --- SAMPLE FILE END ---
        
        ### USER CONFIGURATION NOTES:
        "${userPrompt || "Follow the sample file structure precisely."}"
        `;
    } else {
        // If no sample file, ensure the user prompt is treated as the absolute source of truth
        transformationInstructions = `
        ### CRITICAL: USER CONFIGURATION
        The user has provided the following specific prompt. Follow it to the letter.
        
        USER PROMPT:
        "${userPrompt || "Clean up the content, remove navigation/footer noise, and format it professionally."}"
        
        FORMATTING RULES:
        ${isMarkdownRequested ? 
          "- Use standard Markdown formatting (bold, headers, tables)." : 
          "- OUTPUT PURE PLAIN TEXT. Do NOT use Markdown characters like asterisks (**), hashes (#), or underscores (_). Use CAPITALIZATION for headers and simple spacing."
        }
        `;
    }

    const fullPrompt = `
      You are an elite AI Data Processor powered by Gemini 2.5.
      Your task is to transform raw web content into a perfectly formatted final deliverable.

      --- SOURCE CONTENT (Scraped) ---
      ${content.substring(0, 30000)} ${content.length > 30000 ? '...(truncated)' : ''}
      --- END SOURCE CONTENT ---
      
      --- INSTRUCTIONS ---
      ${transformationInstructions}
      
      --- QUALITY ASSURANCE RULES ---
      1. **Zero Fluff**: Do not say "Here is the data". Start immediately with the output.
      2. **Data Integrity**: Do not make up facts. If a field from the sample file isn't found in the source, leave it blank or write "N/A".
      3. **Clean Output**: 
         - Trim all leading/trailing whitespace.
         - Ensure the output looks like it was written by a human expert.
         - ${isMarkdownRequested ? "Keep structure." : "STRIP all markdown symbols (**bold**, ## header)."}
      
      GENERATE FINAL OUTPUT:
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        temperature: 0.1, // Minimal creativity, maximum adherence to rules
      }
    });

    let text = response.text || "";
    
    // Post-processing to guarantee clean output
    // 1. Remove markdown code blocks if the model ignored the rule
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');

    // 2. Strict Character Cleanup (unless markdown was requested)
    if (!isMarkdownRequested && !sampleFileContent) {
        text = text
            // Remove **bold**
            .replace(/\*\*/g, '')
            // Remove __italics__
            .replace(/__/g, '')
            // Remove ## Headers (replace with just the text)
            .replace(/^#+\s/gm, '')
            // Remove single * bullets if they are just formatting (optional, usually better to keep as -)
            .replace(/^\* /gm, '- ')
            // Clean up double spaces
            .replace(/  +/g, ' ');
    }

    // 3. Trim whitespace
    const cleanedText = text.trim(); 

    return cleanedText || "No content generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to transform content");
  }
};

export const generateSummary = async (content: string): Promise<string> => {
    return transformContent(content, "Provide a concise 2-sentence summary of this content.");
};