import React, { useState, useRef, useEffect, useCallback } from 'react';
import { T } from '../../utils/theme.js';
import { parseActionsFromResponse, isActionUndoable, buildUndoAction, formatActionForDisplay } from '../../utils/novaActions.js';

/**
 * NovaCompassChat — Sidebar NOVA chat component.
 *
 * Available from any page. Provides a direct NOVA conversation channel
 * with action execution capabilities via the existing ActionRegistry.
 *
 * Props:
 *   novaState, setNovaState,
 *   novaLoading, sendNOVAMessage,
 *   mainPage, activePage,
 *   projects, setProjects,
 *   onwardItems, setOnwardItems,
 *   actionRegistry,       // from App.jsx (createActionRegistry result)
 *   novaInteractions,     // for firing events
 *   onClose,
 */
export default function NovaCompassChat({
  novaState, setNovaState,
  novaLoading, sendNOVAMessage,
  mainPage, activePage,
  projects, setProjects,
  onwardItems, setOnwardItems,
  actionRegistry,
  novaInteractions,
  onClose,
}) {
  const [messages, setMessages] = useState([
    { role: 'nova', content: 'Hi, I\'m NOVA. How can I help you right now?', id: 'welcome' },
  ]);
  const [input, setInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { action, messageId }
  const [lastActionResult, setLastActionResult] = useState(null); // { action, result, undoAction, messageId }
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear undo after 10 seconds
  useEffect(() => {
    if (!lastActionResult) return;
    const timer = setTimeout(() => {
      setLastActionResult(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [lastActionResult]);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) }]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || novaLoading) return;
    setInput('');

    // Add user message
    addMessage({ role: 'user', content: text });

    // Add loading indicator
    const loadingId = 'loading-' + Date.now();
    addMessage({ role: 'nova', content: '...', id: loadingId, loading: true });

    try {
      const response = await sendNOVAMessage('compass', text);

      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingId));

      if (!response || !response.content) {
        addMessage({ role: 'nova', content: 'Sorry, I didn\'t get a response. Please try again.' });
        return;
      }

      // Check for actions in the response
      const actions = parseActionsFromResponse(
        typeof response === 'string' ? response : response.content || ''
      );

      const content = typeof response === 'string' ? response : response.content;

      if (actions.length > 0) {
        // Show the NOVA message with action confirmation
        const msgId = Date.now().toString();
        setMessages(prev => [...prev, {
          role: 'nova',
          content,
          id: msgId,
          pendingActions: actions,
        }]);
        // Set the first action as pending for confirmation
        setPendingAction({ action: actions[0], messageId: msgId });
      } else {
        // No actions — show normal response
        addMessage({ role: 'nova', content });
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== loadingId));
      addMessage({ role: 'nova', content: `Error: ${err.message || 'Failed to get response'}` });
    }
  }, [input, novaLoading, sendNOVAMessage, addMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction || !actionRegistry) return;

    const { action, messageId } = pendingAction;
    setPendingAction(null);

    // Update the message to show action is being executed
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, executingAction: true }
        : m
    ));

    try {
      const result = actionRegistry.dispatch(action.type, action.params || {}, {});

      if (result.success) {
        // Build undo action
        const undoAction = buildUndoAction(action, result);

        // Update message to show success
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, executingAction: false, actionResult: 'success' }
            : m
        ));

        // Add confirmation message
        addMessage({
          role: 'nova',
          content: `✅ Done! ${formatActionForDisplay(action)}`,
        });

        // Set undo state
        if (undoAction) {
          setLastActionResult({ action, result, undoAction, messageId });
        }

        // Fire NOVA interaction event
        if (novaInteractions?.fireEvent) {
          novaInteractions.fireEvent('task_added', {
            title: action.params?.title || 'Unknown',
            type: action.type,
          });
        }
      } else {
        setMessages(prev => prev.map(m =>
          m.id === messageId
            ? { ...m, executingAction: false, actionResult: 'error', actionError: result.error }
            : m
        ));
        addMessage({
          role: 'nova',
          content: `❌ Could not complete action: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, executingAction: false, actionResult: 'error', actionError: err.message }
          : m
      ));
      addMessage({
        role: 'nova',
        content: `❌ Error executing action: ${err.message}`,
      });
    }
  }, [pendingAction, actionRegistry, addMessage, novaInteractions]);

  const handleCancelAction = useCallback(() => {
    if (!pendingAction) return;
    const { action, messageId } = pendingAction;

    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, pendingActions: undefined, actionCancelled: true }
        : m
    ));
    addMessage({
      role: 'nova',
      content: `Cancelled: ${formatActionForDisplay(action)}`,
    });
    setPendingAction(null);
  }, [pendingAction, addMessage]);

  const handleUndo = useCallback(async () => {
    if (!lastActionResult || !lastActionResult.undoAction || !actionRegistry) return;

    const { undoAction } = lastActionResult;
    setLastActionResult(null);

    try {
      const result = actionRegistry.dispatch(undoAction.type, undoAction.params || {}, {});
      if (result.success) {
        addMessage({ role: 'nova', content: '↩️ Action undone successfully.' });
      } else {
        addMessage({ role: 'nova', content: `❌ Could not undo: ${result.error || 'Unknown error'}` });
      }
    } catch (err) {
      addMessage({ role: 'nova', content: `❌ Error undoing action: ${err.message}` });
    }
  }, [lastActionResult, actionRegistry, addMessage]);

  const handleSuggestionClick = useCallback((suggestion) => {
    setInput(suggestion);
    // Auto-send after a brief delay
    setTimeout(() => {
      setInput('');
      addMessage({ role: 'user', content: suggestion });
      const loadingId = 'loading-' + Date.now();
      addMessage({ role: 'nova', content: '...', id: loadingId, loading: true });

      sendNOVAMessage('compass', suggestion).then(response => {
        setMessages(prev => prev.filter(m => m.id !== loadingId));
        if (!response || !response.content) {
          addMessage({ role: 'nova', content: 'Sorry, I didn\'t get a response.' });
          return;
        }
        const actions = parseActionsFromResponse(
          typeof response === 'string' ? response : response.content || ''
        );
        const content = typeof response === 'string' ? response : response.content;
        if (actions.length > 0) {
          const msgId = Date.now().toString();
          setMessages(prev => [...prev, { role: 'nova', content, id: msgId, pendingActions: actions }]);
          setPendingAction({ action: actions[0], messageId: msgId });
        } else {
          addMessage({ role: 'nova', content });
        }
      }).catch(err => {
        setMessages(prev => prev.filter(m => m.id !== loadingId));
        addMessage({ role: 'nova', content: `Error: ${err.message}` });
      });
    }, 50);
  }, [sendNOVAMessage, addMessage]);

  const suggestions = [
    'Add a task to review Q2 metrics',
    'What should I focus on today?',
    'Break down my current goal',
  ];

  return (
    <div style={{
      display:'flex',
      flexDirection:'column',
      height:'100%',
      overflow:'hidden',
      borderTop:`1px solid ${T.border}`,
    }}>
      {/* Header */}
      <div style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        padding:'8px 10px',
        borderBottom:`1px solid ${T.border}`,
        flexShrink:0,
      }}>
        <div style={{
          display:'flex',
          alignItems:'center',
          gap:6,
        }}>
          <span style={{ fontSize:16 }}>🧭</span>
          <span style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize:10,
            color:T.accent,
            fontWeight:600,
            letterSpacing:'.06em',
          }}>NOVA CHAT</span>
          {novaLoading && (
            <span style={{
              width:6,
              height:6,
              borderRadius:'50%',
              background:T.green,
              animation:'pulse 1s infinite',
            }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background:'none',
            border:'none',
            color:T.muted,
            cursor:'pointer',
            fontSize:14,
            padding:'2px 6px',
            borderRadius:4,
            fontFamily:'monospace',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.border; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = 'none'; }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex:1,
        overflowY:'auto',
        padding:'8px 10px',
        display:'flex',
        flexDirection:'column',
        gap:8,
      }}>
        {messages.map(msg => (
          <div key={msg.id}>
            {/* Message bubble */}
            <div style={{
              display:'flex',
              gap:6,
              alignItems:'flex-start',
            }}>
              <div style={{
                width:20,
                height:20,
                borderRadius:'50%',
                background: msg.role === 'nova' ? `${T.accent}18` : T.card,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                flexShrink:0,
                fontSize:10,
                marginTop:1,
              }}>
                {msg.role === 'nova' ? '🧭' : '👤'}
              </div>
              <div style={{
                flex:1,
                fontSize:10.5,
                lineHeight:1.5,
                color: msg.loading ? T.muted : T.text,
                fontFamily:"'IBM Plex Mono',monospace",
                whiteSpace:'pre-wrap',
                wordBreak:'break-word',
              }}>
                {msg.loading ? (
                  <span style={{ animation:'pulse 1s infinite', opacity:0.5 }}>Thinking...</span>
                ) : (
                  msg.content
                )}
              </div>
            </div>

            {/* Pending action confirmation */}
            {msg.pendingActions && msg.pendingActions.length > 0 && !msg.actionCancelled && !msg.actionResult && (
              <div style={{
                marginTop:6,
                marginLeft:26,
                padding:'6px 8px',
                borderRadius:6,
                background:`${T.accent}10`,
                border:`1px solid ${T.accent}30`,
              }}>
                <div style={{
                  fontSize:9,
                  color:T.muted,
                  marginBottom:4,
                  fontFamily:"'IBM Plex Mono',monospace",
                }}>
                  NOVA wants to:
                </div>
                <div style={{
                  fontSize:10,
                  color:T.text,
                  fontWeight:600,
                  marginBottom:6,
                  fontFamily:"'Syne',sans-serif",
                }}>
                  {formatActionForDisplay(pendingAction?.action)}
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button
                    onClick={handleConfirmAction}
                    disabled={msg.executingAction}
                    style={{
                      flex:1,
                      padding:'4px 8px',
                      borderRadius:4,
                      border:'none',
                      background: T.green,
                      color: '#000',
                      fontSize:9,
                      fontWeight:600,
                      cursor:'pointer',
                      fontFamily:"'IBM Plex Mono',monospace",
                      opacity: msg.executingAction ? 0.5 : 1,
                    }}
                  >
                    {msg.executingAction ? 'Executing...' : 'Confirm'}
                  </button>
                  <button
                    onClick={handleCancelAction}
                    disabled={msg.executingAction}
                    style={{
                      flex:1,
                      padding:'4px 8px',
                      borderRadius:4,
                      border:`1px solid ${T.border}`,
                      background:'transparent',
                      color: T.muted,
                      fontSize:9,
                      cursor:'pointer',
                      fontFamily:"'IBM Plex Mono',monospace",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action result status */}
            {msg.actionResult === 'success' && (
              <div style={{
                marginTop:4,
                marginLeft:26,
                fontSize:9,
                color:T.green,
                fontFamily:"'IBM Plex Mono',monospace",
              }}>
                ✓ Action completed
              </div>
            )}
            {msg.actionResult === 'error' && (
              <div style={{
                marginTop:4,
                marginLeft:26,
                fontSize:9,
                color:T.rose,
                fontFamily:"'IBM Plex Mono',monospace",
              }}>
                ✗ {msg.actionError || 'Action failed'}
              </div>
            )}
            {msg.actionCancelled && (
              <div style={{
                marginTop:4,
                marginLeft:26,
                fontSize:9,
                color:T.muted,
                fontFamily:"'IBM Plex Mono',monospace",
              }}>
                — Cancelled
              </div>
            )}
          </div>
        ))}

        {/* Undo bar */}
        {lastActionResult && (
          <div style={{
            padding:'6px 8px',
            borderRadius:6,
            background:`${T.green}10`,
            border:`1px solid ${T.green}30`,
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            gap:6,
          }}>
            <span style={{
              fontSize:9,
              color:T.green,
              fontFamily:"'IBM Plex Mono',monospace",
            }}>
              Action completed
            </span>
            <button
              onClick={handleUndo}
              style={{
                padding:'3px 8px',
                borderRadius:4,
                border:`1px solid ${T.green}50`,
                background:'transparent',
                color: T.green,
                fontSize:9,
                cursor:'pointer',
                fontFamily:"'IBM Plex Mono',monospace",
              }}
            >
              ↩ Undo
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (shown when no messages or first message) */}
      {messages.length <= 1 && (
        <div style={{
          padding:'0 10px 8px',
          display:'flex',
          flexDirection:'column',
          gap:4,
        }}>
          <div style={{
            fontSize:8,
            color:T.muted,
            fontFamily:"'IBM Plex Mono',monospace",
            textTransform:'uppercase',
            letterSpacing:'.08em',
            marginBottom:2,
          }}>Suggestions</div>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s)}
              style={{
                textAlign:'left',
                padding:'5px 8px',
                borderRadius:5,
                border:`1px solid ${T.border}`,
                background:T.card,
                color:T.text,
                fontSize:9.5,
                cursor:'pointer',
                fontFamily:"'IBM Plex Mono',monospace",
                transition:'all .14s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent + '50'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding:'6px 8px',
        borderTop:`1px solid ${T.border}`,
        display:'flex',
        gap:4,
        flexShrink:0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message NOVA..."
          disabled={novaLoading}
          style={{
            flex:1,
            background:T.surface,
            border:`1px solid ${T.border}`,
            borderRadius:5,
            padding:'6px 8px',
            color:T.text,
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize:10,
            outline:'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || novaLoading}
          style={{
            padding:'6px 10px',
            borderRadius:5,
            border:'none',
            background: input.trim() && !novaLoading ? T.accent : T.border,
            color: input.trim() && !novaLoading ? '#000' : T.muted,
            fontSize:10,
            fontWeight:600,
            cursor: input.trim() && !novaLoading ? 'pointer' : 'default',
            fontFamily:"'IBM Plex Mono',monospace",
            transition:'all .14s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
