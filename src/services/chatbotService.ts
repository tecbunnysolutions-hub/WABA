export async function getAutomatedResponse(
  incomingMessage: string,
  history: { direction: string; message_content: string }[],
  contactInfo: { name?: string; dealValue?: string; activeFlow?: string }
): Promise<string | null> {
  // Construct the prompt with history
  let prompt = "System Prompt: You are an expert real estate and technical solutions assistant.\n";
  prompt += "Context:\n";
  if (contactInfo.name) prompt += `- Lead Name: ${contactInfo.name}\n`;
  if (contactInfo.dealValue) prompt += `- Deal Value: ${contactInfo.dealValue}\n`;
  if (contactInfo.activeFlow) prompt += `- Active Flow: ${contactInfo.activeFlow}\n`;
  prompt += "\nChat History (last 5 messages):\n";
  
  for (const msg of history) {
    const sender = msg.direction === 'INBOUND' ? 'Client' : 'Assistant';
    prompt += `${sender}: ${msg.message_content}\n`;
  }
  
  prompt += `Client: ${incomingMessage}\nAssistant:`;

  // Simulate LLM API Call
  // Note: Replace this block with your actual LLM (e.g., OpenAI or Gemini) SDK call
  console.log("--- CALLING LLM API ---");
  console.log(prompt);
  console.log("-----------------------");

  // Basic mocked response for now
  const normalizedMessage = incomingMessage.trim().toLowerCase();
  
  if (normalizedMessage.includes('hello') || normalizedMessage.includes('hi') || normalizedMessage.includes('hey')) {
    return `Hello ${contactInfo.name || 'there'}! I'm your AI assistant. How can I help you today with your real estate needs?`;
  }
  if (normalizedMessage.includes('price') || normalizedMessage.includes('cost')) {
    return "Our property prices vary depending on the location and amenities. Would you like me to send you our current listings brochure?";
  }
  
  return "I understand you're asking about that. As an AI assistant, I've noted your request in the CRM. Is there anything else you need?";
}
