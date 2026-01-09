import { ReactNode } from 'react';

/**
 * Props for the `ErrorMessage` component.
 */
type ErrorMessageProps = {
  errors: string[];
};

/**
 * A generic error message.
 *
 * @param props - The props.
 * @param props.errors - The list of errors.
 * @returns The error message component.
 */
export function ErrorMessage({ errors }: ErrorMessageProps): ReactNode {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-red-700 font-semibold mb-2">
        {'Your release could not be created due to the following issues:'}
      </h3>
      <ul className="list-disc pl-5">
        {errors.map((error, index) => (
          <li
            key={index}
            className="text-red-600 whitespace-pre-wrap font-mono mb-2"
          >
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}
