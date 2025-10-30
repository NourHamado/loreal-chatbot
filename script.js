/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Set initial message
chatWindow.textContent = "👋 Hello! How can I help you today?";

// Conversation messages array: start with the system message that restricts scope.
const messages = [
  {
    role: "system",
    content:
      "You are a helpful assistant that only answers questions related to L’Oréal products, skincare/haircare routines, and product recommendations. " +
      "If the user's question is outside of L’Oréal products, routines, or recommendations, politely decline and offer to help with L’Oréal-related topics. " +
      "Keep answers concise and factual.",
  },
];

// Small helper to safely escape text before inserting into innerHTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Append a message to the chat window. role is 'user' or 'assistant'
function appendMessage(role, text) {
  // Create container for the message (handles alignment)
  const container = document.createElement("div");
  container.className = `msg ${role === "user" ? "user" : "ai"}`;

  // Create the bubble element
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === "user" ? "user" : "ai"}`;

  // Prepare safe inner content: message text + metadata (role + time)
  const time = new Date().toLocaleTimeString();
  const roleLabel = role === "user" ? "You" : "L'Oréal Assistant";

  // Use escaped text inside innerHTML for simple markup (keeps beginner-friendly approach)
  bubble.innerHTML = `
    <div class="bubble-text">${escapeHtml(text)}</div>
    <div class="bubble-meta"><span class="role">${escapeHtml(
      roleLabel
    )}</span><span class="time">${escapeHtml(time)}</span></div>
  `;

  container.appendChild(bubble);
  chatWindow.appendChild(container);

  // Keep the behavior of scrolling to the bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Basic input validation
  const question = userInput.value.trim();
  if (!question) {
    return;
  }

  // Resolve Cloudflare Worker URL:
  // Use a globally defined CLOUDFLARE_WORKER_URL if present (load secrets.js before script.js),
  // otherwise use the provided worker URL directly.
  const WORKER_URL =
    typeof CLOUDFLARE_WORKER_URL !== "undefined"
      ? CLOUDFLARE_WORKER_URL
      : "https://loral-worker.n0hama01.workers.dev/";

  if (!WORKER_URL || WORKER_URL.includes("PUT_YOUR")) {
    appendMessage(
      "assistant",
      "Cloudflare Worker URL missing. Please add CLOUDFLARE_WORKER_URL to secrets.js or update the WORKER_URL in the code."
    );
    return;
  }

  // Add user's message to messages array and UI
  messages.push({ role: "user", content: question });
  appendMessage("user", question);

  // Show waiting/loading state
  const loadingId = `loading-${Date.now()}`;
  const loadingHtml = `<div id="${loadingId}"><em>Thinking...</em></div>`;
  chatWindow.innerHTML = (chatWindow.innerHTML || "") + loadingHtml;
  // Scroll to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Send the request to your Cloudflare Worker (the Worker should forward to OpenAI).
    // Do NOT include the OpenAI API key here; the Worker handles authentication.
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Worker error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();

    // Read assistant reply from data.choices[0].message.content
    const assistantReply =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
        : "Sorry, I couldn't get a response from the Worker.";

    // Remove loading element
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) {
      loadingElem.remove();
    }

    // Add assistant reply to messages and UI
    messages.push({ role: "assistant", content: assistantReply });
    appendMessage("assistant", assistantReply);

    // Clear input
    userInput.value = "";
    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (error) {
    console.error("Error contacting Cloudflare Worker:", error);
    // Remove loading element
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) {
      loadingElem.remove();
    }
    appendMessage(
      "assistant",
      "Sorry, there was an error contacting the Cloudflare Worker. Check the console for details."
    );
  }
});
