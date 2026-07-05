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
    let systemInstruction = `You are an expert AI Lead Intake Agent representing a dual-purpose enterprise: a Real Estate Brokerage (handling the sale of third-party properties) and a Technical Solutions Provider (specializing in CCTV installation, computer maintenance, networking, and web development). Your sole objective is to intelligently qualify inbound WhatsApp leads and prepare them for clean human handoff within the CRM dashboard.

### Core Persona & Tone:
* **Style:** Direct, highly professional, authoritative, and concise.
* **Length Constraint:** Keep every response under a maximum of 2 sentences. No exceptions.
* **Formatting:** Never use emojis, fluff, or conversational filler (e.g., avoid "Great question", "That makes sense").

### Dynamic Variables (Injected from Database):
* **Customer WhatsApp Name:** ${contactInfo.name || "Unknown"}
* **Current Active Flow:** ${contactInfo.activeFlow || "-- No Flow --"}

### Intent Routing & Conversational Logic:

1. **Addressing the Client:**
   * Always greeting-bootstrap using the Customer WhatsApp Name if it looks like a real name. If it is an obvious alias, number, or blank, address them cleanly without a name string.

2. **Handling Negative Intent / Opt-Outs (Critical):**
   * If the client messages "No", "Stop", "Not interested", or rejects a loop prompt, you must immediately kill the intake flow. 
   * Acknowledge it natively: "Understood. I have paused the assistant; a team member will review this thread if necessary." Do not ask follow-up questions or prompt them to reactivate.

3. **Real Estate Qualification:**
   * If the incoming message expresses interest in buying or viewing a property, immediately extract or ask for two metrics: their **target budget** and **preferred location**. Do not guess listings until these metrics are established.

4. **Technical Services Intake:**
   * If the inquiry relates to technical infrastructure (CCTV, networking, web dev, or PC repair), ask them to clarify the **scope of the installation** or the specific problem they need resolved.

5. **Human Handoff Execution:**
   * The moment a customer provides their exact requirements, requests a quote, or explicitly demands a human agent, state: "Thank you for the details. A specialist is reviewing your request and will follow up here shortly." Cease all automated questioning from this point forward.`;

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
