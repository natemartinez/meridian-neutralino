import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { T } from '../../utils/theme.js';
import { selectGreeting, buildSessionSummary } from '../../utils/nova.js';
import { ACTION_BUTTONS, SESSION_DECISION_BUTTONS } from '../../constants/novaStartupActions.js';
import NOVAMessageBlock from './NOVAMessageBlock.jsx';
import RoutingChatBox from './RoutingChatBox.jsx';

const PROG_META = {
  briefing:    { label:'Goals',       color:'#F59E0B', icon:'☀', desc:'Morning debrief' },
  focus:       { label:'Focus',       color:T.blue,    icon:'◎', desc:'Deep focus' },
  preview:     { label:'Preview',     color:T.cyan,    icon:'◷', desc:'Plan ahead' },
  calibration: { label:'Paths', color:T.accent,  icon:'◆', desc:'Roadmaps & projects' },
};

/**
 * StartupCanvas — Full-screen landing page shown on app launch.
 *
 * States:
 *   1. Auto-Start in Progress — NOVA is loading its first message
 *   2. Has Focus Session — shows focus task card with "Resume Task"
 *   3. Has Last Program — shows session summary card (Scenario B)
 *   4. New Session / No Context — NOVA proactive greeting with action buttons (Scenario A)
 *
 * Props:
 *   lastProgram          — result of getLastActiveProgram() or null
 *   focusMode            — { active, taskTitle, taskId, goalId } | null
 *   novaState            — full NOVA state (for program chats)
 *   novaLoading          — whether NOVA is currently loading
 *   pendingAutoStart     — which program is auto-starting (or null)
 *   onDismiss            — () => void
 *   onNavigate           — (page) => void
 *   onResumeFocus        — () => void
 *   onSendPreCraftedPrompt — (programId, promptText) => void
 *   onNewSession         — (programId) => void
 *   streakDays           — number
 *   lastActiveDate       — string | null
 *   onwardItems          — array
 *   projects             — array
 *   selectedForToday     — array
 */
export default function StartupCanvas({
  lastProgram,
  focusMode,
  novaState,
  novaLoading,
  pendingAutoStart,
  onDismiss,
  onNavigate,
  onResumeFocus,
  onSendPreCraftedPrompt,
  onNewSession,
  streakDays,
  lastActiveDate,
  onwardItems,
  projects,
  selectedForToday,
  setSelectedForToday,
  // ── Future sidebar integration props ──
  mainPage,
  addSyncEvent,
  // ── Subtask breakdown props ──
  suggestSubtasks,
  handleBreakdownTask,
  // ── Subtask toggle (for checklist) ──
  toggleSubtask,
  // ── Goal selection / onward navigation ──
  setSelectedId,
  setOnwardClickedItem,
}) {
  // ── Local state ──
  const [showActionPalette, setShowActionPalette] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showTop3Summary, setShowTop3Summary] = useState(false);

  // ── Derived: briefing is complete when user has selected top 3 goals ──
  // selectedForToday is persisted in localStorage, so this survives app restarts.
  const briefingComplete = Array.isArray(selectedForToday) && selectedForToday.length > 0;

  // ── Subtask breakdown state ──
  const [showSubtaskBreakdown, setShowSubtaskBreakdown] = useState(false);
  const [breakdownGoals, setBreakdownGoals] = useState([]);       // goals needing subtask breakdown
  const [currentBreakdownIdx, setCurrentBreakdownIdx] = useState(0);
  const [breakdownSuggestions, setBreakdownSuggestions] = useState([]); // [{ title, description }]
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);
  const [breakdownAccepted, setBreakdownAccepted] = useState([]); // accepted subtask arrays per goal

  // ── Derived data ──
  const isAutoStarting = !!pendingAutoStart;
  const autoMeta = isAutoStarting ? PROG_META[pendingAutoStart] : null;
  const lastMeta = lastProgram ? PROG_META[lastProgram.progId] : null;
  const isFocusResume = !isAutoStarting && focusMode?.active;
  const hasLastProgram = !isAutoStarting && !isFocusResume && !!lastProgram;
  const isNewSession = !isAutoStarting && !isFocusResume && !lastProgram;

  // Greeting text (time-aware)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return selectGreeting(hour, streakDays || 0);
  }, [streakDays]);

  // Session summary (deterministic, no AI)
  const sessionSummary = useMemo(() => {
    if (!lastProgram) return null;
    return buildSessionSummary({
      lastProgram,
      novaState,
      selectedForToday: selectedForToday || [],
      onwardItems: onwardItems || [],
      streakDays: streakDays || 0,
    });
  }, [lastProgram, novaState, selectedForToday, onwardItems, streakDays]);

  // ── Effect: trigger AI subtask suggestion when entering breakdown flow ──
  useEffect(() => {
    if (!showSubtaskBreakdown || breakdownGoals.length === 0) return;
    if (currentBreakdownIdx >= breakdownGoals.length) {
      // All goals processed — briefingComplete is already true,
      // so the post-briefing view (Today's Focus + Subtasks) will show
      setShowSubtaskBreakdown(false);
      return;
    }

    const goal = breakdownGoals[currentBreakdownIdx];
    if (!goal) return;

    const fetchSubtasks = async () => {
      setBreakdownLoading(true);
      setBreakdownError(null);
      try {
        const existing = goal.subtasks || [];
        const suggestions = await suggestSubtasks(goal.title, goal.description || '', existing);
        if (suggestions && suggestions.length > 0) {
          setBreakdownSuggestions(suggestions);
        } else {
          // No suggestions — skip this goal
          setBreakdownAccepted(prev => [...prev, []]);
          setCurrentBreakdownIdx(i => i + 1);
        }
      } catch (err) {
        setBreakdownError(err.message || 'Failed to get subtask suggestions');
        setBreakdownSuggestions([]);
      } finally {
        setBreakdownLoading(false);
      }
    };

    fetchSubtasks();
  }, [showSubtaskBreakdown, currentBreakdownIdx, breakdownGoals, suggestSubtasks]);

  // Last messages from the last active program's chat
  const lastMessages = useMemo(() => {
    if (!lastProgram || !novaState?.programChats) return [];
    const chat = novaState.programChats[lastProgram.progId];
    if (!chat) return [];
    const messages = Array.isArray(chat) ? chat : [chat];
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    return assistantMsgs.slice(-3);
  }, [lastProgram, novaState]);

  // Today's task count
  const todayTasks = useMemo(() => {
    if (!onwardItems) return 0;
    return onwardItems.filter(it => !it.done).length;
  }, [onwardItems]);

  // Goals in progress
  const goalsInProgress = useMemo(() => {
    if (!projects) return 0;
    return projects.filter(p => !p.done).length;
  }, [projects]);

  // Filter buttons based on context
  const visibleButtons = useMemo(() => {
    const hasProjects = Array.isArray(projects) && projects.length > 0;
    return ACTION_BUTTONS.filter(btn => !btn.contextRequired || hasProjects);
  }, [projects]);

  // ── Handlers ──
  const handleActionButtonClick = (button) => {
    if (novaLoading || isAutoStarting) return; // Disable during loading
    if (button.id === 'find-the-win') {
      setShowGoalPicker(true);
      return;
    }
    if (onSendPreCraftedPrompt) {
      onSendPreCraftedPrompt(button.targetProgram, button.prompt);
    }
  };

  const handleDecisionButton = (decision) => {
    switch (decision.action) {
      case 'navigate':
        if (lastProgram) onNavigate(`program-${lastProgram.progId}`);
        break;
      case 'new_session':
        if (lastProgram && onNewSession) {
          onNewSession(lastProgram.progId);
          onNavigate(`program-${lastProgram.progId}`);
        }
        break;
      case 'toggle_palette':
        setShowActionPalette(true);
        break;
      case 'dismiss':
        if (onDismiss) onDismiss();
        break;
      default:
        break;
    }
  };

  // ── Shared styles ──
  const styles = {
    container: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      background: T.bg,
    },
    body: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '50px 80px',
      overflow: 'auto',
    },
    card: {
      width: '100%',
      maxWidth: 800,
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: 0,
      overflow: 'hidden',
    },
    summaryRow: {
      display: 'flex',
      gap: 28,
      justifyContent: 'center',
      marginTop: 24,
      padding: '18px 28px',
      background: T.surface,
      borderRadius: 10,
      border: `1px solid ${T.border}`,
    },
    summaryItem: {
      textAlign: 'center',
    },
    summaryValue: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 20,
      fontWeight: 700,
      color: T.text,
    },
    summaryLabel: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 10,
      fontWeight: 600,
      color: T.muted,
      letterSpacing: '.08em',
      marginTop: 3,
    },
    actionButton: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      padding: '20px 16px',
      borderRadius: 12,
      border: '1px solid transparent',
      cursor: 'pointer',
      transition: 'all .14s',
      minWidth: 160,
      flex: 1,
    },
    actionButtonDisabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
      pointerEvents: 'none',
    },
  };

  // ── Render helpers ──

  /** Auto-Start in Progress state */
  const renderAutoStart = () => (
    <div style={styles.card}>
      <div style={{
        padding: '22px 30px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${autoMeta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {autoMeta.icon}
        </div>
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 16, fontWeight: 700, color: autoMeta.color,
            letterSpacing: '.06em',
          }}>
            {autoMeta.label}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11, color: T.muted, marginTop: 3,
          }}>
            {autoMeta.desc}
          </div>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        {novaLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 0',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: autoMeta.color,
              animation: 'novaPulse 1.2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 13, color: T.muted,
              letterSpacing: '.04em',
            }}>
              NOVA is thinking…
            </span>
          </div>
        ) : (
          <div style={{ opacity: 0.9 }}>
            {(() => {
              const chat = novaState?.programChats?.[pendingAutoStart];
              const messages = Array.isArray(chat) ? chat : [];
              const lastMsg = messages.filter(m => m.role === 'assistant').pop();
              return lastMsg ? (
                <NOVAMessageBlock content={lastMsg.content} color={autoMeta.color} />
              ) : (
                <div style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 13, color: T.muted, fontStyle: 'italic',
                }}>
                  Waiting for NOVA's response…
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );

  /** Focus Resume state */
  const renderFocusResume = () => (
    <div style={styles.card}>
      <div style={{
        padding: '40px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 14,
          background: `${T.blue}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          ◎
        </div>

        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 11, fontWeight: 700, color: T.muted,
          letterSpacing: '.12em',
        }}>
          ACTIVE FOCUS SESSION
        </div>

        <div style={{
          fontSize: 26, fontWeight: 700, color: T.text,
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 500,
        }}>
          {focusMode.taskTitle}
        </div>

        <button
          onClick={onResumeFocus}
          style={{
            marginTop: 10,
            background: T.blue,
            border: 'none',
            borderRadius: 12,
            padding: '16px 48px',
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 15,
            fontWeight: 700,
            color: '#07090f',
            cursor: 'pointer',
            letterSpacing: '.08em',
            transition: 'all .14s',
            boxShadow: `0 0 30px ${T.blue}40`,
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${T.blue}60`; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 30px ${T.blue}40`; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ▶ Resume Task
        </button>
      </div>
    </div>
  );

  /** Continue Session card — prominent resume button for the last active program */
  const renderContinueSession = () => {
    if (!lastProgram || !lastMeta) return null;

    return (
      <div style={{
        ...styles.card,
        marginBottom: 20,
        border: `1px solid ${lastMeta.color}50`,
        boxShadow: `0 0 36px ${lastMeta.color}20`,
      }}>
        <button
          onClick={() => {
            if (onSendPreCraftedPrompt) {
              onSendPreCraftedPrompt(lastProgram.progId, 'Continue our last conversation. Pick up right where we left off.');
            }
          }}
          disabled={novaLoading || isAutoStarting}
          style={{
            width: '100%',
            padding: '34px 30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            background: 'none',
            border: 'none',
            cursor: (novaLoading || isAutoStarting) ? 'not-allowed' : 'pointer',
            opacity: (novaLoading || isAutoStarting) ? 0.4 : 1,
            transition: 'all .14s',
          }}
          onMouseEnter={e => {
            if (!novaLoading && !isAutoStarting) {
              e.currentTarget.style.background = `${lastMeta.color}08`;
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
          }}
        >
          <div style={{
            width: 54, height: 54, borderRadius: 14,
            background: `${lastMeta.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
            flexShrink: 0,
          }}>
            ▶
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 16, fontWeight: 700, color: lastMeta.color,
              letterSpacing: '.06em',
            }}>
              Continue Session
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11, color: T.muted, marginTop: 4,
            }}>
              Resume {lastMeta.label} — {lastProgram.messageCount || 0} messages
            </div>
          </div>
          <div style={{
            marginLeft: 'auto',
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12, color: lastMeta.color,
            fontWeight: 700,
            letterSpacing: '.04em',
            opacity: 0.7,
          }}>
            ▶
          </div>
        </button>
      </div>
    );
  };

  /** Session Summary card — replaces renderLastProgram (Scenario B) */
  const renderSessionSummary = () => {
    if (!sessionSummary || !lastMeta) return null;

    const progressPercent = sessionSummary.totalCount > 0
      ? Math.round((sessionSummary.completedCount / sessionSummary.totalCount) * 100)
      : 0;

    return (
      <div style={styles.card}>
        {/* Program header */}
        <div style={{
          padding: '22px 30px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${lastMeta.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {lastMeta.icon}
          </div>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 16, fontWeight: 700, color: lastMeta.color,
              letterSpacing: '.06em',
            }}>
              {lastMeta.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11, color: T.muted, marginTop: 3,
            }}>
              {sessionSummary.lastActiveLabel} · {sessionSummary.messageCount} messages
            </div>
          </div>
        </div>

        {/* Session Summary content */}
        <div style={{ padding: '24px 30px' }}>
          <div style={{
            background: T.surface,
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            padding: '20px 24px',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11, fontWeight: 700, color: T.muted,
              letterSpacing: '.1em',
              marginBottom: 14,
            }}>
              SESSION SUMMARY
            </div>

            {/* Selected objectives */}
            {sessionSummary.selectedCount > 0 && (
              <div style={{
                fontSize: 14, color: T.text, lineHeight: 1.6,
                marginBottom: 12,
              }}>
                You selected <strong style={{ color: lastMeta.color }}>{sessionSummary.selectedCount}</strong> objective{sessionSummary.selectedCount !== 1 ? 's' : ''} for today.
              </div>
            )}

            {/* Progress */}
            {sessionSummary.totalCount > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 11, color: T.muted,
                  marginBottom: 5,
                }}>
                  <span>Progress</span>
                  <span>{sessionSummary.completedCount}/{sessionSummary.totalCount} completed</span>
                </div>
                <div style={{
                  width: '100%', height: 5,
                  background: T.dim,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: progressPercent === 100 ? T.green : lastMeta.color,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {sessionSummary.completedCount === sessionSummary.totalCount && sessionSummary.totalCount > 0 && (
                  <div style={{
                    fontSize: 13, color: T.green, marginTop: 8,
                    fontWeight: 600,
                  }}>
                    All objectives completed! 🎉
                  </div>
                )}
              </div>
            )}

            {/* Streak */}
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11, color: sessionSummary.streakDays > 0 ? T.accent : T.muted,
            }}>
              {sessionSummary.streakDays > 0
                ? `Streak: ${sessionSummary.streakDays} day${sessionSummary.streakDays > 1 ? 's' : ''}`
                : 'No active streak'}
            </div>

            {/* Last message snippet */}
            {sessionSummary.lastMessageSnippet && (
              <div style={{
                marginTop: 12,
                padding: '10px 12px',
                background: T.dim,
                borderRadius: 8,
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11, color: T.muted,
                fontStyle: 'italic',
                lineHeight: 1.5,
                maxHeight: 48,
                overflow: 'hidden',
              }}>
                "{sessionSummary.lastMessageSnippet}"
              </div>
            )}
          </div>
        </div>

        {/* Decision buttons */}
        <div style={{
          padding: '16px 30px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {SESSION_DECISION_BUTTONS.map(btn => (
            <button
              key={btn.id}
              onClick={() => handleDecisionButton(btn)}
              disabled={novaLoading || isAutoStarting}
              style={{
                background: btn.id === 'continue'
                  ? `${lastMeta.color}18`
                  : 'transparent',
                border: `1px solid ${btn.id === 'continue' ? `${lastMeta.color}40` : T.border}`,
                borderRadius: 10,
                padding: '10px 20px',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11,
                fontWeight: 700,
                color: btn.id === 'continue' ? lastMeta.color : T.text,
                cursor: (novaLoading || isAutoStarting) ? 'not-allowed' : 'pointer',
                letterSpacing: '.06em',
                transition: 'all .14s',
                opacity: (novaLoading || isAutoStarting) ? 0.4 : 1,
              }}
              onMouseEnter={e => {
                if (!novaLoading && !isAutoStarting) {
                  e.currentTarget.style.background = `${lastMeta.color}28`;
                  e.currentTarget.style.borderColor = `${lastMeta.color}70`;
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = btn.id === 'continue' ? `${lastMeta.color}18` : 'transparent';
                e.currentTarget.style.borderColor = btn.id === 'continue' ? `${lastMeta.color}40` : T.border;
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  /** Shared action button palette (used by both Scenario A and "Different Action" toggle) */
  const renderActionPalette = (showBackToSummary) => (
    <div style={styles.card}>
      {/* NOVA Greeting header */}
      <div style={{
        padding: '30px 30px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 14,
          background: `${T.accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          ✦
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          textAlign: 'center',
        }}>
          {greeting}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 12, color: T.muted,
          textAlign: 'center',
          maxWidth: 480,
          lineHeight: 1.5,
        }}>
          Pick a direction and I'll jump right in.
        </div>
      </div>

      {/* ── Routing Chat Box ── */}
      <RoutingChatBox
        onSendPreCraftedPrompt={onSendPreCraftedPrompt}
        novaLoading={novaLoading || isAutoStarting}
      />

      {/* Action buttons grid */}
      <div style={{
        padding: '10px 30px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          {visibleButtons.slice(0, 3).map(btn => (
            <button
              key={btn.id}
              onClick={() => handleActionButtonClick(btn)}
              disabled={novaLoading || isAutoStarting}
              style={{
                ...styles.actionButton,
                background: `${btn.color}12`,
                borderColor: `${btn.color}30`,
                color: btn.color,
                opacity: (novaLoading || isAutoStarting) ? 0.4 : 1,
                cursor: (novaLoading || isAutoStarting) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!novaLoading && !isAutoStarting) {
                  e.currentTarget.style.background = `${btn.color}20`;
                  e.currentTarget.style.borderColor = `${btn.color}60`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${btn.color}12`;
                e.currentTarget.style.borderColor = `${btn.color}30`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: 24 }}>{btn.icon}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 12, fontWeight: 700,
                letterSpacing: '.04em',
              }}>
                {btn.label}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10, color: T.muted,
              }}>
                {btn.sublabel}
              </span>
            </button>
          ))}
        </div>
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          {visibleButtons.slice(3).map(btn => (
            <button
              key={btn.id}
              onClick={() => handleActionButtonClick(btn)}
              disabled={novaLoading || isAutoStarting}
              style={{
                ...styles.actionButton,
                background: `${btn.color}12`,
                borderColor: `${btn.color}30`,
                color: btn.color,
                opacity: (novaLoading || isAutoStarting) ? 0.4 : 1,
                cursor: (novaLoading || isAutoStarting) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!novaLoading && !isAutoStarting) {
                  e.currentTarget.style.background = `${btn.color}20`;
                  e.currentTarget.style.borderColor = `${btn.color}60`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${btn.color}12`;
                e.currentTarget.style.borderColor = `${btn.color}30`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: 24 }}>{btn.icon}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 12, fontWeight: 700,
                letterSpacing: '.04em',
              }}>
                {btn.label}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10, color: T.muted,
              }}>
                {btn.sublabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Back to Summary button (only when toggled from session summary) */}
      {showBackToSummary && (
        <div style={{
          padding: '0 30px 20px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => setShowActionPalette(false)}
            style={{
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '10px 24px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11,
              fontWeight: 700,
              color: T.muted,
              cursor: 'pointer',
              letterSpacing: '.06em',
              transition: 'all .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.muted; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
          >
            ← Back to Summary
          </button>
        </div>
      )}
    </div>
  );

  /** NOVA Greeting card — replaces renderFirstLaunch (Scenario A) */
  const renderNovaGreeting = () => renderActionPalette(false);

  /**
   * Goal Picker — "Find the Win" UI for selecting top 3 priorities.
   * Shows a list of non-done goals with Add/Remove buttons (max 3).
   */
  const renderGoalPicker = () => {
    const nonDoneGoals = (projects || []).filter(p => !p.done);
    const hasProjects = nonDoneGoals.length > 0;

    const toggleGoal = (goalId) => {
      setSelectedForToday(prev => {
        if (prev.includes(goalId)) return prev.filter(id => id !== goalId);
        if (prev.length >= 3) return prev;
        return [...prev, goalId];
      });
    };

    const handleConfirm = () => {
      setShowGoalPicker(false);

      // Check which selected goals lack subtasks
      const selectedGoals = (selectedForToday || [])
        .map(id => (projects || []).find(p => p.id === id))
        .filter(Boolean);

      const goalsNeedingBreakdown = selectedGoals.filter(
        g => !g.subtasks || g.subtasks.length === 0
      );

      if (goalsNeedingBreakdown.length > 0 && suggestSubtasks) {
        // Start subtask breakdown flow
        setBreakdownGoals(goalsNeedingBreakdown);
        setCurrentBreakdownIdx(0);
        setBreakdownAccepted([]);
        setShowSubtaskBreakdown(true);
      } else {
        // All goals have subtasks — go directly to post-briefing view
        // (Today's Focus + Today's Subtasks replace HQ buttons)
        // No need to show Top 3 Summary — briefingComplete handles the transition
      }
    };

    const handleCancel = () => {
      setShowGoalPicker(false);
    };

    return (
      <div style={{
        ...styles.card,
        animation: 'fadeInUp 0.35s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '30px 30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: `${T.accent}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🎯
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: T.text,
            textAlign: 'center',
          }}>
            Find the Win
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12, color: T.muted,
            textAlign: 'center',
            maxWidth: 480,
            lineHeight: 1.5,
          }}>
            Pick your top 3 priorities for today
          </div>
        </div>

        {/* Goal list */}
        <div style={{
          padding: '0 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {!hasProjects ? (
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 12, color: T.muted,
              textAlign: 'center',
              padding: '20px 0',
            }}>
              No goals yet. Create some goals first to use Find the Win.
            </div>
          ) : (
            nonDoneGoals.map(goal => {
              const isSelected = selectedForToday.includes(goal.id);
              const subtaskCount = goal.subtasks?.length || 0;
              const doneCount = goal.subtasks?.filter(st => st.done).length || 0;
              return (
                <div key={goal.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: isSelected ? `${T.accent}10` : `${T.bg}`,
                  border: `1px solid ${isSelected ? `${T.accent}40` : T.border}`,
                  transition: 'all .14s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 13, fontWeight: 700,
                      color: T.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {goal.title}
                    </div>
                    {subtaskCount > 0 && (
                      <div style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 10, color: T.muted,
                        marginTop: 2,
                      }}>
                        {doneCount}/{subtaskCount} subtasks done
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleGoal(goal.id)}
                    style={{
                      flexShrink: 0,
                      width: 36, height: 36,
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? T.accent : T.border}`,
                      background: isSelected ? T.accent : 'transparent',
                      color: isSelected ? '#fff' : T.muted,
                      fontSize: 16,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .14s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = T.accent;
                        e.currentTarget.style.color = T.accent;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.color = T.muted;
                      }
                    }}
                  >
                    {isSelected ? '✓' : '+'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Selection count & actions */}
        <div style={{
          padding: '16px 30px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11, color: T.muted,
          }}>
            Selected: {selectedForToday.length}/3
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: '10px 24px',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                cursor: 'pointer',
                letterSpacing: '.06em',
                transition: 'all .14s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.muted; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedForToday.length === 0}
              style={{
                background: selectedForToday.length === 0 ? `${T.muted}30` : T.accent,
                border: 'none',
                borderRadius: 10,
                padding: '10px 24px',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11,
                fontWeight: 700,
                color: selectedForToday.length === 0 ? T.muted : '#fff',
                cursor: selectedForToday.length === 0 ? 'not-allowed' : 'pointer',
                letterSpacing: '.06em',
                opacity: selectedForToday.length === 0 ? 0.5 : 1,
                transition: 'all .14s',
              }}
            >
              Confirm Top 3
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Top 3 Summary — shows the selected goals after confirmation.
   * Provides "Launch Session" to start a briefing with goals context,
   * and "Change" to go back to the goal picker.
   */
  const renderTop3Summary = () => {
    const selectedGoals = (selectedForToday || [])
      .map(id => (projects || []).find(p => p.id === id))
      .filter(Boolean);

    const handleLaunch = () => {
      const goalTitles = selectedGoals.map(g => g.title).join(', ');
      const prompt = `Help me focus on my top 3 priorities for today: ${goalTitles}. Guide me through a briefing and preview session to make these happen.`;
      setShowTop3Summary(false);
      if (onSendPreCraftedPrompt) {
        onSendPreCraftedPrompt('briefing', prompt);
      }
    };

    const handleChange = () => {
      setShowTop3Summary(false);
      setShowGoalPicker(true);
    };

    return (
      <div style={{
        ...styles.card,
        animation: 'fadeInUp 0.35s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '30px 30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: `${T.green}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            ✅
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: T.text,
            textAlign: 'center',
          }}>
            Today's Top 3
          </div>
        </div>

        {/* Goal list */}
        <div style={{
          padding: '0 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {selectedGoals.map((goal, idx) => (
            <div key={goal.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 10,
              background: `${T.green}08`,
              border: `1px solid ${T.green}30`,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: T.green,
                color: '#fff',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {idx + 1}
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 13, fontWeight: 700,
                color: T.text,
              }}>
                {goal.title}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px 30px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
        }}>
          <button
            onClick={handleChange}
            style={{
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: '10px 24px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11,
              fontWeight: 700,
              color: T.muted,
              cursor: 'pointer',
              letterSpacing: '.06em',
              transition: 'all .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.muted; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
          >
            Change
          </button>
          <button
            onClick={handleLaunch}
            style={{
              background: T.accent,
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              letterSpacing: '.06em',
              transition: 'all .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Launch Session
          </button>
        </div>
      </div>
    );
  };

  /**
   * Subtask Breakdown — AI suggests subtasks for goals that lack them.
   * Shows one goal at a time with accept/reject UI.
   */
  const renderSubtaskBreakdown = () => {
    const goal = breakdownGoals[currentBreakdownIdx];
    if (!goal) return null;

    const handleAccept = () => {
      if (breakdownSuggestions.length > 0) {
        setBreakdownAccepted(prev => [...prev, breakdownSuggestions]);
        // Persist subtasks via handleBreakdownTask
        if (handleBreakdownTask) {
          handleBreakdownTask(goal, breakdownSuggestions);
        }
      }
      setBreakdownSuggestions([]);
      setCurrentBreakdownIdx(i => i + 1);
    };

    const handleSkip = () => {
      setBreakdownAccepted(prev => [...prev, []]);
      setBreakdownSuggestions([]);
      setCurrentBreakdownIdx(i => i + 1);
    };

    const handleRetry = () => {
      // Re-trigger by resetting the current index (effect will re-run)
      setBreakdownSuggestions([]);
      setBreakdownError(null);
      setCurrentBreakdownIdx(i => i); // same index — effect watches currentBreakdownIdx
    };

    const progress = `${currentBreakdownIdx + 1} / ${breakdownGoals.length}`;

    return (
      <div style={{
        ...styles.card,
        animation: 'fadeInUp 0.35s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '30px 30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: `${T.blue}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🧩
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: T.text,
            textAlign: 'center',
          }}>
            Breaking Down Goals
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11, color: T.muted,
            textAlign: 'center',
          }}>
            Goal {progress}
          </div>
        </div>

        {/* Current goal being broken down */}
        <div style={{
          padding: '0 30px',
        }}>
          <div style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: `${T.accent}08`,
            border: `1px solid ${T.accent}25`,
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 11, color: T.muted,
              fontFamily: "'IBM Plex Mono',monospace",
              marginBottom: 4,
            }}>
              CURRENT GOAL
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: T.text,
            }}>
              {goal.title}
            </div>
            {goal.description && (
              <div style={{
                fontSize: 11, color: T.muted,
                fontFamily: "'IBM Plex Mono',monospace",
                marginTop: 4,
                lineHeight: 1.4,
              }}>
                {goal.description}
              </div>
            )}
          </div>

          {/* Loading state */}
          {breakdownLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '24px 0',
            }}>
              <div style={{
                width: 32, height: 32,
                border: `2px solid ${T.blue}30`,
                borderTopColor: T.blue,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11, color: T.muted,
                textAlign: 'center',
              }}>
                NOVA is analyzing this goal and suggesting subtasks...
              </div>
            </div>
          )}

          {/* Error state */}
          {breakdownError && !breakdownLoading && (
            <div style={{
              padding: '16px',
              borderRadius: 8,
              background: `${T.rose}10`,
              border: `1px solid ${T.rose}30`,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11, color: T.rose,
                marginBottom: 8,
              }}>
                {breakdownError}
              </div>
              <button
                onClick={handleRetry}
                style={{
                  background: T.rose,
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Suggested subtasks */}
          {!breakdownLoading && !breakdownError && breakdownSuggestions.length > 0 && (
            <>
              <div style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 11, color: T.muted,
                marginBottom: 10,
              }}>
                NOVA suggests these subtasks:
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 16,
              }}>
                {breakdownSuggestions.map((st, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: `${T.bg}`,
                    border: `1px solid ${T.border}`,
                  }}>
                    <div style={{
                      width: 20, height: 20,
                      borderRadius: 4,
                      background: `${T.blue}15`,
                      color: T.blue,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: T.text,
                        marginBottom: 2,
                      }}>
                        {st.title}
                      </div>
                      {st.description && (
                        <div style={{
                          fontSize: 10, color: T.muted,
                          fontFamily: "'IBM Plex Mono',monospace",
                          lineHeight: 1.4,
                        }}>
                          {st.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Accept / Skip buttons */}
              <div style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'center',
                paddingBottom: 24,
              }}>
                <button
                  onClick={handleSkip}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: '10px 24px',
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.muted,
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    transition: 'all .14s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.muted; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
                >
                  Skip
                </button>
                <button
                  onClick={handleAccept}
                  style={{
                    background: T.blue,
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 24px',
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    transition: 'all .14s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Accept Subtasks
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /**
   * Compact Carousel — horizontal scrollable program buttons shown
   * when selectedForToday is active, replacing the full action palette.
   */
  const renderCompactCarousel = () => {
    const selectedGoals = (selectedForToday || [])
      .map(id => (projects || []).find(p => p.id === id))
      .filter(Boolean);

    if (selectedGoals.length === 0) return null;

    return (
      <div style={{
        ...styles.card,
        animation: 'fadeInUp 0.35s ease-out 0.1s both',
        marginTop: 16,
      }}>
        <div style={{
          padding: '15px 25px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{
            fontSize: 15, fontWeight: 700, color: T.text,
            letterSpacing: '.04em',
          }}>
            Today's Focus
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11, color: T.muted,
            marginLeft: 'auto',
          }}>
            {selectedGoals.length} priority
          </span>
        </div>
        <div style={{
          padding: '13px 25px 18px',
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${T.border} ${T.bg}`,
          WebkitOverflowScrolling: 'touch',
        }}>
          {selectedGoals.map((goal, idx) => {
            const colors = [T.accent, T.blue, T.green];
            const color = colors[idx % colors.length];
            const subtaskCount = goal.subtasks?.length || 0;
            const doneCount = goal.subtasks?.filter(st => st.done).length || 0;
            return (
              <button
                key={goal.id}
                onClick={() => {
                  // Highlight the goal in the canvas and navigate to Focus → Onward
                  if (setSelectedId) setSelectedId(goal.id);
                  if (setOnwardClickedItem) {
                    setOnwardClickedItem({ goalId: goal.id, title: goal.title, source: 'today-focus' });
                  }
                  if (onNavigate) onNavigate('program-focus');
                }}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 5,
                  padding: '13px 18px',
                  borderRadius: 12,
                  background: `${color}10`,
                  border: `1px solid ${color}30`,
                  cursor: 'pointer',
                  minWidth: 175,
                  maxWidth: 250,
                  transition: 'all .14s',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${color}20`;
                  e.currentTarget.style.borderColor = `${color}60`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${color}10`;
                  e.currentTarget.style.borderColor = `${color}30`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                }}>
                  <div style={{
                    width: 25, height: 25,
                    borderRadius: '50%',
                    background: color,
                    color: '#fff',
                    fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: T.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}>
                    {goal.title}
                  </div>
                </div>
                {subtaskCount > 0 && (
                  <div style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 11, color: T.muted,
                    marginTop: 3,
                  }}>
                    {doneCount}/{subtaskCount} subtasks
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Subtask Checklist — shows subtasks for selectedForToday goals
   * when viewing the default HQ state (not in goal picker/summary/breakdown).
   */
  const renderSelectedForTodayChecklist = () => {
    const selectedGoals = (selectedForToday || [])
      .map(id => (projects || []).find(p => p.id === id))
      .filter(Boolean);

    if (selectedGoals.length === 0) return null;

    const allSubtasks = selectedGoals.flatMap(goal =>
      (goal.subtasks || []).map(st => ({ ...st, goalTitle: goal.title, goalId: goal.id }))
    );

    if (allSubtasks.length === 0) return null;

    return (
      <div style={{
        ...styles.card,
        animation: 'fadeInUp 0.35s ease-out 0.15s both',
        marginTop: 20,
      }}>
        <div style={{
          padding: '20px 25px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 13,
        }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: T.text,
            letterSpacing: '.04em',
          }}>
            Today's Subtasks
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 13, color: T.muted,
            marginLeft: 'auto',
          }}>
            {allSubtasks.filter(st => st.done).length}/{allSubtasks.length} done
          </span>
        </div>
        <div style={{ padding: '10px 25px 15px' }}>
          {allSubtasks.map((st, idx) => (
            <div key={st.id || idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: '9px 0',
              borderBottom: idx < allSubtasks.length - 1 ? `1px solid ${T.border}40` : 'none',
            }}>
              <div style={{
                width: 20, height: 20,
                borderRadius: 4,
                border: `2px solid ${st.done ? T.green : T.dim}`,
                background: st.done ? `${T.green}20` : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                color: st.done ? T.green : 'transparent',
                cursor: 'pointer',
                transition: 'all .14s',
              }}
                onClick={() => {
                  if (toggleSubtask && st.id && st.goalId) {
                    toggleSubtask(st.goalId, st.id);
                  }
                }}
              >
                {st.done ? '✓' : ''}
              </div>
              <div style={{
                flex: 1,
                fontSize: 15,
                color: st.done ? T.muted : T.text,
                textDecoration: st.done ? 'line-through' : 'none',
                fontFamily: st.done ? "'IBM Plex Mono',monospace" : 'inherit',
              }}>
                {st.title}
              </div>
              <div style={{
                fontSize: 11, color: T.muted,
                fontFamily: "'IBM Plex Mono',monospace",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 150,
              }}>
                {st.goalTitle}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /** Today's summary bar (extracted from inline code) */
  const renderSummaryBar = () => (
    <div style={{
      ...styles.summaryRow,
      animation: 'fadeInUp 0.35s ease-out 0.1s both',
    }}>
      <div style={styles.summaryItem}>
        <div style={styles.summaryValue}>{todayTasks}</div>
        <div style={styles.summaryLabel}>TASKS TODAY</div>
      </div>
      <div style={{ width: 1, background: T.border }} />
      <div style={styles.summaryItem}>
        <div style={{ ...styles.summaryValue, color: streakDays > 0 ? T.accent : T.muted }}>
          {streakDays || 0}
        </div>
        <div style={styles.summaryLabel}>DAY STREAK</div>
      </div>
      <div style={{ width: 1, background: T.border }} />
      <div style={styles.summaryItem}>
        <div style={styles.summaryValue}>{goalsInProgress}</div>
        <div style={styles.summaryLabel}>GOALS ACTIVE</div>
      </div>
    </div>
  );

  // ── Main render ──

  return (
    <>
      <style>{`
        @keyframes novaPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.body}>
          <div style={{
            width: '100%',
            maxWidth: 800,
            animation: 'fadeInUp 0.35s ease-out',
          }}>
            {showSubtaskBreakdown && renderSubtaskBreakdown()}
            {!showSubtaskBreakdown && showGoalPicker && renderGoalPicker()}
            {!showSubtaskBreakdown && showTop3Summary && renderTop3Summary()}
            {!showSubtaskBreakdown && !showGoalPicker && !showTop3Summary && (
              <>
                {isAutoStarting && renderAutoStart()}
                {isFocusResume && renderFocusResume()}
                {hasLastProgram && !showActionPalette && !briefingComplete && (
                  <>
                    {renderContinueSession()}
                    {renderSessionSummary()}
                  </>
                )}
                {hasLastProgram && showActionPalette && !briefingComplete && renderActionPalette(true)}
                {isNewSession && !briefingComplete && renderNovaGreeting()}

                {/* ── Post-briefing: replace HQ buttons with Today's Focus + Subtasks ── */}
                {briefingComplete && (
                  <>
                    {renderCompactCarousel()}
                    {renderSelectedForTodayChecklist()}
                  </>
                )}
              </>
            )}
          </div>

          {/* Compact Carousel — shown when selectedForToday is active and on default view (outside post-briefing) */}
          {!isAutoStarting && !showGoalPicker && !showTop3Summary && !showSubtaskBreakdown && !briefingComplete && renderCompactCarousel()}

          {/* Today's Subtask Checklist — shown when selectedForToday has items with subtasks (outside post-briefing) */}
          {!isAutoStarting && !showGoalPicker && !showTop3Summary && !showSubtaskBreakdown && !briefingComplete && renderSelectedForTodayChecklist()}

          {/* Today's Summary (hidden during auto-start) */}
          {!isAutoStarting && renderSummaryBar()}
        </div>
      </div>
    </>
  );
}
