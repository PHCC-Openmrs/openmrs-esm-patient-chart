import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import {
  DocumentIcon,
  showModal,
  useConfig,
  useOnClickOutside,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { type ConfigObject } from '../config-schema';
import { useStickyNote } from './sticky-note.resource';
import StickyNotePanel from './sticky-note-panel.component';
import styles from './sticky-note-header-button.scss';

interface StickyNoteHeaderButtonProps {
  patientUuid: string;
}

const StickyNoteHeaderButton: React.FC<StickyNoteHeaderButtonProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [showPanel, setShowPanel] = useState(false);
  const { note, isLoading, error, mutate } = useStickyNote(patientUuid);
  const session = useSession();
  // There's no separate "Add Notes" privilege - creating a note uses Edit Notes,
  // same as editing one. Viewing an existing note only needs Get Notes, so a
  // view-only user shouldn't lose the button just because they can't create one.
  const canViewNote = userHasAccess('Get Notes', session?.user) || userHasAccess('Edit Notes', session?.user);
  const canCreateNote = userHasAccess('Edit Notes', session?.user);

  const handleClose = useCallback(() => {
    setShowPanel(false);
  }, []);

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    // Ignore clicks inside any open Carbon modal so opening the edit/delete modal doesn't dismiss the panel.
    if ((event.target as HTMLElement | null)?.closest('[role="dialog"]')) {
      return;
    }
    setShowPanel(false);
  }, []);

  const containerRef = useOnClickOutside<HTMLDivElement>(handleOutsideClick, showPanel);

  const handleClick = useCallback(() => {
    // Any state other than "definitely no note" shows the panel, which already renders skeleton / error / note.
    if (isLoading || error || note) {
      setShowPanel((prev) => !prev);
      return;
    }
    const dispose = showModal('sticky-note-modal', {
      close: () => dispose(),
      mutate,
      patientUuid,
    });
  }, [error, isLoading, mutate, note, patientUuid]);

  useEffect(() => {
    if (!showPanel) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPanel(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPanel]);

  // Mirrors handleClick's own branching: the same states that open the view
  // panel there need Get Notes here, and the create-modal path needs Edit Notes.
  const canShowButton = isLoading || error || note ? canViewNote : canCreateNote;

  if (!canShowButton) {
    return null;
  }

  return (
    <div className={styles.content} ref={containerRef}>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={(props) => (
          <div>
            <DocumentIcon {...props} />
            {note && <span className={styles.notificationBadge}>1</span>}
          </div>
        )}
        onClick={handleClick}
      >
        {t('stickyNote', 'Sticky note')}
      </Button>
      {showPanel && (
        <StickyNotePanel
          error={error}
          isLoading={isLoading}
          mutate={mutate}
          note={note}
          onClose={handleClose}
          patientUuid={patientUuid}
        />
      )}
    </div>
  );
};

// Gate the button on config so distros that don't configure a concept don't see a feature that
// would silently fail on save. When unconfigured, nothing renders — no button, no SWR request.
const StickyNoteHeaderButtonGate: React.FC<StickyNoteHeaderButtonProps> = (props) => {
  const { stickyNoteConceptUuid } = useConfig<ConfigObject>();
  if (!stickyNoteConceptUuid) {
    return null;
  }
  return <StickyNoteHeaderButton {...props} />;
};

export default StickyNoteHeaderButtonGate;
