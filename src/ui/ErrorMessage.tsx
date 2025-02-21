type ErrorMessageProps = {
  errors: string[];
};

export function ErrorMessage({ errors }: ErrorMessageProps) {
  if (errors.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-red-700 font-semibold mb-2">
        {
          'Your release spec could not be processed due to the following issues:'
        }
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
