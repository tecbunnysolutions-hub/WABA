export function getAutomatedResponse(incomingMessage: string): string | null {
  const normalizedMessage = incomingMessage.trim().toLowerCase();

  // Define simple keyword matching rules
  const rules = [
    {
      keywords: ['hi', 'hello', 'hey', 'start'],
      response: 'Hello! Welcome to our WhatsApp service. How can we help you today? Type "menu" for options.'
    },
    {
      keywords: ['menu', 'options', 'help'],
      response: 'Here are our options:\n1. Type "hours" for our business hours.\n2. Type "support" to speak with an agent.'
    },
    {
      keywords: ['hours', 'time', 'open'],
      response: 'Our business hours are Monday to Friday, 9:00 AM to 5:00 PM EST.'
    },
    {
      keywords: ['support', 'agent', 'human'],
      response: 'Connecting you to our support team. An agent will be with you shortly!'
    }
  ];

  for (const rule of rules) {
    // Check if any keyword exactly matches or is contained in the incoming message
    if (rule.keywords.some(kw => normalizedMessage.includes(kw))) {
      return rule.response;
    }
  }

  // Fallback response if no keywords match (optional). 
  // Returning null means the bot ignores unrecognized messages and leaves it for a human.
  // return "I'm sorry, I didn't understand that. Type 'help' for options.";
  return null;
}
