import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { type OverallRisk } from '../../common';
import styles from './overall-risk-tag.scss';

interface OverallRiskTagProps {
  risk: OverallRisk | undefined;
  /** The note explaining the risk; shown on click for high risk */
  note?: string;
}

/**
 * Colour-coded overall risk tag. A high risk tag can be clicked to show the note
 * explaining why it was flagged; a low risk tag needs no explanation, so it is static.
 */
const OverallRiskTag: React.FC<OverallRiskTagProps> = ({ risk, note }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleOutsideInteraction = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      } else if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('keydown', handleOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('keydown', handleOutsideInteraction);
    };
  }, [isOpen]);

  if (!risk) {
    return <span>--</span>;
  }

  if (risk === 'low') {
    return <span className={classNames(styles.riskTag, styles.lowRiskTag)}>{t('lowRisk', 'Low risk')}</span>;
  }

  return (
    <span className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={classNames(styles.riskTag, styles.highRiskTag)}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
      >
        {t('highRisk', 'High risk')}
      </button>
      {isOpen ? (
        <div className={styles.noteContent} role="dialog" aria-label={t('reasonForHighRisk', 'Reason for high risk')}>
          <p className={styles.noteHeading}>{t('reasonForHighRisk', 'Reason for high risk')}</p>
          <p>{note || t('noNoteRecorded', 'No note recorded')}</p>
        </div>
      ) : null}
    </span>
  );
};

export default OverallRiskTag;
