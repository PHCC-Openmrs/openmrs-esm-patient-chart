import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  concepts: {
    typeOfWoundUuid: {
      _type: Type.ConceptUuid,
      _default: 'fb801b00-0eeb-42ca-8683-7f968eb5f51f',
      _description: 'Free-text concept recording the type of wound being dressed.',
    },
    ointmentUuid: {
      _type: Type.ConceptUuid,
      _default: '74286289-c1a9-4c8b-8b5a-19b547d7e58e',
      _description:
        'Coded concept recording the ointment(s) applied. Its answers drive the options in the Ointment multi-select, so ointments are added or removed in the concept dictionary rather than here.',
    },
    dressingGeneralNotesUuid: {
      _type: Type.ConceptUuid,
      _default: 'ee5488f1-4ac6-4ab6-a12d-46dd4630d584',
      _description: 'Free-text concept recording general notes about the dressing case.',
    },
    ecgImageUuid: {
      _type: Type.ConceptUuid,
      _default: '46e50d98-f499-4352-aea9-82b85d1dc4db',
      _description:
        'Free-text concept whose value is the UUID of the uploaded ECG attachment. The image itself is stored as a patient attachment; this obs is what ties it to the nursing encounter it was recorded in.',
    },
    spirometryUuid: {
      _type: Type.ConceptUuid,
      _default: '26cd9082-7d3a-4955-ae2a-aae22e19cfe1',
      _description: 'Numeric concept recording the spirometry measurement.',
    },
    monofilamentUuid: {
      _type: Type.ConceptUuid,
      _default: 'b9e461bc-432f-44df-82ae-e08e4c4ad7cf',
      _description: 'Numeric concept recording the monofilament measurement.',
    },
    imInjectionUuid: {
      _type: Type.ConceptUuid,
      _default: '33db9b1c-77b6-4360-9fc5-f8724145fcb7',
      _description:
        'Free-text concept recording the intramuscular injection given. Superseded by the drug dropdown and quantity concepts below: it is only read, to show answers recorded before them.',
    },
    ivInjectionUuid: {
      _type: Type.ConceptUuid,
      _default: 'bfeb3e24-1aab-42c3-beb1-33ab91fdbe7b',
      _description:
        'Free-text concept recording the intravenous injection given. Superseded by the drug dropdown and quantity concepts below: it is only read, to show answers recorded before them.',
    },
    oralUuid: {
      _type: Type.ConceptUuid,
      _default: '99a79867-1b40-43ab-ac08-6483acfd3a46',
      _description:
        'Free-text concept recording the oral medication given. Superseded by the drug dropdown and quantity concepts below: it is only read, to show answers recorded before them.',
    },
    nebulizationUuid: {
      _type: Type.ConceptUuid,
      _default: '992966a6-45b5-4b32-b515-b0a298881e35',
      _description:
        'Free-text concept recording the nebulization given. Superseded by the drug dropdown and quantity concepts below: it is only read, to show answers recorded before them.',
    },
    imInjectionDrugUuid: {
      _type: Type.ConceptUuid,
      _default: '9d317dc3-9e7c-4ca0-a195-fb5fb444057a',
      _description:
        'Coded concept recording the drug given for the IM injection procedure. Its answers drive the options of the dropdown, so drugs are added or removed in the concept dictionary rather than here.',
    },
    imInjectionQtyUuid: {
      _type: Type.ConceptUuid,
      _default: '8c449bc5-522e-4bc9-96a5-bf94a9598830',
      _description: 'Numeric concept recording the quantity of the drug given for the IM injection procedure.',
    },
    ivInjectionDrugUuid: {
      _type: Type.ConceptUuid,
      _default: '65bd62b4-cabb-4c43-bfae-4a39bff70ff5',
      _description:
        'Coded concept recording the drug given for the IV injection procedure. Its answers drive the options of the dropdown, so drugs are added or removed in the concept dictionary rather than here.',
    },
    ivInjectionQtyUuid: {
      _type: Type.ConceptUuid,
      _default: 'ebab3ca6-66b3-4295-a524-2833bc17a636',
      _description: 'Numeric concept recording the quantity of the drug given for the IV injection procedure.',
    },
    oralDrugUuid: {
      _type: Type.ConceptUuid,
      _default: '9a67de0d-0b5f-465b-b08a-43af10577ba1',
      _description:
        'Coded concept recording the drug given for the Oral procedure. Its answers drive the options of the dropdown, so drugs are added or removed in the concept dictionary rather than here.',
    },
    oralQtyUuid: {
      _type: Type.ConceptUuid,
      _default: '3861a9c6-ded7-4b86-abb6-cd9de557ac43',
      _description: 'Numeric concept recording the quantity of the drug given for the Oral procedure.',
    },
    nebulizationDrugUuid: {
      _type: Type.ConceptUuid,
      _default: '5ea5d0e1-453b-4414-9a6b-6033ebd44174',
      _description:
        'Coded concept recording the drug given for the Nebulization procedure. Its answers drive the options of the dropdown, so drugs are added or removed in the concept dictionary rather than here.',
    },
    nebulizationQtyUuid: {
      _type: Type.ConceptUuid,
      _default: '393a7a86-abcb-4e40-9065-1e25a25867cd',
      _description: 'Numeric concept recording the quantity of the drug given for the Nebulization procedure.',
    },
  },
  nursing: {
    encounterTypeUuid: {
      _type: Type.UUID,
      _default: 'e621c128-a8a8-4c98-be26-3ceb92c68cfa',
      _description: 'The encounter type that nursing observations are recorded under.',
    },
    spirometryUnit: {
      _type: Type.String,
      _default: 'g',
      _description: 'Unit displayed next to the Spirometry field and column.',
    },
    monofilamentUnit: {
      _type: Type.String,
      _default: 'L',
      _description: 'Unit displayed next to the Monofilament field and column.',
    },
    ecgAttachmentCaption: {
      _type: Type.String,
      _default: 'ECG',
      _description: 'Caption given to ECG files uploaded from the nursing form.',
    },
  },
};

export interface ConfigObject {
  concepts: {
    typeOfWoundUuid: string;
    ointmentUuid: string;
    dressingGeneralNotesUuid: string;
    ecgImageUuid: string;
    spirometryUuid: string;
    monofilamentUuid: string;
    imInjectionUuid: string;
    ivInjectionUuid: string;
    oralUuid: string;
    nebulizationUuid: string;
    imInjectionDrugUuid: string;
    imInjectionQtyUuid: string;
    ivInjectionDrugUuid: string;
    ivInjectionQtyUuid: string;
    oralDrugUuid: string;
    oralQtyUuid: string;
    nebulizationDrugUuid: string;
    nebulizationQtyUuid: string;
  };
  nursing: {
    encounterTypeUuid: string;
    spirometryUnit: string;
    monofilamentUnit: string;
    ecgAttachmentCaption: string;
  };
}
