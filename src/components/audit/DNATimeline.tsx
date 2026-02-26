import { TimelineNode } from "./TimelineNode";

interface AuditEvent {
  id: string;
  event_type: string;
  event_label: string;
  actor_name: string | null;
  entity_name: string | null;
  occurred_at: string;
}

interface DNATimelineProps {
  events: AuditEvent[];
}

export function DNATimeline({ events }: DNATimelineProps) {
  if (events.length === 0) {
    return (
      <div className="glass-card p-10 text-center text-muted-foreground text-sm">
        No audit events found for this batch.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Central vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-border" />

      <div className="space-y-6 py-4">
        {events.map((event, i) => (
          <TimelineNode
            key={event.id}
            eventType={event.event_type}
            eventLabel={event.event_label}
            actorName={event.actor_name}
            entityName={event.entity_name}
            occurredAt={event.occurred_at}
            side={i % 2 === 0 ? "left" : "right"}
          />
        ))}
      </div>
    </div>
  );
}
