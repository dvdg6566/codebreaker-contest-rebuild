import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface SortableSubtaskItemProps {
  id: string;
  index: number;
  score: number;
  dependency: string;
  onScoreChange: (value: string) => void;
  onDependencyChange: (value: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function SortableSubtaskItem({
  id,
  index,
  score,
  dependency,
  onScoreChange,
  onDependencyChange,
  onDelete,
  canDelete,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 rounded-lg border bg-white ${
        isDragging ? "shadow-lg border-emerald-300" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="w-20 text-sm font-medium text-muted-foreground">
        Subtask {index + 1}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Score:</Label>
        <Input
          type="number"
          value={score}
          onChange={(e) => onScoreChange(e.target.value)}
          className="w-16"
        />
      </div>

      <div className="flex items-center gap-2 flex-1">
        <Label className="text-sm">Tests:</Label>
        <Input
          value={dependency}
          onChange={(e) => onDependencyChange(e.target.value)}
          placeholder="e.g., 1-5"
          className="flex-1"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={!canDelete}
        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
