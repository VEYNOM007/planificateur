import { useEffect } from 'react';
import type { Category } from '../../domain/models';
import { formatTime, parseTime, MINUTES_PER_DAY } from '../../domain/time/minutes';
import { useTimelineStore, type BlockDraft } from '../../state/timeline';

export interface BlockSheetProps {
  categories: Category[];
}

const DURATION_PRESETS = [15, 30, 45, 60, 90];

export function BlockSheet({ categories }: BlockSheetProps): React.JSX.Element | null {
  const sheet = useTimelineStore((s) => s.sheet);
  const draft = useTimelineStore((s) => s.draft);
  const draftError = useTimelineStore((s) => s.draftError);
  const closeSheet = useTimelineStore((s) => s.closeSheet);
  const patchDraft = useTimelineStore((s) => s.patchDraft);
  const setDraftError = useTimelineStore((s) => s.setDraftError);
  const saveDraft = useTimelineStore((s) => s.saveDraft);
  const deleteBlock = useTimelineStore((s) => s.deleteBlock);
  const open = sheet !== 'closed';

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSheet]);

  if (!open || draft === null) return null;

  const end = (draft.startMin + draft.durationMin) % MINUTES_PER_DAY;
  const crossesMidnight = draft.startMin + draft.durationMin > MINUTES_PER_DAY;

  const handleClose = (): void => {
    closeSheet();
  };

  const handlePatch = (patch: Partial<BlockDraft>): void => {
    patchDraft(patch);
  };

  const handleChangeStart = (value: string): void => {
    const parsed = parseTime(value);
    if (parsed === null) return;
    handlePatch({ startMin: parsed });
  };

  const handleChangeEnd = (value: string): void => {
    const parsed = parseTime(value);
    if (parsed === null) return;
    let diff = parsed - draft.startMin;
    if (diff <= 0) diff += MINUTES_PER_DAY;
    if (diff < 5) {
      setDraftError('La fin doit être au moins 5 min après le début.');
      return;
    }
    handlePatch({ durationMin: diff });
  };

  const handleAllDay = (event: React.ChangeEvent<HTMLInputElement>): void => {
    handlePatch({ allDay: event.target.checked });
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    handlePatch({ title: event.target.value });
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    handlePatch({ notes: event.target.value });
  };

  const handleCategoryNone = (): void => handlePatch({ categoryId: null });
  const handleCategory = (id: string | null): void => handlePatch({ categoryId: id });

  const handleDelta = (delta: number): void => {
    handlePatch({ durationMin: Math.max(5, draft.durationMin + delta) });
  };

  const handlePreset = (preset: number): void => handlePatch({ durationMin: preset });

  const handleDelete = (): void => {
    if (draft.blockId !== null) {
      void deleteBlock(draft.blockId, draft.occurrenceDate);
    }
  };

  const handleSave = (): void => {
    void saveDraft();
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={handleClose} role="presentation" />
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Bloc">
        <div className="sheet-handle" />
        <h2 className="sheet-title">{sheet === 'create' ? 'Nouveau bloc' : 'Modifier le bloc'}</h2>

        <label className="sheet-field">
          <span className="sheet-label">Titre</span>
          <input
            className="sheet-input"
            type="text"
            value={draft.title}
            autoFocus
            maxLength={120}
            onChange={handleTitleChange}
          />
        </label>

        <div className="sheet-field">
          <span className="sheet-label">Catégorie</span>
        </div>
        <div className="category-row">
          <button
            type="button"
            className="category-chip"
            aria-pressed={draft.categoryId === null}
            onClick={handleCategoryNone}
          >
            Sans catégorie
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="category-chip"
              aria-pressed={draft.categoryId === category.id}
              style={{ '--chip-color': category.color } as React.CSSProperties}
              onClick={() => handleCategory(category.id)}
            >
              <span className="category-dot" />
              {category.name}
            </button>
          ))}
        </div>

        <label className="sheet-field">
          <input type="checkbox" checked={draft.allDay} onChange={handleAllDay} /> Toute la journée
        </label>

        {!draft.allDay ? (
          <>
            <div className="sheet-times">
              <label className="sheet-field">
                <span className="sheet-label">Début</span>
                <input
                  className="sheet-input"
                  type="time"
                  step={300}
                  value={formatTime(draft.startMin)}
                  onChange={(event) => handleChangeStart(event.target.value)}
                />
              </label>
              <label className="sheet-field">
                <span className="sheet-label">Fin</span>
                <input
                  className="sheet-input"
                  type="time"
                  step={300}
                  value={formatTime(end)}
                  onChange={(event) => handleChangeEnd(event.target.value)}
                />
              </label>
            </div>
            {crossesMidnight ? (
              <p className="sheet-midnight">Le bloc se termine le lendemain.</p>
            ) : null}
            <div className="duration-row">
              <button type="button" className="duration-chip" onClick={() => handleDelta(-15)}>
                −15
              </button>
              <button type="button" className="duration-chip" onClick={() => handleDelta(15)}>
                +15
              </button>
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="duration-chip"
                  aria-pressed={draft.durationMin === preset}
                  onClick={() => handlePreset(preset)}
                >
                  {preset} min
                </button>
              ))}
            </div>
          </>
        ) : null}

        <label className="sheet-field">
          <span className="sheet-label">Notes</span>
          <textarea
            className="sheet-textarea"
            value={draft.notes}
            maxLength={2000}
            onChange={handleNotesChange}
          />
        </label>

        {draft.isRecurring && sheet === 'edit' ? (
          <p className="sheet-midnight">
            Bloc récurrent : les changements s’appliquent à partir de ce jour.
          </p>
        ) : null}

        {draftError !== null ? <p className="sheet-error">{draftError}</p> : null}

        <div className="sheet-actions">
          <button type="button" className="sheet-cancel" onClick={handleClose}>
            Annuler
          </button>
          {sheet === 'edit' && draft.blockId !== null ? (
            <button type="button" className="sheet-delete" onClick={handleDelete}>
              Supprimer
            </button>
          ) : null}
          <button type="button" className="sheet-save" onClick={handleSave}>
            Enregistrer
          </button>
        </div>
      </section>
    </>
  );
}
