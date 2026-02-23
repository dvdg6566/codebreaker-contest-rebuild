import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

interface UserAvatarProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
  showInfo?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = "md",
  showInfo = false,
  className,
}: UserAvatarProps) {
  const initials = getInitials(name);

  if (showInfo) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Avatar className={sizeClasses[size]}>
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className={textSizeClasses[size]}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{name}</span>
          {email && (
            <span className="text-sm text-muted-foreground">{email}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={avatarUrl} alt={name} />
      <AvatarFallback className={textSizeClasses[size]}>{initials}</AvatarFallback>
    </Avatar>
  );
}
