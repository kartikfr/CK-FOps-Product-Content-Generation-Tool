import { GoogleGenAI } from "@google/genai";

// Initialize the client. 
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Uses Gemini with Google Search grounding to simulate a web scrape.
 * This allows the model to "read" the page content via search results and knowledge.
 */
export const scrapeContentWithGenAI = async (url: string): Promise<string> => {
  try {
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
    let transformationInstructions = "";
    
    // Check if the user specifically asked for Markdown
    const isMarkdownRequested = userPrompt.toLowerCase().includes('markdown');
    
    // Logic to determine strictness of template following
    if (sampleFileContent) {
        transformationInstructions = `
        CONTEXT: The user has provided a SAMPLE FILE CONTENT (below) to define the exact output format.
        TASK: Extract data from the Source Content and format it EXACTLY like the Sample File.
        
        --- SAMPLE FILE START ---
        ${sampleFileContent.substring(0, 10000)}
        --- SAMPLE FILE END ---
        
        USER NOTES:
        ${userPrompt || "Follow the sample file structure precisely. Do not deviate from the columns/keys."}
        `;
    } else {
        // If no sample file, ensure the user prompt is treated as the absolute source of truth
        transformationInstructions = `
        TASK: Transform the Source Content according to these instructions:
        "${userPrompt || "Clean up the content, remove navigation/footer noise, and format it professionally."}"
        
        FORMATTING RULES:
        ${isMarkdownRequested ? 
          "- Use standard Markdown formatting (bold, headers, tables)." : 
          "- OUTPUT PURE PLAIN TEXT. Do NOT use Markdown characters like asterisks (**), hashes (#), or underscores (_). Use CAPITALIZATION for headers and simple spacing."
        }
        `;
    }

    const fullPrompt = `
      You are a professional Content Editor and Data Extraction Engine.
      Your goal is to produce a "Final Polish" version of the content that is ready to be copy-pasted directly into a final report, CMS, or Excel sheet.

      --- SOURCE CONTENT ---
      ${content.substring(0, 30000)} ${content.length > 30000 ? '...(truncated)' : ''}
      --- END SOURCE CONTENT ---
      
      --- INSTRUCTIONS ---
      ${transformationInstructions}
      
      --- STRICT OUTPUT RULES (CRITICAL) ---
      1. **Final Deliverable Only**: Output ONLY the result. Do NOT include conversational filler like "Here is the transformed text", "Sure", "Output:", "Based on your request...".
      2. **No Markdown Fences**: If the user asks for CSV or JSON, return RAW text. Do NOT wrap it in \`\`\`csv or \`\`\`json. 
      3. **Whitespace Control**: 
         - Remove all leading and trailing whitespace.
         - Remove unrequested "Title:" headers at the top. Start directly with the content.
         - Ensure consistent spacing between paragraphs (max 1 blank line).
      4. **Cleanliness**: 
         - ${isMarkdownRequested ? "Keep markdown syntax." : "REMOVE all **bold** markers, ## header markers, and __italics__ markers. The output must be clean text."}
      5. **No Hallucination**: Do not invent data not present in the Source Content.
      
      Begin generation:
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config: {
        temperature: 0.2, // Low temperature for high adherence to structure
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