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
      _description: 'Free-text concept recording the intramuscular injection given.',
    },
    ivInjectionUuid: {
      _type: Type.ConceptUuid,
      _default: 'bfeb3e24-1aab-42c3-beb1-33ab91fdbe7b',
      _description: 'Free-text concept recording the intravenous injection given.',
    },
    oralUuid: {
      _type: Type.ConceptUuid,
      _default: '99a79867-1b40-43ab-ac08-6483acfd3a46',
      _description: 'Free-text concept recording the oral medication given.',
    },
    nebulizationUuid: {
      _type: Type.ConceptUuid,
      _default: '992966a6-45b5-4b32-b515-b0a298881e35',
      _description: 'Free-text concept recording the nebulization given.',
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
  };
  nursing: {
    encounterTypeUuid: string;
    spirometryUnit: string;
    monofilamentUnit: string;
    ecgAttachmentCaption: string;
  };
}
