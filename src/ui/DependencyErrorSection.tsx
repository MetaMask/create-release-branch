type DependencyErrorSectionProps = {
  title: string;
  items: string[];
  setSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  errorSubject: string;
  errorDetails: React.ReactNode;
};

/**
 * Display details about missing dependents or dependencies.
 *
 * @param props - The props.
 * @param props.title - The title of the section.
 * @param props.items - The missing dependents or dependencies.
 * @param props.setSelections - Updates data around packages selected for the release.
 * @param props.errorSubject - Summarizes the error.
 * @param props.errorDetails - Explains more about the error and how the user
 * can fix it.
 * @returns The section component.
 */
export function DependencyErrorSection({
  title,
  items,
  setSelections,
  errorSubject,
  errorDetails,
}: DependencyErrorSectionProps) {
  return (
    <div className="mt-4 pt-4 border-t border-red-200">
      <div className="flex justify-between items-center mb-2">
        <p className="text-lg font-semibold text-red-700">{title}</p>
        <button
          onClick={() => {
            setSelections((prev) => ({
              ...prev,
              ...items.reduce(
                (acc, dep) => ({
                  ...acc,
                  [dep]: 'intentionally-skip',
                }),
                {},
              ),
            }));
          }}
          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
        >
          Skip All
        </button>
      </div>
      <p className="mb-2">{errorSubject}</p>
      <details className="bg-blue-50 border border-blue-200 rounded p-2 my-4 w-fit text-sm [&:open]:w-auto">
        <summary className="text-blue-800 font-semibold hover:underline cursor-pointer">
          Read more
        </summary>
        <div className="mt-2 ml-4">{errorDetails}</div>
      </details>
      <ul className="list-disc">
        {items.map((dep) => (
          <li
            key={dep}
            className="flex justify-between items-center mb-2 text-gray-700"
          >
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(`package-${dep}`)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="cursor-pointer hover:underline"
            >
              {dep}
            </a>
            <button
              onClick={() =>
                setSelections((prev) => ({
                  ...prev,
                  [dep]: 'intentionally-skip',
                }))
              }
              className="ml-4 px-2 py-0.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Skip
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
