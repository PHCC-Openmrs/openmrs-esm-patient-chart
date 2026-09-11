# esm-patient-nursing-app

The patient nursing frontend module. It adds a **Nursing** section to the patient chart,
alongside Vitals & Biometrics, and it is visible at all times -- it is not gated on a
privilege or on an active visit being present.

The section is made up of three widgets, all reading from the same list of `Nursing`
encounters:

| Widget             | Fields                                                   |
| ------------------ | -------------------------------------------------------- |
| Dressing           | Type of wound, Ointment (multi-select), General notes     |
| Other Measures     | ECG (uploaded file), Spirometry, Monofilament             |
| Nursing Procedures | IM injection, IV injection, Oral, Nebulization            |

Records are entered through a single **Record nursing** workspace that covers all three
sections, so one nursing encounter can carry any mix of them.

## Ointment options

The Ointment multi-select is driven by the answers configured on the Ointment concept in
the dictionary, not by frontend config. Adding or retiring an ointment is a dictionary
change.

## ECG uploads

The ECG file is stored as a patient attachment. The nursing encounter carries a `Nursing
ECG Image` observation whose value is the attachment's UUID, which is what ties the file to
the encounter it was recorded in.

## Backend requirements

The concepts and the `Nursing` encounter type this module reads are created by the
Initializer configuration in the distro (`configuration/concepts/nursing_concepts.csv` and
`configuration/encountertypes/nursing_encounter_types.csv`). Every UUID is overridable
through the module's configuration if an implementation already has its own concepts.

The question concepts are named with a `Nursing ` prefix (`Nursing Type of Wound`,
`Nursing Spirometry`, ...) so their fully specified names can't collide with concepts that
already ship in the reference-application content package. Those names are never shown in
the UI -- the field labels come from this module's translations. The Ointment answer
concepts keep their plain names (`Fucidin`, `Silver`, ...) because those *are* what the
Dressing table renders.
