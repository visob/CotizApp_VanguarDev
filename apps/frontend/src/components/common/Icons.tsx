import type { CSSProperties } from "react";

export function ArrowMark(props: { size?: number; color?: string; style?: CSSProperties }) {
  const size = props.size ?? 44;
  const color = props.color ?? "#0f172a";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      style={props.style}
      aria-hidden
    >
      <path
        d="M15 41 L45 11 M45 11 L43 26 M45 11 L30 13"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon(props: { open: boolean; color?: string }) {
  const color = props.color ?? "#111827";
  return props.open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke={color}
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l18 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M2.5 12s3.5-7 9.5-7c2.1 0 3.9.6 5.4 1.5M21.5 12s-3.5 7-9.5 7c-2.3 0-4.2-.7-5.8-1.8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function iconProps(props: { size?: number; color?: string }) {
  return { size: props.size ?? 20, color: props.color ?? "#111827" };
}

export function HomeIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuotesIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14l-3-2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 11h8M8 14h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ClientsIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path
        d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path
        d="M3.5 20a4.5 4.5 0 0 1 9 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11.5 20a4.5 4.5 0 0 1 9 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProductsIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h10l-1 13H8L7 7Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 7a3 3 0 0 1 6 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MetricsIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V9M12 19V5M19 19v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.2-2-3.5-2.3.6a8 8 0 0 0-1.7-1l-.3-2.4H9.8l-.3 2.4a8 8 0 0 0-1.7 1l-2.3-.6-2 3.5 2 1.2a7.8 7.8 0 0 0 .1 1 7.8 7.8 0 0 0-.1 1l-2 1.2 2 3.5 2.3-.6a8 8 0 0 0 1.7 1l.3 2.4h5.4l.3-2.4a8 8 0 0 0 1.7-1l2.3.6 2-3.5-2-1.2a7.8 7.8 0 0 0-.1-1Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HelpIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path
        d="M9.6 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.2 1-1.2 1.9v.2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 17h.01" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon(props: { size?: number; color?: string }) {
  const { size, color } = iconProps(props);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3m0 0 3-3M3 12l3 3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
