/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/* Configuration */
const USE_CLOUDFLARE_WORKER = true; // Set to true when using Cloudflare Worker
const CLOUDFLARE_WORKER_URL =
  "https://finallorealchatbot-worker.treyzangel.workers.dev/";
const MAX_CONVERSATION_LENGTH = 20; // Maximum number of messages to keep in history

/* Conversation history */
let conversationHistory = [
  {
    role: "system",
    content: `You are L'Oréal's Smart Product Advisor, an expert beauty consultant specializing in L'Oréal's extensive product catalog. Your role is to help customers discover and understand L'Oréal products across makeup, skincare, haircare, and fragrances.

Key Guidelines:
- ONLY answer questions related to L'Oréal products, beauty routines, skincare advice, makeup tips, haircare guidance, and fragrance recommendations
- Politely decline to answer questions unrelated to beauty, L'Oréal products, or personal care
- Provide personalized recommendations based on user's skin type, concerns, preferences, and lifestyle
- Share ingredient information and explain product benefits
- Suggest complete routines and product combinations
- Be enthusiastic, knowledgeable, and helpful
- Use emojis appropriately to make conversations engaging
- Reference L'Oréal's commitment to innovation and quality
- If asked about competitors, redirect focus to L'Oréal's superior offerings

Example responses:
- For skincare: Recommend specific L'Oréal serums, moisturizers, cleansers based on skin concerns
- For makeup: Suggest foundation shades, lipstick colors, eyeshadow palettes
- For haircare: Recommend shampoos, conditioners, treatments based on hair type
- For fragrances: Suggest perfumes based on preferences and occasions

Always maintain L'Oréal's brand voice: confident, innovative, inclusive, and empowering."`,
  },
];

/* Initialize chat */
function initializeChat() {
  chatWindow.innerHTML = "";
  addMessage(
    "system",
    "👋 Welcome to L'Oréal Smart Product Advisor! I'm here to help you discover the perfect beauty products and routines tailored just for you. What can I help you with today?"
  );
}

/* Add message to chat window */
function addMessage(role, content, isTyping = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  if (isTyping) {
    messageDiv.className += " typing-indicator";
    messageDiv.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
  } else {
    messageDiv.textContent = content;
  }

  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageDiv;
}

/* Show typing indicator */
function showTypingIndicator() {
  return addMessage("assistant", "", true);
}

/* Remove typing indicator */
function removeTypingIndicator(typingElement) {
  if (typingElement && typingElement.parentNode) {
    typingElement.parentNode.removeChild(typingElement);
  }
}

/* Send message to OpenAI API */
async function sendToOpenAI(messages) {
  const apiKey = window.OPENAI_API_KEY;
  const workerUrl = CLOUDFLARE_WORKER_URL;

  if (USE_CLOUDFLARE_WORKER) {
    // Use Cloudflare Worker endpoint
    if (!workerUrl) {
      throw new Error("Cloudflare Worker URL is not configured");
    }

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Worker error: ${response.status}`);
    }

    return await response.json();
  } else {
    // Direct OpenAI API call (for local development only)
    if (!apiKey || apiKey === "your-openai-api-key-here") {
      throw new Error("Please add your OpenAI API key to secrets.js");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_completion_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return await response.json();
  }
}

/* Handle form submission */
async function handleSubmit(e) {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // Disable form while processing
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Add user message to chat
  addMessage("user", message);

  // Add user message to conversation history
  conversationHistory.push({
    role: "user",
    content: message,
  });

  // Clear input
  userInput.value = "";

  // Show typing indicator
  const typingIndicator = showTypingIndicator();

  try {
    // Trim conversation history if too long
    if (conversationHistory.length > MAX_CONVERSATION_LENGTH) {
      // Keep system message and recent messages
      const systemMessage = conversationHistory[0];
      const recentMessages = conversationHistory.slice(
        -MAX_CONVERSATION_LENGTH + 1
      );
      conversationHistory = [systemMessage, ...recentMessages];
    }

    // Send to OpenAI
    const response = await sendToOpenAI(conversationHistory);

    // Remove typing indicator
    removeTypingIndicator(typingIndicator);

    // Get assistant response
    const assistantMessage = response.choices[0].message.content;

    // Add assistant message to chat
    addMessage("assistant", assistantMessage);

    // Add assistant message to conversation history
    conversationHistory.push({
      role: "assistant",
      content: assistantMessage,
    });
  } catch (error) {
    console.error("Error:", error);

    // Remove typing indicator
    removeTypingIndicator(typingIndicator);

    // Show error message
    let errorMessage =
      "Sorry, I'm having trouble connecting right now. Please try again in a moment.";

    if (error.message.includes("API key")) {
      errorMessage =
        "🔑 Please configure your OpenAI API key in secrets.js to start chatting!";
    } else if (error.message.includes("Cloudflare Worker")) {
      errorMessage =
        "🔧 Please update your Cloudflare Worker URL in secrets.js!";
    }

    addMessage("system", errorMessage);
  } finally {
    // Re-enable form
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

/* Event listeners */
chatForm.addEventListener("submit", handleSubmit);

// Allow Enter key to submit (prevent Shift+Enter from submitting)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSubmit(e);
  }
});

// Auto-resize input (optional enhancement)
userInput.addEventListener("input", () => {
  // Auto-focus on input when typing
  if (document.activeElement !== userInput) {
    userInput.focus();
  }
});

/* Initialize the chat when page loads */
document.addEventListener("DOMContentLoaded", () => {
  initializeChat();
  userInput.focus();
});
