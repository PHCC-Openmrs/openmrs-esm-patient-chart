import { describe, it, expect } from 'vitest';
import { type TFunction } from 'i18next';
import { getOrderSubmissionErrorMessage } from './order-basket.utils';

const t = ((_key: string, defaultValue: string) => defaultValue) as unknown as TFunction;

describe('getOrderSubmissionErrorMessage', () => {
  it('spells out field errors behind a generic "Invalid Submission"', () => {
    const error = {
      responseBody: {
        error: {
          message: 'Invalid Submission',
          globalErrors: [],
          fieldErrors: {
            doseUnits: [
              {
                code: 'DrugOrder.error.notAmongAllowedConcepts',
                message: 'The units concept must be among allowed concepts',
              },
            ],
          },
        },
      },
    };

    expect(getOrderSubmissionErrorMessage(error, t)).toBe(
      'Dose unit: The units concept must be among allowed concepts',
    );
  });

  it('falls back to the top-level message when there are no details', () => {
    expect(getOrderSubmissionErrorMessage({ responseBody: { error: { message: 'Something failed' } } }, t)).toBe(
      'Something failed',
    );
  });

  it('falls back to a generic message for errors without a response body', () => {
    expect(getOrderSubmissionErrorMessage(new Error('network'), t)).toBe('Please try launching the workspace again');
  });
});
