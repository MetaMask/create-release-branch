type DependencyErrorSectionProps = {
  title: string;
  items: string[];
  setSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  description: string;
};

/**
 * Display details about missing dependents or dependencies.
 *
 * @param props - The props.
 * @param props.title - The title of the section.
 * @param props.items - The missing dependents or dependencies.
 * @param props.setSelections - Updates data around packages selected for the release.
 * @param props.description - Describes the error.
 * @returns The section component.
 */
export function DependencyErrorSection({
  title,
  items,
  setSelections,
  description,
}: DependencyErrorSectionProps) {
  return (
    <div className="text-red-800">
      <div className="flex justify-between items-center mb-2">
        <p className="font-semibold">{title}:</p>
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
      <p className="text-sm mb-2">{description}</p>
      <ul className="list-disc ml-4">
        {items.map((dep) => (
          <li key={dep} className="flex justify-between items-center mb-2">
            <span
              onClick={() => {
                document
                  .getElementById(`package-${dep}`)
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="cursor-pointer hover:underline"
            >
              {dep}
            </span>
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
