import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minus, RotateCcw, Sparkles, AlertCircle, CheckCircle2, ChevronRight, CornerDownLeft, ShieldCheck, Bug, Layers } from 'lucide-react';

export default function AIAssistantChatbot({ token, user, activeIssue = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 🤖 DefectX AI Assistant Online
Hello **${user?.name || 'there'}**! I am your DefectX intelligent resolution assistant.

I am directly connected to your **live defect telemetry**, **semantic retrieval index**, and **historical defect resolutions**.

**I can assist you with:**
- 🚨 **Critical Bug Triage:** Immediate breakdown of active P1 blockers
- 🧠 **Historical Root Causes:** How past similar defects were resolved
- 📊 **Quality Telemetry:** Real-time stats across projects and sprints
- 🛡️ **Regression Risk & Patterns:** Subsystem recurrence and pattern clustering
- 🛠️ **Debugging Guidance:** Diagnostic steps for complex errors

How can I assist your engineering workflow today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'What are the critical bugs in the system?',
        'Defect trends explanation',
        'Recurring defect patterns',
        'Historical defect resolutions',
        'Sprint progress summary'
      ]
    }
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  const handleSendMessage = async (textToSend = null) => {
    const queryText = (typeof textToSend === 'string' ? textToSend : input).trim();
    if (!queryText || loading) return;

    setError(null);
    setInput('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Build conversation history (excluding initial greeting to keep context clean)
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: queryText,
          history: conversationHistory,
          current_issue_id: activeIssue ? activeIssue.id : null
        })
      });

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        console.error('Non-JSON response from AI endpoint:', rawText.slice(0, 200));
        throw new Error(`DefectX AI service returned an unexpected response format (${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'DefectX AI service is momentarily unavailable.');
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || data.message || 'No response content available.',
        intent: data.intent,
        grounded_defects: data.grounded_defects || [],
        historical_context: data.historical_context || [],
        telemetry: data.telemetry || null,
        suggestions: data.suggestions || [
          'What are the critical bugs in the system?',
          'Historical defect resolutions',
          'Defect telemetry overview'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chatbot message error:', err);
      setError(err.message || 'Unable to communicate with DefectX AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `### 🤖 Conversation Reset
Conversation history has been cleared. I am grounded in your latest live DefectX telemetry. What would you like to investigate?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'What are the critical bugs in the system?',
          'Show me authentication defects',
          'Historical defect resolutions',
          'Defect telemetry overview'
        ]
      }
    ]);
    setError(null);
  };

  // Simple Markdown renderer for rich assistant output
  const renderFormattedContent = (content) => {
    if (!content) return null;

    const lines = content.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.55' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Header ###
          if (trimmed.startsWith('### ')) {
            return (
              <div key={idx} style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-main)', marginTop: idx > 0 ? '8px' : '0', marginBottom: '2px' }}>
                {trimmed.replace(/^###\s+/, '')}
              </div>
            );
          }

          // Header ##
          if (trimmed.startsWith('## ')) {
            return (
              <div key={idx} style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-light)', marginTop: idx > 0 ? '10px' : '0', marginBottom: '4px' }}>
                {trimmed.replace(/^##\s+/, '')}
              </div>
            );
          }

          // Blockquote >
          if (trimmed.startsWith('> ')) {
            return (
              <div key={idx} style={{
                borderLeft: '3px solid var(--primary-violet)',
                background: 'var(--primary-glow)',
                padding: '6px 10px',
                borderRadius: '0 6px 6px 0',
                fontSize: '0.84rem',
                color: 'var(--text-main)',
                margin: '4px 0'
              }}>
                {renderInlineStyles(trimmed.replace(/^>\s+/, ''))}
              </div>
            );
          }

          // Bullet point - or *
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletContent = trimmed.replace(/^[-*]\s+/, '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                <span style={{ color: 'var(--primary-light)', fontWeight: 800, lineHeight: '1.5' }}>•</span>
                <div style={{ flex: 1 }}>{renderInlineStyles(bulletContent)}</div>
              </div>
            );
          }

          // Sub-bullet point (indented)
          if (trimmed.startsWith('* ') || (line.startsWith('  * ') || line.startsWith('    * '))) {
            const subContent = trimmed.replace(/^\*\s+/, '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', paddingLeft: '18px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--text-subtle)' }}>-</span>
                <div style={{ flex: 1 }}>{renderInlineStyles(subContent)}</div>
              </div>
            );
          }

          // Numbered list 1. 2.
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                <span style={{ color: 'var(--primary-light)', fontWeight: 700, minWidth: '18px' }}>{numMatch[1]}.</span>
                <div style={{ flex: 1 }}>{renderInlineStyles(numMatch[2])}</div>
              </div>
            );
          }

          // Empty line
          if (!trimmed) {
            return <div key={idx} style={{ height: '4px' }} />;
          }

          // Regular paragraph
          return <div key={idx}>{renderInlineStyles(line)}</div>;
        })}
      </div>
    );
  };

  // Inline formatting: **bold**, `code`, and #ID tags
  const renderInlineStyles = (text) => {
    if (!text) return text;

    // Tokenize bold, code, and defect ID tags
    const parts = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Code `text`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Defect ID #123
      const defectMatch = remaining.match(/(#\d+)/);

      // Find which comes first
      const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
      const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;
      const defectIndex = defectMatch ? remaining.indexOf(defectMatch[0]) : -1;

      const indices = [
        { type: 'bold', index: boldIndex, match: boldMatch },
        { type: 'code', index: codeIndex, match: codeMatch },
        { type: 'defect', index: defectIndex, match: defectMatch }
      ].filter(i => i.index !== -1).sort((a, b) => a.index - b.index);

      if (indices.length === 0) {
        parts.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      const first = indices[0];

      // Add text before match
      if (first.index > 0) {
        parts.push(<span key={keyIdx++}>{remaining.substring(0, first.index)}</span>);
      }

      // Add formatted element
      if (first.type === 'bold') {
        parts.push(
          <strong key={keyIdx++} style={{ color: 'var(--text-main)', fontWeight: 700 }}>
            {first.match[1]}
          </strong>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      } else if (first.type === 'code') {
        parts.push(
          <code
            key={keyIdx++}
            style={{
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontFamily: 'monospace',
              fontSize: '0.84em',
              color: 'var(--primary-light)'
            }}
          >
            {first.match[1]}
          </code>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      } else if (first.type === 'defect') {
        parts.push(
          <span
            key={keyIdx++}
            style={{
              background: 'var(--primary-glow)',
              color: 'var(--primary-light)',
              border: '1px solid var(--primary-violet)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.86em',
              display: 'inline-block'
            }}
          >
            {first.match[1]}
          </span>
        );
        remaining = remaining.substring(first.index + first.match[0].length);
      }
    }

    return parts;
  };

  return (
    <>
      {/* 1. Circular Floating AI Chatbot Button (Bottom-Right Corner) */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        title={isOpen ? 'Close DefectX AI Assistant' : 'Open DefectX AI Assistant'}
        aria-label="DefectX AI Assistant"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-violet) 0%, var(--primary-light) 100%)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: '0 8px 24px var(--primary-glow), 0 4px 12px rgba(0, 0, 0, 0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'rotate(90deg)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isOpen ? (
          <X size={26} color="#FFFFFF" />
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} color="#FFFFFF" />
            {/* Pulsing online indicator */}
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '10px',
                height: '10px',
                background: '#10B981',
                borderRadius: '50%',
                border: '2px solid var(--bg-dark)',
                boxShadow: '0 0 8px #10B981'
              }}
            />
          </div>
        )}
      </button>

      {/* 2. Floating DefectX AI Assistant Chat Panel (Overlays Existing Page) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="DefectX AI Assistant Chat"
          style={{
            position: 'fixed',
            bottom: '92px',
            right: '24px',
            width: '420px',
            maxWidth: 'calc(100vw - 32px)',
            height: '600px',
            maxHeight: 'calc(100vh - 120px)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45), 0 0 40px var(--primary-glow)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9999,
            animation: 'defectxSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-table-header)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary-violet) 0%, var(--primary-light) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px var(--primary-glow)'
                }}
              >
                <Bot size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                    DefectX AI Assistant
                  </h2>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#4ADE80',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ADE80' }} />
                    Live
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Telemetry & Grounded Resolution Engine
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleClearChat}
                title="Reset Conversation"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize Chatbot"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Minus size={18} />
              </button>
            </div>
          </div>

          {/* Grounding Verification Strip */}
          <div
            style={{
              padding: '6px 16px',
              background: 'var(--primary-glow)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '0.72rem',
              color: 'var(--primary-light)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} />
              <span>Grounded in DefectX Live Database & Historical Fixes</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Multi-Model AI</span>
          </div>

          {/* Chat Messages Stream */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '100%'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '88%',
                      padding: '12px 16px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isUser
                        ? 'linear-gradient(135deg, var(--primary-violet) 0%, var(--primary-light) 100%)'
                        : 'var(--btn-secondary-bg)',
                      border: isUser ? 'none' : '1px solid var(--border-color)',
                      color: isUser ? '#FFFFFF' : 'var(--text-main)',
                      boxShadow: isUser ? '0 4px 12px var(--primary-glow)' : '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {isUser ? (
                      <div style={{ fontSize: '0.92rem', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                    ) : (
                      renderFormattedContent(msg.content)
                    )}

                    {/* Matched Defect Telemetry Tags (if returned from grounded search) */}
                    {!isUser && msg.grounded_defects && msg.grounded_defects.length > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bug size={13} color="var(--primary-light)" />
                          <span>Referenced DefectX Records:</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {msg.grounded_defects.map(d => (
                            <div
                              key={d.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                color: 'var(--text-main)'
                              }}
                            >
                              <strong style={{ color: 'var(--primary-light)' }}>#{d.id}</strong>
                              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.title}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: d.priority === 'P1' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                  color: d.priority === 'P1' ? '#F87171' : '#60A5FA',
                                  fontWeight: 700
                                }}
                              >
                                {d.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-subtle)',
                      marginTop: '3px',
                      padding: '0 4px'
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'var(--primary-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-light)'
                  }}
                >
                  <Bot size={18} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--btn-secondary-bg)',
                    border: '1px solid var(--border-color)',
                    padding: '8px 14px',
                    borderRadius: '14px',
                    fontSize: '0.84rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-light)', animation: 'defectxPulse 1s infinite' }} />
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-light)', animation: 'defectxPulse 1s infinite 0.2s' }} />
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-light)', animation: 'defectxPulse 1s infinite 0.4s' }} />
                  <span style={{ marginLeft: '4px', fontSize: '0.78rem' }}>Querying DefectX telemetry...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#F87171',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => handleSendMessage(messages[messages.length - 1]?.content)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Suggestion Chips */}
          {(() => {
            const latestMsg = messages[messages.length - 1];
            let chips = (latestMsg && latestMsg.suggestions) || [];
            if (activeIssue) {
              chips = [
                `Explain DEF-${activeIssue.id}`,
                `Check regression risk for DEF-${activeIssue.id}`,
                `Why developer was recommended for DEF-${activeIssue.id}`,
                `Explain defect trends`,
                `Recurring defect patterns`,
                ...chips
              ];
            } else if (chips.length === 0) {
              chips = [
                'What are the critical bugs in the system?',
                'Explain defect trends',
                'Recurring defect patterns',
                'Historical defect resolutions'
              ];
            }

            return (
              <div
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-card)',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={12} color="var(--primary-light)" />
                  Prompt:
                </span>
                {chips.slice(0, 4).map((chip, idx) => (
                  <button
                    key={idx}
                    disabled={loading}
                    onClick={() => handleSendMessage(chip)}
                    style={{
                      background: 'var(--btn-secondary-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                      borderRadius: '14px',
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = 'var(--primary-glow)';
                        e.currentTarget.style.color = 'var(--primary-light)';
                        e.currentTarget.style.borderColor = 'var(--primary-violet)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Chat Input Bar */}
          <div
            style={{
              padding: '12px 14px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-table-header)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask about bugs, telemetry, fixes, or code..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary-violet)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || loading}
              title="Send Message"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: !input.trim() || loading
                  ? 'var(--btn-secondary-bg)'
                  : 'linear-gradient(135deg, var(--primary-violet) 0%, var(--primary-light) 100%)',
                color: !input.trim() || loading ? 'var(--text-subtle)' : '#FFFFFF',
                border: 'none',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: !input.trim() || loading ? 'none' : '0 4px 12px var(--primary-glow)'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
