import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function analyzeIntent(
  userMessage: string,
  botLastMessage: string | null
): Promise<'OPT_OUT' | 'PROPERTY_INQUIRY' | 'TECH_SERVICES' | 'UNKNOWN'> {
  if (!genAI) {
    console.warn("GEMINI_API_KEY not set. Defaulting to UNKNOWN intent.");
    if (userMessage.toLowerCase().trim() === 'no' || userMessage.toLowerCase().includes('stop')) return 'OPT_OUT';
    return 'UNKNOWN';
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are an intent classifier for a real estate and technical solutions brokerage.
The bot last said: "${botLastMessage || 'Nothing'}"
The user replied: "${userMessage}"

Classify the user's intent into exactly ONE of these categories:
- OPT_OUT: User says "No", declines to continue, or asks to stop/pause messages.
- PROPERTY_INQUIRY: User asks about property, 3BHK, rent, buying, listings, etc.
- TECH_SERVICES: User asks about tech, CCTV installation, wiring, etc.
- UNKNOWN: Anything else, like general greetings or unrelated topics.

Output ONLY a raw JSON object, no markdown formatting or backticks. Example:
{"intent": "OPT_OUT"}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    try {
      const parsed = JSON.parse(text);
      if (parsed.intent) return parsed.intent;
    } catch (e) {
      // Handle cases where model outputs markdown block despite instructions
      if (text.includes("OPT_OUT")) return 'OPT_OUT';
      if (text.includes("PROPERTY_INQUIRY")) return 'PROPERTY_INQUIRY';
      if (text.includes("TECH_SERVICES")) return 'TECH_SERVICES';
    }
    
    return 'UNKNOWN';
  } catch (err) {
    console.error("Intent analysis failed:", err);
    if (userMessage.toLowerCase().trim() === 'no') return 'OPT_OUT';
    return 'UNKNOWN';
  }
}

export async function getAutomatedResponse(
  incomingMessage: string,
  history: { direction: string; message_content: string }[],
  contactInfo: { name?: string; dealValue?: string; activeFlow?: string }
): Promise<string | null> {
  if (!genAI) {
    console.warn("GEMINI_API_KEY not set. Using fallback logic.");
    return fallbackResponse(incomingMessage, contactInfo);
  }

  try {
    let systemInstruction = "You are a professional assistant for a real estate and technical solutions brokerage.\n";
    systemInstruction += "Rules:\n";
    systemInstruction += "- Keep responses under 2 sentences.\n";
    systemInstruction += "- Be direct and professional.\n";
    
    if (contactInfo.activeFlow === "Property Inquiry Flow") {
      systemInstruction += "- If the user asks about property listings, ask for their budget and preferred location.\n";
    } else if (contactInfo.activeFlow === "Tech Services Flow") {
      systemInstruction += "- If the user asks about technical services (like CCTV), ask what type of installation they need and their location.\n";
    } else {
      systemInstruction += "- If the user asks general questions, guide them to specify if they need real estate or tech services.\n";
    }

    if (contactInfo.name) {
      systemInstruction += `\nLead Context:\n- Name: ${contactInfo.name}\n`;
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction 
    });

    // Limit history to last 5 messages to avoid token issues and keep relevance
    const recentHistory = history.slice(-5);
    
    const chatHistory = recentHistory.map(msg => ({
      role: msg.direction === 'INBOUND' ? 'user' : 'model',
      parts: [{ text: msg.message_content || ' ' }]
    }));

    const chat = model.startChat({
      history: chatHistory
    });

    const result = await chat.sendMessage(incomingMessage);
    return result.response.text();
    
  } catch (err) {
    console.error("Gemini Response Generation Failed:", err);
    return fallbackResponse(incomingMessage, contactInfo);
  }
}

function fallbackResponse(incomingMessage: string, contactInfo: any): string {
  const normalizedMessage = incomingMessage.trim().toLowerCase();
  
  if (normalizedMessage.includes('hello') || normalizedMessage.includes('hi') || normalizedMessage.includes('hey')) {
    return `Hello ${contactInfo.name || 'there'}! I'm your AI assistant. How can I help you today with your real estate needs?`;
  }
  if (normalizedMessage.includes('price') || normalizedMessage.includes('cost')) {
    return "Our property prices vary depending on the location and amenities. Would you like me to send you our current listings brochure?";
  }
  
  return "I understand you're asking about that. As an AI assistant, I've noted your request in the CRM. Is there anything else you need?";
}
