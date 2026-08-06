export function IconBell({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 9a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  );
}

export function IconAlert({ className = "w-6 h-6", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

export function IconTruck({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 8h11v9H3z" />
      <path d="M14 11h4l3 3v3h-7" />
      <circle cx="7" cy="18.5" r="1.5" />
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  );
}

export function IconTeam({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3.2 2.5-5.5 6-5.5s6 2.3 6 5.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15 19c0-2.2 1.5-4 4.2-4.5" />
    </svg>
  );
}

export function IconChat({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H10l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  );
}

export function IconBox({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 8l9-4 9 4-9 4-9-4z" />
      <path d="M3 8v9l9 4 9-4V8" />
      <path d="M12 12v9" />
    </svg>
  );
}

export function IconFinance({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 15h3" />
    </svg>
  );
}

export function IconUtensils({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 4v7a2 2 0 002 2h0a2 2 0 002-2V4" />
      <path d="M10 13v7" />
      <path d="M16 4v16" />
      <path d="M16 4c2 2 2 5 0 7" />
    </svg>
  );
}

export function IconScooter({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M8.5 17h7" />
      <path d="M13 17V8h4l2 4" />
      <path d="M6 14l2-6h4" />
    </svg>
  );
}

export function IconShield({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l8 3v6c0 5-3.5 8.2-8 10-4.5-1.8-8-5-8-10V6l8-3z" />
    </svg>
  );
}

export function IconBolt({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M13 2L4 14h7l-1 8 10-14h-7l1-6z" />
    </svg>
  );
}

export function IconHome({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9h12v-9" />
    </svg>
  );
}

export function IconStats({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 19V10" strokeLinecap="round" />
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="M19 19v-7" strokeLinecap="round" />
    </svg>
  );
}

export function IconProfile({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5 19c1.5-3.2 3.8-4.8 7-4.8s5.5 1.6 7 4.8" />
    </svg>
  );
}

export function IconBag({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 8h12v10H4z" />
      <path d="M8 8V6a4 4 0 018 0v2" />
      <path d="M16 12h4v6h-4" />
    </svg>
  );
}
