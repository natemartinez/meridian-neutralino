import React, { useMemo, useState } from 'react';
import { T } from '../../utils/theme.js';
import { selectGreeting, buildSessionSummary } from '../../utils/nova.js';
import { ACTION_BUTTONS, SESSION_DECISION_BUTTONS } from '../../constants/novaStartupActions.js';
import NOVAMessageBlock from './NOVAMessageBlock.jsx';

const PROG_META = {
  briefing:    { label:'Goals',       color:'#F59E0B', icon:'☀', desc:'Morning debrief' },
  focus:       { label:'Focus',       color:T.blue,    icon:'◎', desc:'Deep focus' },
  regroup:     { label:'Re-group',    color:T.purple,  icon:'⟳', desc:'Reset & refocus' },
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
  // ── Future sidebar integration props ──
  mainPage,
  addSyncEvent,
}) {
  // ── Local state ──
  const [showActionPalette, setShowActionPalette] = useState(false);

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
      padding: '80px 60px',
      overflow: 'auto',
    },
    card: {
      width: '100%',
      maxWidth: 640,
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: 0,
      overflow: 'hidden',
    },
    summaryRow: {
      display: 'flex',
      gap: 20,
      justifyContent: 'center',
      marginTop: 20,
      padding: '14px 20px',
      background: T.surface,
      borderRadius: 8,
      border: `1px solid ${T.border}`,
    },
    summaryItem: {
      textAlign: 'center',
    },
    summaryValue: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 16,
      fontWeight: 700,
      color: T.text,
    },
    summaryLabel: {
      fontFamily: "'IBM Plex Mono',monospace",
      fontSize: 8,
      fontWeight: 600,
      color: T.muted,
      letterSpacing: '.08em',
      marginTop: 2,
    },
    actionButton: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '16px 12px',
      borderRadius: 10,
      border: '1px solid transparent',
      cursor: 'pointer',
      transition: 'all .14s',
      minWidth: 130,
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
        padding: '18px 24px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${autoMeta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {autoMeta.icon}
        </div>
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 13, fontWeight: 700, color: autoMeta.color,
            letterSpacing: '.06em',
          }}>
            {autoMeta.label}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 9, color: T.muted, marginTop: 2,
          }}>
            {autoMeta.desc}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {novaLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 0',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: autoMeta.color,
              animation: 'novaPulse 1.2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 11, color: T.muted,
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
                  fontSize: 11, color: T.muted, fontStyle: 'italic',
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
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${T.blue}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ◎
        </div>

        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9, fontWeight: 700, color: T.muted,
          letterSpacing: '.12em',
        }}>
          ACTIVE FOCUS SESSION
        </div>

        <div style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 400,
        }}>
          {focusMode.taskTitle}
        </div>

        <button
          onClick={onResumeFocus}
          style={{
            marginTop: 8,
            background: T.blue,
            border: 'none',
            borderRadius: 10,
            padding: '14px 40px',
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 13,
            fontWeight: 700,
            color: '#07090f',
            cursor: 'pointer',
            letterSpacing: '.08em',
            transition: 'all .14s',
            boxShadow: `0 0 24px ${T.blue}40`,
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 32px ${T.blue}60`; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 24px ${T.blue}40`; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ▶ Resume Task
        </button>
      </div>
    </div>
  );

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
          padding: '18px 24px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${lastMeta.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {lastMeta.icon}
          </div>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 13, fontWeight: 700, color: lastMeta.color,
              letterSpacing: '.06em',
            }}>
              {lastMeta.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9, color: T.muted, marginTop: 2,
            }}>
              {sessionSummary.lastActiveLabel} · {sessionSummary.messageCount} messages
            </div>
          </div>
        </div>

        {/* Session Summary content */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{
            background: T.surface,
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            padding: '16px 20px',
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9, fontWeight: 700, color: T.muted,
              letterSpacing: '.1em',
              marginBottom: 12,
            }}>
              SESSION SUMMARY
            </div>

            {/* Selected objectives */}
            {sessionSummary.selectedCount > 0 && (
              <div style={{
                fontSize: 12, color: T.text, lineHeight: 1.6,
                marginBottom: 10,
              }}>
                You selected <strong style={{ color: lastMeta.color }}>{sessionSummary.selectedCount}</strong> objective{sessionSummary.selectedCount !== 1 ? 's' : ''} for today.
              </div>
            )}

            {/* Progress */}
            {sessionSummary.totalCount > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 9, color: T.muted,
                  marginBottom: 4,
                }}>
                  <span>Progress</span>
                  <span>{sessionSummary.completedCount}/{sessionSummary.totalCount} completed</span>
                </div>
                <div style={{
                  width: '100%', height: 4,
                  background: T.dim,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: progressPercent === 100 ? T.green : lastMeta.color,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {sessionSummary.completedCount === sessionSummary.totalCount && sessionSummary.totalCount > 0 && (
                  <div style={{
                    fontSize: 11, color: T.green, marginTop: 6,
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
              fontSize: 9, color: sessionSummary.streakDays > 0 ? T.accent : T.muted,
            }}>
              {sessionSummary.streakDays > 0
                ? `Streak: ${sessionSummary.streakDays} day${sessionSummary.streakDays > 1 ? 's' : ''}`
                : 'No active streak'}
            </div>

            {/* Last message snippet */}
            {sessionSummary.lastMessageSnippet && (
              <div style={{
                marginTop: 10,
                padding: '8px 10px',
                background: T.dim,
                borderRadius: 6,
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9, color: T.muted,
                fontStyle: 'italic',
                lineHeight: 1.5,
                maxHeight: 40,
                overflow: 'hidden',
              }}>
                "{sessionSummary.lastMessageSnippet}"
              </div>
            )}
          </div>
        </div>

        {/* Decision buttons */}
        <div style={{
          padding: '14px 24px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          gap: 8,
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
                borderRadius: 8,
                padding: '8px 16px',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9,
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
        padding: '24px 24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${T.accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ✦
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: T.text,
          textAlign: 'center',
        }}>
          {greeting}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10, color: T.muted,
          textAlign: 'center',
          maxWidth: 380,
          lineHeight: 1.5,
        }}>
          Pick a direction and I'll jump right in.
        </div>
      </div>

      {/* Action buttons grid */}
      <div style={{
        padding: '8px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
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
              <span style={{ fontSize: 20 }}>{btn.icon}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10, fontWeight: 700,
                letterSpacing: '.04em',
              }}>
                {btn.label}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 8, color: T.muted,
              }}>
                {btn.sublabel}
              </span>
            </button>
          ))}
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
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
              <span style={{ fontSize: 20 }}>{btn.icon}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10, fontWeight: 700,
                letterSpacing: '.04em',
              }}>
                {btn.label}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 8, color: T.muted,
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
          padding: '0 24px 16px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => setShowActionPalette(false)}
            style={{
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '8px 20px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
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
      `}</style>

      <div style={styles.container}>
        <div style={styles.body}>
          <div style={{
            width: '100%',
            maxWidth: 640,
            animation: 'fadeInUp 0.35s ease-out',
          }}>
            {isAutoStarting && renderAutoStart()}
            {isFocusResume && renderFocusResume()}
            {hasLastProgram && !showActionPalette && renderSessionSummary()}
            {hasLastProgram && showActionPalette && renderActionPalette(true)}
            {isNewSession && renderNovaGreeting()}
          </div>

          {/* Today's Summary (hidden during auto-start) */}
          {!isAutoStarting && renderSummaryBar()}
        </div>
      </div>
    </>
  );
}
