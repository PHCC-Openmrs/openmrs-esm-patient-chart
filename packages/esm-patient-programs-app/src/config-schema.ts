import { Type } from '@openmrs/esm-framework';

// Malnutrition Categories by MUAC (6-59 months): SAM < 11.5cm, MAM 11.5-<12.5cm, Normal >= 12.5cm.
export const MUAC_DIAGNOSIS_OPTIONS = [
  'Severe Acute Malnutrition (SAM)',
  'Moderate Acute Malnutrition (MAM)',
  'Normal Nutritional Status',
];

export const configSchema = {
  hideAddProgramButton: {
    _type: Type.Boolean,
    _default: false,
  },
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
        allowedLocationUuids: ['ba34b45c-0a0d-4000-9624-ab6fd419f778'],
      },
      {
        // Primary Health Care -- only offered at Deir Al-Balah PHCC, not Beir 19 point.
        programUuid: 'bd6b8c0a-49c9-4f98-afea-8b8fcd999688',
        allowedLocationUuids: ['ba34b45c-0a0d-4000-9624-ab6fd419f778'],
      },
      {
        // Pediatric Consultation -- only offered at Deir Al-Balah PHCC, not Beir 19 point.
        programUuid: '9138885e-f9f4-4981-b1fb-ef3d022228bd',
        allowedLocationUuids: ['ba34b45c-0a0d-4000-9624-ab6fd419f778'],
      },
      // Nutrition Registration has no entry here -- an empty/missing restriction means it's
      // offered everywhere, including Beir 19 point. This makes it the only service visible
      // at Beir 19 point, since every other program above is restricted to Deir Al-Balah PHCC.
    ],
    _description: 'Restricts a program to being offered only when the user is logged in at one of the allowed locations.',
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
            _description: 'One of "text", "number", "select", or "date".',
            _default: 'text',
          },
          options: {
            _type: Type.Array,
            _elements: { _type: Type.String },
            _description: 'Fixed choices to show when controlType is "select".',
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
              'If set, this field\'s value is computed from another field in the same section (matched by concept ' +
              'UUID) using autofillRule, instead of being entered directly.',
          },
          autofillRule: {
            _type: Type.String,
            _description:
              'Name of the computation used to derive this field\'s value from the autofillFromConceptUuid field. ' +
              'Currently supported: "muacNutritionCategory".',
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
            label: 'Diagnosis',
            controlType: 'select',
            options: MUAC_DIAGNOSIS_OPTIONS,
            minAge: 5,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: 'cddb2f24-e4c2-4d04-b249-73d0c6219f12',
            label: 'Oedema (Y / M)',
            controlType: 'select',
            options: ['Y', 'M'],
            minAge: 0,
            maxAge: 5,
            readOnly: false,
          },
          {
            conceptUuid: '348e3f95-8b24-4ebb-8654-ac10c444bc65',
            label: 'Type of supplement received',
            controlType: 'select',
            options: ['Yes', 'No'],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '127b8e09-54dc-4ccd-b078-f0a97206ceca',
            label: 'Supp qut',
            controlType: 'number',
            options: [],
            minAge: 0,
            maxAge: 200,
            readOnly: false,
          },
          {
            conceptUuid: '5aadb886-873d-43f8-bd99-53528eb7f04c',
            label: 'Project',
            controlType: 'select',
            options: ['UNICEF', 'WFP'],
            minAge: 0,
            maxAge: 5,
            readOnly: false,
          },
          {
            conceptUuid: '838e14c1-d63f-4062-8eaf-edc5edcfabc6',
            label: 'Status (PW, BW, MH, FH)',
            controlType: 'select',
            options: ['PW', 'BW', 'MH', 'FH'],
            minAge: 5,
            maxAge: 200,
            readOnly: false,
          },
        ],
      },
      {
        programName: 'Sexual Reproductive Health (SRH)',
        sectionTitle: 'SRH Assessment',
        encounterTypeUuid: '20f20572-92d4-4cd2-a800-6dff5d39b044',
        fields: [
          {
            conceptUuid: '74e7e6b0-a0c6-461e-a4ef-205dafc77240',
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

export interface ProgramSectionField {
  conceptUuid: string;
  label: string;
  controlType: 'text' | 'number' | 'select' | 'date';
  options: Array<string>;
  minAge: number;
  maxAge: number;
  readOnly: boolean;
  autofillFromConceptUuid?: string;
  autofillRule?: string;
}

export interface ProgramSectionConfig {
  programName: string;
  sectionTitle: string;
  encounterTypeUuid: string;
  fields: Array<ProgramSectionField>;
}

export interface ConfigObject {
  hideAddProgramButton: boolean;
  showProgramStatusField: boolean;
  programsLocationRestrictions: Array<ProgramLocationRestriction>;
  programSections: Array<ProgramSectionConfig>;
}
