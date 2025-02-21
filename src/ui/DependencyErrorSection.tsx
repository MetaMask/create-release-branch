type DependencyErrorSectionProps = {
  title: string;
  items: string[];
  setSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export function DependencyErrorSection({
  title,
  items,
  setSelections,
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
      <p className="text-sm mb-2">
        Please either include these packages in your release selections, or
        choose "Skip" if you are absolutely sure they are safe to omit:
      </p>
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
