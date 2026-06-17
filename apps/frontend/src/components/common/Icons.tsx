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

export function NoteIcon({ size = 20, color = "currentColor" }: IconProps) {
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

export function SearchIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function FilterIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 4H20L14 12V19L10 21V12L4 4Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function DotsIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ReturnIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 14L4 9M4 9L9 4M4 9H14C17.866 9 21 12.134 21 16C21 19.866 17.866 23 14 23H10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function TrashIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

