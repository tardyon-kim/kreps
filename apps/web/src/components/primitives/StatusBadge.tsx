export type StatusTone = "waiting" | "active" | "review";

export type StatusBadgeProps = {
  children: string;
  tone: StatusTone;
};

export function StatusBadge({ children, tone }: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}
