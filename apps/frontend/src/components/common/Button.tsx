import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.06)",
        color: "inherit",
        cursor: "pointer",
        ...(props.style ?? {})
      }}
    />
  );
}

