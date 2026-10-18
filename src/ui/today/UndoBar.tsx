import { useTimelineStore } from '../../state/timeline';

export function UndoBar(): React.JSX.Element | null {
  const pendingDelete = useTimelineStore((s) => s.pendingDelete);
  const undoDelete = useTimelineStore((s) => s.undoDelete);
  if (pendingDelete === null) return null;

  const handleUndo = (): void => {
    undoDelete();
  };

  return (
    <div className="undo-bar" role="status">
      <span className="undo-bar-text">Bloc supprimé.</span>
      <button type="button" className="undo-bar-action" onClick={handleUndo}>
        Annuler
      </button>
      <span className="undo-bar-progress" key={pendingDelete.id} />
    </div>
  );
}
