import { useEffect, useRef } from 'react';
import { attach, detach } from '@openmrs/esm-framework';
import { useEnrollments } from './programs.resource';

const SUMMARY_SLOT = 'patient-chart-summary-dashboard-slot';

// Which summary-dashboard widgets should be hidden while a patient is actively enrolled in
// a given program. Extend this table as more per-program hide/show rules are decided --
// SRH / Outpatient Clinical Consultation / the 4th service have none yet.
const PROGRAM_SUMMARY_WIDGET_RULES: Array<{ programName: string; hideExtensionIds: Array<string> }> = [
  {
    // Nutrition patients get food supplements (tracked via this program's own attribute
    // fields), not real drug prescriptions, so the Medications widget doesn't apply to them.
    programName: 'Nutrition Registration',
    hideExtensionIds: ['active-medications-widget', 'future-medications-widget', 'past-medications-widget'],
  },
];

/**
 * Hides/restores summary-dashboard widgets based on a patient's active program enrollments.
 *
 * There's no declarative way to make one app's extension conditionally hide another app's
 * extension based on patient data (the summary slot's host doesn't pass patient state into
 * the slot), so this uses the framework's imperative, deprecated-but-only-option
 * attach/detach extension API. It's scoped tightly: only the exact extension IDs above are
 * touched, and they're always re-attached on cleanup/patient-switch so the hide never leaks
 * to a patient it doesn't apply to.
 */
export function useProgramSummaryWidgetRules(patientUuid: string) {
  const { activeEnrollments } = useEnrollments(patientUuid);

  // Tracks which extension ids *we* have detached, so we only ever call attach() to undo
  // our own detach() -- never on an extension we didn't touch. Calling attach() on an
  // extension that's already attached (e.g. every time this effect re-runs while nothing
  // needs hiding) can duplicate it in the framework's extension registry and corrupt
  // rendering of everything else in the same slot.
  const detachedByUsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeProgramNames = (activeEnrollments ?? []).map((enrollment) => enrollment.program?.name);

    // Every extension id mentioned by any rule -- the full set we might need to hide or
    // restore.
    const allRuleExtensionIds = new Set(PROGRAM_SUMMARY_WIDGET_RULES.flatMap((rule) => rule.hideExtensionIds));

    // Combination logic: "no rule" is dominant over "hide" (no_rule + rule = no_rule). An
    // active program that's silent on a given widget (e.g. SRH has no opinion on
    // Medications) means that widget stays visible, even if another active program (e.g.
    // Nutrition) would otherwise hide it. A widget is only hidden if every currently active
    // program explicitly votes to hide it.
    const idsToHide = new Set<string>();
    if (activeProgramNames.length > 0) {
      allRuleExtensionIds.forEach((extensionId) => {
        const allActiveProgramsHideThisWidget = activeProgramNames.every((programName) => {
          const rule = PROGRAM_SUMMARY_WIDGET_RULES.find((r) => r.programName === programName);
          return rule?.hideExtensionIds.includes(extensionId) ?? false;
        });
        if (allActiveProgramsHideThisWidget) {
          idsToHide.add(extensionId);
        }
      });
    }

    allRuleExtensionIds.forEach((id) => {
      const shouldBeHidden = idsToHide.has(id);
      const isCurrentlyDetachedByUs = detachedByUsRef.current.has(id);
      if (shouldBeHidden && !isCurrentlyDetachedByUs) {
        detach(SUMMARY_SLOT, id);
        detachedByUsRef.current.add(id);
      } else if (!shouldBeHidden && isCurrentlyDetachedByUs) {
        attach(SUMMARY_SLOT, id);
        detachedByUsRef.current.delete(id);
      }
    });

    return () => {
      detachedByUsRef.current.forEach((id) => attach(SUMMARY_SLOT, id));
      detachedByUsRef.current = new Set();
    };
  }, [activeEnrollments]);
}
