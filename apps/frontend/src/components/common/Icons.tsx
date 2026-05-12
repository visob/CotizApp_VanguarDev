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

