import {
  Coffee,
  Gamepad2,
  Heart,
  KeyRound,
  Shield,
  Sparkles,
  Star,
  User,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

export const PROFILE_ICONS: {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }> | null;
}[] = [
  { id: "none", label: "Nessuna", Icon: null },
  { id: "key", label: "Chiave", Icon: KeyRound },
  { id: "user", label: "Utente", Icon: User },
  { id: "users", label: "Team", Icon: Users },
  { id: "star", label: "Stella", Icon: Star },
  { id: "shield", label: "Scudo", Icon: Shield },
  { id: "coffee", label: "Caffè", Icon: Coffee },
  { id: "gamepad", label: "Game", Icon: Gamepad2 },
  { id: "sparkles", label: "Spark", Icon: Sparkles },
  { id: "heart", label: "Cuore", Icon: Heart },
];

export function ProfileAvatar({
  icon,
  label,
  className = "h-4 w-4",
}: {
  icon?: string | null;
  label?: string | null;
  className?: string;
}) {
  const opt = PROFILE_ICONS.find((o) => o.id === (icon ?? "none"));
  if (opt?.Icon) {
    const I = opt.Icon;
    return <I className={className} />;
  }
  return (
    <span className={`inline-flex items-center justify-center font-semibold ${className}`}>
      {(label ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
