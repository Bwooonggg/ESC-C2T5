import React, { useState, useEffect, useRef } from "react";
import { langgraphClient } from "./components/source/utils/langgraph"; 
import { WorksheetPreview } from './components/worksheet_preview';
import { panelStyles } from "./components/source/styles/PanelStyles";
import { getClarificationPrompt } from "./components/source/utils/clarificationInterrupt";
import { normalizeWorksheet } from "./components/source/utils/normalizeWorksheet";
import { getWorksheetProgress } from "./components/source/utils/worksheetProgress";
import { createRunPayload } from "./components/source/utils/runPayload";
import { AccessibilityModal } from './components/AccessibilityModal';

const INITIAL_GREETING =
  'Hello! Welcome to the DAS Worksheet Builder. What topic and band should the worksheet cover, and would you like MCQ or open-ended questions? For example: "Band A MCQ worksheet on Subject Verb Agreement."';

export function DASEducatorPanel() {
  const [messages, setMessages] = useState([
    {
      id: "initial-greeting",
      role: "assistant",
      text: INITIAL_GREETING,
    }
  ]);

  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Understanding your request…");
  const [activeWorksheet, setActiveWorksheet] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  
  // Accessibility Settings State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [theme, setTheme] = useState("default");
  const [fontSizePct, setFontSizePct] = useState(100);
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [charSpacing, setCharSpacing] = useState(0);

  const suggestionsList = [
    "Band A simple sentences MCQ worksheet",
    "Band A reading comprehension open-ended worksheet",
    "Band B vowel digraphs MCQ worksheet",
    "Band C syllable division open-ended worksheet"
  ];
  
  const chatEndRef = useRef(null);
  const client = langgraphClient; 
  const assistantId = "educational_agent"; 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    async function initThread() {
      try {
        const thread = await client.threads.create();
        setThreadId(thread.thread_id);
      } catch (err) {
        console.error("Error creating LangGraph thread session:", err);
      }
    }
    initThread();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleResetDefaults = () => {
    setDyslexiaFont(false);
    setTheme("default");
    setFontSizePct(100);
    setLineSpacing(1.5);
    setCharSpacing(0);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const text = inputValue.trim();
    setInputValue(""); 
    setShowSuggestions(false);

    const userMsg = { id: crypto.randomUUID(), role: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoadingStatus("Understanding your request…");
    setLoading(true);

    try {
      let activeThreadId = threadId;
      if (!activeThreadId) {
        const thread = await client.threads.create();
        activeThreadId = thread.thread_id;
        setThreadId(activeThreadId);
      }

      const stream = client.runs.stream(
        activeThreadId,
        assistantId,
        createRunPayload({ awaitingClarification, text }),
      );

      let accumulatedContent = "";
      let foundWorksheet = null;
      let clarificationPrompt = null;

      for await (const chunk of stream) {
        const progress = getWorksheetProgress(chunk);
        if (progress) setLoadingStatus(progress);

        const interruptPrompt = getClarificationPrompt(chunk);
        if (interruptPrompt) {
          clarificationPrompt = accumulatedContent || interruptPrompt;
          continue;
        }
        const chunkData = chunk.data || chunk.values || chunk;
        
        const parseChunkDeep = (obj) => {
          if (!obj || typeof obj !== "object") return;
          if (obj.worksheet) foundWorksheet = obj.worksheet;
          if (obj.worksheetData) foundWorksheet = obj.worksheetData;
          if (obj.activeWorksheet) foundWorksheet = obj.activeWorksheet;
          if (obj.generated_worksheet) foundWorksheet = obj.generated_worksheet;
          
          if (obj.messages) {
            const lastMsg = obj.messages[obj.messages.length - 1];
            if (lastMsg?.content) {
              accumulatedContent = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
            }
          }
          if (obj.content && typeof obj.content === "string") accumulatedContent = obj.content;

          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === "object" && obj[key] !== null) parseChunkDeep(obj[key]);
          }
        };

        parseChunkDeep(chunkData);
        if (typeof chunkData === "string") accumulatedContent = chunkData;
      }

      if (clarificationPrompt) {
        setAwaitingClarification(true);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: clarificationPrompt,
          },
        ]);
        setLoading(false);
        return;
      }

      setAwaitingClarification(false);
      const worksheet = normalizeWorksheet(foundWorksheet);

      if (!worksheet) {
        throw new Error("Backend did not return a valid generated_worksheet");
      }

      if (accumulatedContent) {
        let chatDisplayText = accumulatedContent;
        try {
          const parsed = JSON.parse(accumulatedContent);
          if (parsed && typeof parsed === "object") {
            chatDisplayText = "I have updated your worksheet based on your request!";
          }
        } catch (e) {}

        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: chatDisplayText }]);
      } else {
        throw new Error("Backend did not return an assistant message");
      }
      setActiveWorksheet(worksheet);
      setLoading(false);
    } catch (err) {
      console.error("Worksheet generation failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "I couldn't generate a valid worksheet. Please try again.",
        },
      ]);
      setLoading(false);
    }
  };

  const filteredSuggestions = suggestionsList.filter(item => 
    item.toLowerCase().includes(inputValue.toLowerCase())
  );

  const currentFontFamily = dyslexiaFont 
    ? '"OpenDyslexic", "Comic Sans MS", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  return (
    <div className="das-workspace" style={{ ...panelStyles.workspaceGrid, fontFamily: currentFontFamily }}>
      <div style={panelStyles.previewContainer} className="printable-preview">
        <style>{`
          @keyframes das-loading-spin {
            to { transform: rotate(360deg); }
          }
          .das-loading-spinner {
            display: inline-block;
            animation: das-loading-spin 0.8s linear infinite !important;
            will-change: transform;
          }
          .worksheet-option.correct-option {
            background: #dcfce7 !important;
            border-color: #22c55e !important;
            color: #166534 !important;
            font-weight: 700;
          }
          .worksheet-answer-key {
            display: none;
          }
          @keyframes das-loading-pulse {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .das-loading-text { animation: none !important; }
          }
          @media print {
            @page { margin: 0; }
            html, body, #root { height: auto !important; overflow: visible !important; }
            body * { visibility: hidden; }
            .das-workspace {
              display: block !important;
              width: 100% !important;
              height: auto !important;
              padding: 0 !important;
              background: #fff !important;
            }
            .printable-preview, .printable-preview * { visibility: visible; }
            .printable-preview {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              box-sizing: border-box !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: #fff !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .worksheet-preview-wrapper {
              display: block !important;
              height: auto !important;
              overflow: visible !important;
            }
            .worksheet-document {
              display: block !important;
              height: auto !important;
              overflow: visible !important;
              border: 0 !important;
              box-sizing: border-box !important;
              padding: 12mm !important;
              box-decoration-break: clone;
              -webkit-box-decoration-break: clone;
            }
            .worksheet-items {
              display: block !important;
            }
            .worksheet-item {
              display: block !important;
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
              margin-bottom: 10px !important;
            }
            .printable-preview .worksheet-option {
              background: #fff !important;
              border-color: #94a3b8 !important;
              color: #1e293b !important;
              font-weight: 400 !important;
            }
            .worksheet-answer-key {
              display: block !important;
              break-before: page;
              page-break-before: always;
              padding-top: 4mm;
            }
            .worksheet-controls, .preview-actions, .access-floating-widget {
              display: none !important;
            }
            .chat-panel { display: none !important; }
          }
        `}</style>

        <div style={panelStyles.previewHeader}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a1a', fontFamily: 'inherit' }}>Activity Worksheet Preview</h2>
          <div style={panelStyles.buttonGroup} className="preview-actions">
            {activeWorksheet && (
              <button onClick={() => window.print()} style={panelStyles.primaryActionButton}>Export PDF</button>
            )}
            <button onClick={() => setActiveWorksheet(null)} style={panelStyles.neutralActionButton}>Clear Preview</button>
          </div>
        </div>
        
        <WorksheetPreview 
          worksheetData={activeWorksheet} 
          accessibilitySettings={{ dyslexiaFont, theme, fontSizePct, lineSpacing, charSpacing }} 
        />
      </div>

      <div className="chat-panel" style={panelStyles.chatContainer}>
        <div style={panelStyles.previewHeader}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a1a', fontFamily: 'inherit' }}>AI Assistant</h2>
          <button 
            onClick={async () => {
              setMessages([{
                id: "initial-greeting",
                role: "assistant",
                text: INITIAL_GREETING,
              }]);
              setActiveWorksheet(null);
              setAwaitingClarification(false);
              try {
                const thread = await client.threads.create();
                setThreadId(thread.thread_id);
              } catch (err) {
                console.error("Error resetting LangGraph thread session:", err);
                setThreadId(null);
              }
            }}
            style={panelStyles.neutralActionButton}
          >
            Reset Chat
          </button>
        </div>
        
        <div style={panelStyles.messagesViewport}>
          {messages.map((msg) => {
            const isAssistant = msg.role === "assistant";
            return (
              <div key={msg.id} style={isAssistant ? panelStyles.assistantBubble : panelStyles.userBubble}>
                <span style={isAssistant ? panelStyles.assistantRoleLabel : panelStyles.userRoleLabel}>
                  {isAssistant ? "ASSISTANT" : "YOU"}
                </span>
                <div>{msg.text}</div>
              </div>
            );
          })}
          {loading && (
            <div
              role="status"
              aria-live="polite"
              style={panelStyles.assistantBubble}
            >
              <span style={panelStyles.assistantRoleLabel}>ASSISTANT</span>
              <div style={panelStyles.loadingRow}>
                <span
                  className="das-loading-spinner"
                  aria-hidden="true"
                  style={panelStyles.loadingSpinner}
                />
                <span
                  className="das-loading-text"
                  style={panelStyles.loadingText}
                >
                  {loadingStatus}
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} style={panelStyles.composerFormWrapper}>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul style={panelStyles.suggestionsDropdown}>
              {filteredSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  style={panelStyles.suggestionItem}
                  onMouseDown={(e) => {
                    e.preventDefault(); 
                    setInputValue(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}

          <div style={panelStyles.composerForm}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => { if (inputValue.trim()) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={loading ? "Creating your worksheet..." : "Specify a topic, Band A/B/C, and MCQ or open-ended..."}
              disabled={loading}
              style={panelStyles.composerInput}
            />
            <button 
              type="submit" 
              disabled={loading} 
              style={{ ...panelStyles.composerButton, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      <AccessibilityModal 
        showAccessModal={showAccessModal}
        setShowAccessModal={setShowAccessModal}
        dyslexiaFont={dyslexiaFont}
        setDyslexiaFont={setDyslexiaFont}
        theme={theme}
        setTheme={setTheme}
        fontSizePct={fontSizePct}
        setFontSizePct={setFontSizePct}
        lineSpacing={lineSpacing}
        setLineSpacing={setLineSpacing}
        charSpacing={charSpacing}
        setCharSpacing={setCharSpacing}
        handleResetDefaults={handleResetDefaults}
      />
    </div>
  );
}
