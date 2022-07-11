import { determineEditor } from './editor-utils';
import { getEnvironmentVariables } from './env-utils';

jest.mock('./env-utils', () => {
  return {
    getEnvironmentVariables: jest.fn(),
  };
});

const mockedGetEnvironmentVariables = jest.mocked(getEnvironmentVariables);

describe('editor-utils', () => {
  describe('determineEditor', () => {
    it.todo(
      'returns information about the editor from EDITOR if it points to an executable',
    );
  });
});
