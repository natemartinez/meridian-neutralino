import React, { useMemo } from 'react';
import { T } from '../../utils/theme.js';
import NOVAMessageBlock from './NOVAMessageBlock.jsx';

const PROG_META = {
  briefing:    { label:'Goals',       color:'#F59E0B', icon:'☀', desc:'Morning debrief' },
  focus:       { label:'Focus',       color:T.blue,    icon:'◎', desc:'Lock in plan' },
  regroup:     { label:'Re-group',    color:T.purple,  icon:'⟳', desc:'Recalibrate' },
  preview:     { label:'Preview',     color:T.cyan,    icon:'◷', desc:'Plan the next day' },
  calibration: { label:'Paths', color:T.accent,  icon:'◆', desc:'Personal projects & roadmaps' },
};

/**
 * StartupCanvas — Full-screen landing page shown on app launch.
 *
 * States:
 *   1. Auto-Start in Progress — NOVA is loading its first message
 *   2. Has Last Program — shows last chat messages + "Continue Conversation"
 *   3. Has Focus Session — shows focus task card with "Resume Task"
 *   4. First Launch / No Context — welcome message with quick-start buttons
 *
 * Props:
 *   lastProgram     — result of getLastActiveProgram() or null
 *   focusMode       — { active, taskTitle, taskId, goalId } | null
 *   novaState       — full NOVA state (for program chats)
 *   novaLoading     — whether NOVA is currently loading
 *   pendingAutoStart — which program is auto-starting (or null)
 *   onDismiss       — () => void  (dismiss canvas, show HQ)
 *   onNavigate      — (page) => void  (navigate & dismiss)
 *   onResumeFocus   — () => void  (re-enter focus mode)
 *   streakDays      — number
 *   lastActiveDate  — string | null
 *   onwardItems     — array
 *   projects        — array
 *   T               — theme object
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
  streakDays,
  lastActiveDate,
  onwardItems,
  projects,
  // ── Future sidebar integration props ──
  mainPage,
  addSyncEvent,
}) {
  // ── Derived data ──
  const isAutoStarting = !!pendingAutoStart;
  const autoMeta = isAutoStarting ? PROG_META[pendingAutoStart] : null;
  const lastMeta = lastProgram ? PROG_META[lastProgram.progId] : null;
  const isFocusResume = !isAutoStarting && focusMode?.active;
  const hasLastProgram = !isAutoStarting && !isFocusResume && !!lastProgram;
  const isFirstLaunch = !isAutoStarting && !isFocusResume && !lastProgram;

  // Last messages from the last active program's chat
  const lastMessages = useMemo(() => {
    if (!lastProgram || !novaState?.programChats) return [];
    const chat = novaState.programChats[lastProgram.progId];
    if (!chat) return [];
    const messages = Array.isArray(chat) ? chat : [chat];
    // Get last 2-3 assistant messages
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
  };

  // ── Render helpers ──

  /** Auto-Start in Progress state */
  const renderAutoStart = () => (
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

      {/* Loading / first message */}
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
            {/* Show the last assistant message if available */}
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

  /** Focus Resume state — large card with prominent Resume Task button */
  const renderFocusResume = () => (
    <div style={styles.card}>
      <div style={{
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Focus icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${T.blue}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ◎
        </div>

        {/* Label */}
        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 9, fontWeight: 700, color: T.muted,
          letterSpacing: '.12em',
        }}>
          ACTIVE FOCUS SESSION
        </div>

        {/* Task title */}
        <div style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 400,
        }}>
          {focusMode.taskTitle}
        </div>

        {/* Resume button — large and prominent */}
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

  /** Last Program state — shows chat history + Continue button */
  const renderLastProgram = () => (
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
            {lastProgram.messageCount} messages · {lastMeta.desc}
          </div>
        </div>
      </div>

      {/* Last messages */}
      <div style={{ padding: '16px 24px', maxHeight: 280, overflow: 'auto' }}>
        {lastMessages.length === 0 ? (
          <div style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10, color: T.muted, fontStyle: 'italic',
          }}>
            No previous messages
          </div>
        ) : (
          lastMessages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: i < lastMessages.length - 1 ? 14 : 0,
              opacity: i < lastMessages.length - 1 ? 0.6 : 1,
            }}>
              <NOVAMessageBlock content={msg.content} color={lastMeta.color} />
            </div>
          ))
        )}
      </div>

      {/* Continue button */}
      <div style={{
        padding: '14px 24px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <button
          onClick={() => onNavigate(`program-${lastProgram.progId}`)}
          style={{
            background: `${lastMeta.color}18`,
            border: `1px solid ${lastMeta.color}40`,
            borderRadius: 8,
            padding: '10px 28px',
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 11,
            fontWeight: 700,
            color: lastMeta.color,
            cursor: 'pointer',
            letterSpacing: '.06em',
            transition: 'all .14s',
            width: '100%',
            maxWidth: 300,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${lastMeta.color}28`; e.currentTarget.style.borderColor = `${lastMeta.color}70`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${lastMeta.color}18`; e.currentTarget.style.borderColor = `${lastMeta.color}40`; }}
        >
          Continue Conversation →
        </button>
      </div>
    </div>
  );

  /** First Launch state — welcome message + quick-start buttons */
  const renderFirstLaunch = () => (
    <div style={styles.card}>
      <div style={{
        padding: '60px 28px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Welcome icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: `${T.accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          ✦
        </div>

        <div style={{
          fontSize: 22, fontWeight: 700, color: T.text,
          textAlign: 'center',
        }}>
          Welcome to Meridian
        </div>

        <div style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 11, color: T.muted,
          textAlign: 'center',
          maxWidth: 380,
          lineHeight: 1.6,
        }}>
          Your personal productivity system. Let NOVA help you plan, focus, and reflect.
        </div>

        {/* Quick-start buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => onNavigate('program-briefing')}
            style={{
              background: `${PROG_META.briefing.color}18`,
              border: `1px solid ${PROG_META.briefing.color}40`,
              borderRadius: 8,
              padding: '10px 22px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              fontWeight: 700,
              color: PROG_META.briefing.color,
              cursor: 'pointer',
              letterSpacing: '.06em',
              transition: 'all .14s',
            }}
          >
            ☀ Start Briefing
          </button>
          <button
            onClick={() => onNavigate('hq')}
            style={{
              background: `${T.green}18`,
              border: `1px solid ${T.green}40`,
              borderRadius: 8,
              padding: '10px 22px',
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              fontWeight: 700,
              color: T.green,
              cursor: 'pointer',
              letterSpacing: '.06em',
              transition: 'all .14s',
            }}
          >
            ✦ Explore Goals
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main render ──

  return (
    <>
      {/* Inject keyframes for pulse animation */}
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
        {/* ── Body ── */}
        <div style={styles.body}>
          {/* Main card */}
          <div style={{
            width: '100%',
            maxWidth: 640,
            animation: 'fadeInUp 0.35s ease-out',
          }}>
            {isAutoStarting && renderAutoStart()}
            {isFocusResume && renderFocusResume()}
            {hasLastProgram && renderLastProgram()}
            {isFirstLaunch && renderFirstLaunch()}
          </div>

          {/* Today's Summary (hidden during auto-start) */}
          {!isAutoStarting && (
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
          )}
        </div>
      </div>
    </>
  );
}
