import {
  Asterisk,
  Eye,
  EyeOff,
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut
} from "lucide-react";

type IconProps = { size?: number; color?: string };

export function ArrowMark({ size = 44, color = "#0f172a" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.221 3L34.0276 14.8066M45.8342 26.6132L34.0276 14.8066M34.0276 14.8066L8.95884 40.1988M34.0276 14.8066L32.2712 46.6682M34.0276 14.8066L2.16602 16.5857" stroke={color} strokeWidth="3.23" strokeLinecap="round"/>
    </svg>
  );
}

export function EyeIcon({ open, color = "currentColor", size = 20 }: { open: boolean; color?: string; size?: number }) {
  return open ? <Eye size={size} color={color} strokeWidth={2} /> : <EyeOff size={size} color={color} strokeWidth={2} />;
}

export function HomeIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <LayoutDashboard size={size} color={color} strokeWidth={2} />;
}

export function QuotesIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}

export function ClientsIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <Users size={size} color={color} strokeWidth={2} />;
}

export function ProductsIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <Package size={size} color={color} strokeWidth={2} />;
}

export function MetricsIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <BarChart3 size={size} color={color} strokeWidth={2} />;
}

export function SettingsIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <Settings size={size} color={color} strokeWidth={2} />;
}

export function HelpIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <HelpCircle size={size} color={color} strokeWidth={2} />;
}

export function LogoutIcon({ size = 20, color = "currentColor" }: IconProps) {
  return <LogOut size={size} color={color} strokeWidth={2} />;
}
