// ── Inline SVG icons extracted from App.jsx ──

export function TrackIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M2 12 L5.5 7 L9 10 L14 4" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="4" r="1.8" fill={color} />
    </svg>
  );
}

export function SettingsIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="8" cy="8" r="2" fill={color} />
      <path d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function MindIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M8 13C8 13 2.5 9.2 2.5 5.8a3.5 3.5 0 016.5-1.8 3.5 3.5 0 016.5 1.8C15.5 9.2 8 13 8 13z" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M5.5 6.5l1.8 1.8L10 5.5" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M9 6v3l2 1" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
