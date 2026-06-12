import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import "../styles/toast.css";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  type: ToastType;
  text: string;
};

type ToastContextValue = {
  showToast: (input: { type: ToastType; text: string; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((input: { type: ToastType; text: string; durationMs?: number }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const durationMs = input.durationMs ?? (input.type === "success" ? 3200 : 5000);

    setItems((current) => [...current, { id, type: input.type, text: input.text }]);

    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.type}`}>
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
