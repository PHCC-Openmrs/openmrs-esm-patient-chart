import { Type } from '@openmrs/esm-framework';

// Malnutrition Categories by MUAC (6-59 months): SAM < 11.5cm, MAM 11.5-<12.5cm, Normal >= 12.5cm.
export const MUAC_DIAGNOSIS_OPTIONS = [
  'Severe Acute Malnutrition (SAM)',
  'Moderate Acute Malnutrition (MAM)',
  'Normal Nutritional Status',
];

// Malnutrition category by MUAC for patients over 5: Malnourished < 23.5cm, Normal >= 23.5cm.
export const ADULT_MUAC_DIAGNOSIS_OPTIONS = ['Malnourished', 'Normal'];

// Concept UUID for the "Received supplement" (Yes/No) question, created via the REST API
// (concept, Text datatype, Finding class -- same shape as the Oedema concept below).
export const RECEIVED_SUPPLEMENT_CONCEPT_UUID = '54064b9a-39de-4dee-8984-56c58341d461';

// Every SRH section below hangs off this one program enrolment.
const SRH_PROGRAM_NAME = 'Sexual Reproductive Health (SRH)';

// Last Menstrual Period, captured in the SRH Assessment section. The Ultrasound section's EDD and
// "Number of Weeks" are both derived from the patient's latest value for it rather than re-asking.
export const SRH_LMP_CONCEPT_UUID = '74e7e6b0-a0c6-461e-a4ef-205dafc77240';

export const configSchema = {
  showProgramStatusField: {
    _type: Type.Boolean,
    _description:
      'Whether to show the Service status field in the Service enrollment form. If set to true, the `Service status` field is displayed in the Services datatable',
    _default: false,
  },
  programsLocationRestrictions: {
    _type: Type.Array,
    _elements: {
      _type: Type.Object,
      programUuid: {
        _type: Type.UUID,
        _description: 'The UUID of the program to restrict by location.',
      },
      allowedLocationUuids: {
        _type: Type.Array,
        _elements: {
          _type: Type.UUID,
        },
        _description:
          'UUIDs of the locations at which this program should be offered. Leave empty to allow everywhere.',
        _default: [],
      },
    },
    _default: [
      {
        // Sexual Reproductive Health (SRH) -- only offered at Deir Al-Balah PHCC, not Beir 19 point.
        programUuid: 'f73376c9-7bdf-44e5-ba97-ddf4db5bc9f9',
        allowedLocationUuids: ['de3b87c1-9688-4162-bfc5-d5eeccf3354d'],
      },
      {
        // Primary Health Care -- only offered at Deir Al-Balah PHCC, not Beir 19 point.
        programUuid: 'bd6b8c0a-49c9-4f98-afea-8b8fcd999688',
        allowedLocationUuids: ['de3b87c1-9688-4162-bfc5-d5eeccf3354d'],
      },
      {
        // Pediatric Consultation -- only offered at Deir Al-Balah PHCC, not Beir 19 point.
        programUuid: '9138885e-f9f4-4981-b1fb-ef3d022228bd',
        allowedLocationUuids: ['de3b87c1-9688-4162-bfc5-d5eeccf3354d'],
      },
      // Nutrition Registration has no entry here -- an empty/missing restriction means it's
      // offered everywhere, including Beir 19 point. This makes it the only service visible
      // at Beir 19 point, since every other program above is restricted to Deir Al-Balah PHCC.
    ],
    _description:
      'Restricts a program to being offered only when the user is logged in at one of the allowed locations.',
  },
  programSections: {
    _type: Type.Array,
    _elements: {
      _type: Type.Object,
      programName: {
        _type: Type.String,
        _description: 'Exact name of the Program this section applies to (e.g. "Nutrition Registration").',
      },
      sectionTitle: {
        _type: Type.String,
        _description: 'Title shown on the summary-dashboard card for this section.',
      },
      encounterTypeUuid: {
        _type: Type.UUID,
        _description: 'UUID of the encounter type each "Record" action creates for this section.',
      },
      fields: {
        _type: Type.Array,
        _elements: {
          _type: Type.Object,
          conceptUuid: { _type: Type.UUID, _description: 'UUID of the concept this field records an obs for.' },
          label: { _type: Type.String, _description: 'Label shown for this field.' },
          controlType: {
            _type: Type.String,
            _description: 'One of "text", "textarea", "number", "select", or "date".',
            _default: 'text',
          },
          options: {
            _type: Type.Array,
            _elements: { _type: Type.String },
            _description: 'Fixed choices to show when controlType is "select". Ignored if "answers" is set.',
            _default: [],
          },
          answers: {
            _type: Type.Array,
            _elements: {
              _type: Type.Object,
              label: { _type: Type.String, _description: 'Choice text shown in the dropdown.' },
              conceptUuid: { _type: Type.UUID, _description: 'UUID of the answer concept submitted as the obs value.' },
            },
            _description:
              'Coded choices to show when controlType is "select", for concepts with concept-answer sets. Takes ' +
              'precedence over "options" when non-empty.',
            _default: [],
          },
          minAge: {
            _type: Type.Number,
            _description: 'Only show this field if the patient is at least this many years old. Omit for no minimum.',
            _default: 0,
          },
          maxAge: {
            _type: Type.Number,
            _description:
              'Only show this field if the patient is at most this many years old. Set to a large number (e.g. 200) for no maximum.',
            _default: 200,
          },
          readOnly: {
            _type: Type.Boolean,
            _description: 'Whether this field is displayed but not editable (e.g. an autofilled value).',
            _default: false,
          },
          autofillFromConceptUuid: {
            _type: Type.UUID,
            _description:
              "If set, this field's value is computed from another field in the same section (matched by concept " +
              'UUID) using autofillRule, instead of being entered directly.',
          },
          autofillFromLatestObsConceptUuid: {
            _type: Type.UUID,
            _description:
              "If set, this field's value is computed by autofillRule from the patient's most recently recorded " +
              'observation for this concept -- anywhere in their record, including other sections -- instead of ' +
              'from a field in this section. Takes precedence over autofillFromConceptUuid.',
          },
          autofillRule: {
            _type: Type.String,
            _description:
              "Name of the computation used to derive this field's value from its autofill source " +
              '(autofillFromConceptUuid, or autofillFromLatestObsConceptUuid). Currently supported: ' +
              '"muacNutritionCategory", "muacAdultDiagnosis", "supplementTypeToProject", "lmpToEdd", ' +
              '"lmpToGestationalWeeks".',
          },
          visibleWhenConceptUuid: {
            _type: Type.UUID,
            _description:
              'If set, this field is only shown when the field with this concept UUID (elsewhere in the same ' +
              'section) has the value given in visibleWhenValue. Omit to always show this field.',
          },
          visibleWhenValue: {
            _type: Type.String,
            _description:
              'The value (option text, or answer concept UUID for a coded select) that visibleWhenConceptUuid ' +
              "must have for this field to be shown. Ignored if visibleWhenConceptUuid isn't set.",
            _default: '',
          },
          optional: {
            _type: Type.Boolean,
            _description:
              'Whether this field may be left blank. Fields are required by default; set this for notes, ' +
              'measurements that only apply to some visits, and autofilled values whose source may not be on ' +
              'record yet.',
            _default: false,
          },
          persist: {
            _type: Type.Boolean,
            _description:
              'Whether this field is saved as an observation. Set to false for UI-only fields (e.g. a question ' +
              'that only exists to show/hide other fields via visibleWhenConceptUuid) that have no real concept.',
            _default: true,
          },
        },
        _default: [],
      },
    },
    _default: [
      {
        programName: 'Nutrition Registration',
        sectionTitle: 'Nutrition Assessment',
        encounterTypeUuid: '3069ba59-8aea-4a9b-a79a-0d810ea0382b',
        fields: [
          {
            conceptUuid: '1343AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            label: 'MUAC (cm)',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '6d4f0916-5913-4e48-82ea-265e379ffb6b',
            label: 'Diagnosis (Autofill)',
            controlType: 'select',
            options: MUAC_DIAGNOSIS_OPTIONS,
            minAge: 0,
            maxAge: 5,
            readOnly: true,
            autofillFromConceptUuid: '1343AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            autofillRule: 'muacNutritionCategory',
          },
          {
            conceptUuid: '6d4f0916-5913-4e48-82ea-265e379ffb6b',
            label: 'Diagnosis (Autofill)',
            controlType: 'select',
            options: ADULT_MUAC_DIAGNOSIS_OPTIONS,
            minAge: 5,
            maxAge: 200,
            readOnly: true,
            autofillFromConceptUuid: '1343AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            autofillRule: 'muacAdultDiagnosis',
          },
          {
            conceptUuid: 'cddb2f24-e4c2-4d04-b249-73d0c6219f12',
            label: 'Oedema (Yes / No)',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 5,
            readOnly: false,
          },
          {
            conceptUuid: RECEIVED_SUPPLEMENT_CONCEPT_UUID,
            label: 'Received supplement',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'c963d0ea-7d87-49a5-9267-e07612c4d3e1',
            label: 'Type of supplement received',
            controlType: 'select',
            options: [],
            answers: [
              { label: 'Ready-to-Use Therapeutic Food (RUTF)', conceptUuid: '261388a0-729f-44e5-b79c-e3f88b474089' },
              { label: 'Ready-to-Use Supplementary Food (RUSF)', conceptUuid: 'a181d0a5-caf3-4249-b73a-b0157636e5d3' },
              {
                label: 'Lipid-based Nutrient Supplement - Medium Quantity (LNS-MQ)',
                conceptUuid: '65e33d78-6687-46c1-a047-5665b1c8aedd',
              },
              {
                label: 'Lipid-based Nutrient Supplement - Small Quantity (LNS-SQ)',
                conceptUuid: 'f4d467d5-24c0-4ad9-ae5c-a0ad375e8bc9',
              },
              { label: 'High Energy Biscuits (HEB) - 50g', conceptUuid: '7b9da3fa-2529-409f-b2e3-f440bfc89b62' },
              {
                label: 'Ready-to-Use Complementary Food (RUCF)',
                conceptUuid: '7b723eab-08dd-48d3-98ec-6849572ed78f',
              },
              { label: 'BP-5 Compact Food', conceptUuid: 'be7d19d0-3440-4d4c-9b65-48073ef72982' },
              { label: 'Supercereal Plus (SC+)', conceptUuid: '6247969d-5424-4a6a-b088-cdd5513de52a' },
            ],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            visibleWhenConceptUuid: RECEIVED_SUPPLEMENT_CONCEPT_UUID,
            visibleWhenValue: 'Yes',
          },
          {
            conceptUuid: '127b8e09-54dc-4ccd-b078-f0a97206ceca',
            label: 'Supplement quantity',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            visibleWhenConceptUuid: RECEIVED_SUPPLEMENT_CONCEPT_UUID,
            visibleWhenValue: 'Yes',
          },
          {
            conceptUuid: '5aadb886-873d-43f8-bd99-53528eb7f04c',
            label: 'Project',
            controlType: 'select',
            options: ['UNICEF', 'WFP'],
            minAge: 0,
            maxAge: 200,
            readOnly: true,
            autofillFromConceptUuid: 'c963d0ea-7d87-49a5-9267-e07612c4d3e1',
            autofillRule: 'supplementTypeToProject',
            visibleWhenConceptUuid: RECEIVED_SUPPLEMENT_CONCEPT_UUID,
            visibleWhenValue: 'Yes',
          },
          {
            conceptUuid: '838e14c1-d63f-4062-8eaf-edc5edcfabc6',
            label: 'Status',
            controlType: 'select',
            options: ['Pregnant Women (PW)', 'Breastfeeding Women (BW)', 'Motherhood (MH)', 'Fatherhood (FH)'],
            minAge: 5,
            maxAge: 200,
            readOnly: false,
          },
        ],
      },
      {
        programName: SRH_PROGRAM_NAME,
        sectionTitle: 'SRH Assessment',
        encounterTypeUuid: '20f20572-92d4-4cd2-a800-6dff5d39b044',
        fields: [
          {
            conceptUuid: SRH_LMP_CONCEPT_UUID,
            label: 'LMP (Last Menstrual Period)',
            controlType: 'date',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '511d5fc2-7dc6-43b9-9f5f-139e62f256ab',
            label: 'Gravidity (Number of Pregnancies)',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '5ba1f82e-c0aa-46d3-9bfd-8e76b7265093',
            label: 'Delivery Type',
            controlType: 'select',
            options: ['Vaginal Delivery', 'Caesarean Delivery', 'Still Birth', 'Abortion'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
        ],
      },
      {
        // Obstetric ultrasound findings. Measurements (FL/CRL/BPD/AC) and the gestational-age
        // fields are optional: which of them a scan yields depends on how far along the
        // pregnancy is, so requiring all of them would block a valid early- or late-term scan.
        programName: SRH_PROGRAM_NAME,
        sectionTitle: 'Ultrasound',
        encounterTypeUuid: '367f7663-1ec7-4802-befc-b5097cee30b1',
        fields: [
          {
            conceptUuid: '1baaf8f0-7b59-40d5-8aec-1af2436be3a4',
            label: 'Fetuses',
            controlType: 'select',
            options: ['Foetus:1', 'Not Defined'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'd31d549f-77f2-41fe-9463-d6f9cd5f39de',
            label: 'Fetal Heart Pulsation',
            controlType: 'select',
            options: ['Not Set', '+ve', '-ve', '+ve/ -ve'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '151f6ad3-83d6-4e99-8f9f-87253a569cbf',
            label: 'Presentation',
            controlType: 'select',
            options: ['Not Defined', 'Cephalic', 'Breech', 'Shoulder', 'Transversus'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'e5b825c6-8d33-4493-9afd-0162944e3094',
            label: 'Lie Fetuses',
            controlType: 'select',
            options: ['Not Defined', 'Longitudinal', 'Obliques', 'Transverse'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'a8adc088-44db-4800-91d4-ed159666cea0',
            label: 'Fetal Gender',
            controlType: 'select',
            options: ['Unknown', 'Male', 'Female'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '9ccb470d-4698-410c-80e8-ddf71626b9c8',
            label: 'FL',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '1ccd71c9-7cff-4cb4-8250-f259c163a411',
            label: 'CRL',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: 'd7dd0030-62b3-4519-8e85-7d0cd65b5589',
            label: 'BPD',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: 'af646e85-e5f4-4b10-8a8b-5711c3de1022',
            label: 'AC',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '93f1d86b-6937-4fa7-8698-a405a4d31b17',
            label: 'G Week',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: 'e0765aa2-90bb-41ea-a033-6c9ccf25ab8d',
            label: 'G Days',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '649772f8-7212-409b-bf63-fc0c20ecd80e',
            label: 'Placenta',
            controlType: 'text',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '6f0229ef-ddf2-452b-ae74-e42cc2d900af',
            label: 'Amniotic Fluid',
            controlType: 'select',
            options: ['Not Defined', 'Adequate', 'Polyhydramnios', 'Oligohydramnios'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            // Calculated from the LMP recorded in SRH Assessment: LMP + 9 months + 7 days.
            conceptUuid: '21eea22d-7aef-4238-8203-a987fbf08d35',
            label: 'EDD',
            controlType: 'date',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: true,
            optional: true,
            autofillFromLatestObsConceptUuid: SRH_LMP_CONCEPT_UUID,
            autofillRule: 'lmpToEdd',
          },
          {
            // Calculated from the LMP recorded in SRH Assessment: every 7 whole days elapsed
            // since the LMP counts as one completed week.
            conceptUuid: 'ccb5e545-2c8e-4082-a9a0-fddc01a0f088',
            label: 'Number of Weeks',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: true,
            optional: true,
            autofillFromLatestObsConceptUuid: SRH_LMP_CONCEPT_UUID,
            autofillRule: 'lmpToGestationalWeeks',
          },
          {
            conceptUuid: '26bcbe57-ac91-4763-a249-1e530acb237f',
            label: 'Referrals',
            controlType: 'select',
            options: ['ANC cases', 'Deliveries', 'Newborns', 'Other'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '0983ec3a-3fdc-4398-a511-aaac695db09d',
            label: 'Notes',
            controlType: 'textarea',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
        ],
      },
      {
        programName: SRH_PROGRAM_NAME,
        sectionTitle: 'STI and Gyna',
        encounterTypeUuid: '871dd5ad-4d3a-4170-a985-181d10394c44',
        fields: [
          {
            // Optional: only applies to a patient who has recently delivered.
            conceptUuid: '9311d1f3-ec8b-41a7-9893-fe8f3071c792',
            label: 'PNC',
            controlType: 'select',
            options: ['<72 H', '>72 H'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
          {
            conceptUuid: '22199eac-e76a-47b5-81b3-75e969b01468',
            label: 'STI',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '1d1b1ebe-fa60-4f17-8ba2-c75830944a82',
            label: 'Gyna',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '98018a2e-f03d-48ad-a002-a95f0e52f010',
            label: 'PCC',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'f0438e22-6224-4d50-8646-7b1845b122f8',
            label: 'Notes',
            controlType: 'textarea',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
        ],
      },
      {
        programName: SRH_PROGRAM_NAME,
        sectionTitle: 'Family Planning',
        encounterTypeUuid: '9602cc2d-f411-4318-87dd-7ab3a204127e',
        fields: [
          {
            conceptUuid: '0ea3ad8b-1e24-461a-b421-093b078af199',
            label: 'Visit Type',
            controlType: 'select',
            options: ['New', 'Follow'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '11b4fb9c-97f1-4ca8-bfe6-63e769cee6fb',
            label: 'Kind of Contraseption',
            controlType: 'select',
            options: ['COCP', 'POP', 'Emergency contraceptives', 'Injectable', 'Male Condom', 'IUCD'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'b1285f61-04ac-40a2-903f-994d2e2151c9',
            label: 'Notes',
            controlType: 'textarea',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
            optional: true,
          },
        ],
      },
    ],
    _description:
      'Program-specific summary-dashboard sections, Vitals-and-Biometrics style: each entry shows/records a set ' +
      'of obs (as its own encounter type) for patients actively enrolled in the named program. Add an entry here ' +
      '(no code changes) to support another program (SRH, Outpatient Clinical Consultation, etc).',
  },
};

export interface ProgramLocationRestriction {
  programUuid: string;
  allowedLocationUuids: Array<string>;
}

export interface ProgramSectionAnswer {
  label: string;
  conceptUuid: string;
}

export interface ProgramSectionField {
  conceptUuid: string;
  label: string;
  controlType: 'text' | 'textarea' | 'number' | 'select' | 'date';
  options: Array<string>;
  answers: Array<ProgramSectionAnswer>;
  minAge: number;
  maxAge: number;
  readOnly: boolean;
  optional?: boolean;
  autofillFromConceptUuid?: string;
  autofillFromLatestObsConceptUuid?: string;
  autofillRule?: string;
  visibleWhenConceptUuid?: string;
  visibleWhenValue?: string;
  persist?: boolean;
}

export interface ProgramSectionConfig {
  programName: string;
  sectionTitle: string;
  encounterTypeUuid: string;
  fields: Array<ProgramSectionField>;
}

export interface ConfigObject {
  showProgramStatusField: boolean;
  programsLocationRestrictions: Array<ProgramLocationRestriction>;
  programSections: Array<ProgramSectionConfig>;
}
