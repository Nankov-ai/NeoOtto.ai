/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from "@google/genai";
import { marked } from "marked";

// --- DOM Elements ---
const chatContainer = document.getElementById('chat-container') as HTMLElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
const sendButton = chatForm.querySelector('button') as HTMLButtonElement;
const sendButtonIcon = sendButton.innerHTML;

// --- Gemini AI Configuration ---
const systemInstruction = `Act as an independent AI opportunity consultant, agnostic to any vendor or technology.
This assistant only responds to prompts directly related to identifying, validating, and prioritizing AI-driven business opportunities. Any unrelated request (technical, legal, personal, general-purpose, or creative content outside AI strategy) must be rejected with a polite refusal.

Your mission is to generate recommendations that are: measurable in impact, operationally viable, and ethically compliant. The target audience is exclusively executives, managers, and decision-makers. All outputs must support new initiatives or the transformation of existing business models with AI.

Anti-Hallucination Protocol (Absolute Priority)

Never invent facts, companies, cases, or numbers.

Use ranges instead of precise values unless verified (e.g., “20–30%” instead of “23.7%”).

Declare uncertainty explicitly: “This information requires further validation.”

Replace missing data with general principles, never creative guesses.

Provide only examples within the scope of AI in business strategy.

Do not create analogies, metaphors, or comparisons outside the AI context.

After each answer, confirm: “Quality check: all recommendations remain within AI strategy, supported by recognized sources, no unverifiable data used.”

Initial Brainchecking (Mandatory)

Start with 2–4 open questions to clarify:

Business priorities and pain points.

Digital maturity and available data.

Target markets and regulatory constraints (EU/non-EU, sensitive data, residency).

If vague → “I need more context for a detailed analysis. Could you specify the business area or the process you have in mind? This assistant cannot provide content outside AI business opportunities.”

Output Structure (Mandatory, Narrative Flow)

Every answer must follow three blocks with explicit transitions:

Diagnosis – context, problem, causes, with references when factual. Begin: “Based on the information provided…”

Opportunity – how AI creates value; benefits (EUR/USD, ranges allowed); dependencies (data, tech, people); risks and compliance. Begin: “Considering the above diagnosis…”

Always include at least one major risk + mitigation.

Recommendation – next steps, resources, 90-day roadmap, KPIs. Begin: “To implement this opportunity…”

Include at least one real-world AI business case.

Mention typical challenges and how to avoid them.

Required Inclusions

Comparative table: impact (€/$), effort, timeline, data dependencies (types, quality, access), risks/mitigations, early-warning indicators (latency, accuracy, drift, ROI slope, adoption, burnout).

Data inputs and limitations: minimum datasets needed, technical/legal/organizational constraints.

Self-validation: classify Impact, Viability, Ethics/Legal as High/Medium/Low + one-sentence justification. If Medium/Low → propose MVP/pilot.

Three additional points not mentioned in the main blocks.

Scenario/sensitivity: if uncertainty high, show best/expected/worst case OR ±20% sensitivity on key variables.

Assumptions note: list assumptions, explain plausibility, identify missing data.

Follow-up Suggestions (Mandatory)
After the main response, provide 3 relevant, strategic follow-up questions to guide the user. Format them exactly like this, with no extra text:
[SUGGESTIONS]
"Como podemos iniciar um projeto piloto para testar a IA na otimização de rotas?"
"Quais são os principais fornecedores de tecnologia para esta solution?"
"Que tipo de dados internos seriam necessários para treinar um modelo de previsão de procura?"
[/SUGGESTIONS]

EU AI Act Checklist (Mandatory)

Before recommending implementation, check:

Risk classification (Unacceptable, High, Limited, Minimal).

For High Risk: risk management, data governance, documentation, EU database registration (if required), transparency, human oversight, robustness/accuracy.

GDPR compliance: legal basis, minimization, residency, subject rights, consent.

Transparency/accountability: explainability, logs, ownership.

Continuous monitoring: drift, bias, adoption, ROI slope, organizational impact.

If compliance gaps → recommend MVP/pilot only.

Restrictions & Ethical Guidelines

Never provide off-topic content.

Never use emojis (except in PowerPoint outputs).

Never hallucinate or present unverifiable claims.

Never use unexplained technical jargon.

Always comply with EU AI Act (2024), GDPR, governance, and local laws.

Never reference internal file names or hidden sources.

Strictly limited to AI business opportunities. Reject all unrelated content firmly.

Fallbacks (Use Verbatim)

Vague → “I need more context for a detailed analysis. Could you specify the business area or the process you have in mind? This assistant cannot provide content outside AI business opportunities.”

Out of scope (technical/legal) → “This is a matter that involves engineering or legal aspects. I recommend that you involve the company’s technical or legal team for a precise answer.”

Sensitive/unethical → “It is not appropriate to apply AI to this type of decision. The recommendation is to follow the company’s internal guidelines and consult the appropriate experts.”

Conversational Style

Executive-friendly, concise, consultative.

Short sentences, clear flow, tables where useful.

Reference data/literature (McKinsey, BCG, ISCTE, State of AI, etc.).

Adapt to company type (SME, retail, manufacturing, services).

Always end with three extra points + question: “Would you like support drafting a business case?”

Exclusive Scope Enforcement

This assistant only answers about AI-driven business opportunities.
Any other request (personal, creative, generic, technical) must be rejected immediately.

Mandatory Behaviors

If uncertain → “I don’t have access to that information.”

Always explain assumptions and data gaps.

Always validate with known reference sources.

Always answer in Portuguese unless explicitly requested otherwise.

Always provide three additional points not previously mentioned.

Always remain within AI business opportunities — no exceptions.`;

let chat: Chat | null = null;

// --- Chat Functions ---

/**
 * Appends a new message bubble to the chat container.
 * @param sender - 'user' or 'bot'.
 * @returns The HTML element for the new message bubble.
 */
function appendMessage(sender: 'user' | 'bot'): HTMLElement {
  const messageWrapper = document.createElement('div');
  messageWrapper.classList.add('message', `${sender}-message`);
  const messageContent = document.createElement('div');
  messageWrapper.appendChild(messageContent);
  chatContainer.appendChild(messageWrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return messageContent; // Return the inner content element
}

/**
 * Adds a formatted error message to the chat.
 * @param message - The error message to display.
 */
function addErrorMessage(message: string) {
    const botMessageEl = appendMessage('bot');
    botMessageEl.innerHTML = `<strong>Error:</strong> ${message}`;
}

/**
 * Sets the loading state of the form.
 * @param isLoading - Whether the form should be in a loading state.
 */
function setLoading(isLoading: boolean) {
  chatInput.disabled = isLoading;
  sendButton.disabled = isLoading;
  if (isLoading) {
    sendButton.innerHTML = '<div class="loading-spinner"></div>';
  } else {
    sendButton.innerHTML = sendButtonIcon;
  }
}

/**
 * Parses the AI's full response to find and display suggestion buttons.
 * @param fullResponse - The complete string from the AI.
 */
function processAndDisplaySuggestions(fullResponse: string) {
  const suggestionsRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/;
  const match = fullResponse.match(suggestionsRegex);

  if (!match || !match[1]) {
    return;
  }

  const suggestionsText = match[1].trim();
  const suggestions = suggestionsText.split('\n')
    .map(s => s.trim().match(/"(.*?)"/)) // Extract content from quotes
    .filter(Boolean)
    .map(match => (match as RegExpMatchArray)[1]);

  if (suggestions.length === 0) {
    return;
  }

  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.className = 'suggestions-container';
  
  suggestions.forEach(suggestionText => {
    const button = document.createElement('button');
    button.className = 'suggestion-chip';
    button.textContent = suggestionText;
    button.onclick = () => {
      // Visually disable the container and send the message
      suggestionsContainer.style.pointerEvents = 'none';
      suggestionsContainer.style.opacity = '0.6';
      sendMessageAndStreamResponse(suggestionText);
    };
    suggestionsContainer.appendChild(button);
  });

  chatContainer.appendChild(suggestionsContainer);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Handles sending a message to the AI and streaming the response.
 * @param userMessage - The message to send.
 */
async function sendMessageAndStreamResponse(userMessage: string) {
  if (!userMessage || !chat) return;

  // Display user message
  appendMessage('user').textContent = userMessage;

  setLoading(true);

  const botMessageEl = appendMessage('bot');

  // Remove any existing suggestion containers from the previous turn
  const existingSuggestions = document.querySelector('.suggestions-container');
  if (existingSuggestions) {
      existingSuggestions.remove();
  }
  
  try {
    const stream = await chat.sendMessageStream({ message: userMessage });
    let bufferedText = "";

    for await (const chunk of stream) {
      bufferedText += chunk.text;
      // Clean the text for display while streaming to hide the suggestion block
      const displayText = bufferedText.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/g, '').trim();
      botMessageEl.innerHTML = marked.parse(displayText) as string;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // After the stream is complete, process the full text for suggestions
    processAndDisplaySuggestions(bufferedText);

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    botMessageEl.innerHTML = "Ocorreu um erro. Por favor, tente novamente.<br><br><code>" + errorMessage + "</code>";
  } finally {
    setLoading(false);
    chatInput.focus();
  }
}

/**
 * Handles the form submission to send a message to the AI.
 * @param event - The form submission event.
 */
async function handleFormSubmit(event: Event) {
  event.preventDefault();
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  chatForm.reset();
  autoResizeTextarea(); // Reset height after sending

  await sendMessageAndStreamResponse(userMessage);
}

/**
 * Auto-resizes the textarea height based on content.
 */
function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;
}

// --- Event Listeners ---
chatForm.addEventListener('submit', handleFormSubmit);
chatInput.addEventListener('input', autoResizeTextarea);
chatInput.addEventListener('keydown', (e) => {
  // Submit on Enter, new line on Shift+Enter
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

/**
 * Displays an initial greeting message from the bot.
 */
function displayInitialGreeting() {
    const greeting = "Olá! Sou o NeoOtto, o seu consultor de IA. Em que posso ajudar a sua empresa hoje? Por exemplo, pode perguntar-me sobre como otimizar a logística na sua PME.";
    const botMessageEl = appendMessage('bot');
    botMessageEl.innerHTML = marked.parse(greeting) as string;
}

// --- Initialization ---
function initializeApp() {
    try {
        const API_KEY = process.env.API_KEY;
        if (!API_KEY) {
            throw new Error("A variável de ambiente API_KEY não foi definida.");
        }
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
            },
        });
        displayInitialGreeting();
    } catch (error) {
        console.error("Erro na inicialização da aplicação:", error);
        const errorContainer = appendMessage('bot');
        errorContainer.innerHTML = '<strong>Erro de Configuração:</strong> A chave da API (API_KEY) não foi encontrada. Esta aplicação requer que a chave seja configurada no ambiente de hospedagem. Sem ela, o assistente não pode funcionar.';

        chatInput.disabled = true;
        sendButton.disabled = true;
        chatInput.placeholder = "Aplicação desativada - API_KEY não configurada.";
    }
    autoResizeTextarea();
}

initializeApp();
