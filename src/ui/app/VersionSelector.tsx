import { RELEASE_TYPE_OPTIONS, ReleaseType } from './types.js';

type VersionSelectorProps = {
  packageName: string;
  selection: string;
  onSelectionChange: (packageName: string, value: ReleaseType | '') => void;
  onCustomVersionChange: (packageName: string, version: string) => void;
  onFetchChangelog: (packageName: string) => Promise<void>;
  isLoadingChangelog: boolean;
};

export function VersionSelector({
  packageName,
  selection,
  onSelectionChange,
  onCustomVersionChange,
  onFetchChangelog,
  isLoadingChangelog,
}: VersionSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <select
        value={selection}
        onChange={(e) =>
          onSelectionChange(packageName, e.target.value as ReleaseType)
        }
        className="border rounded px-2 py-1"
      >
        <option value="">Select version bump</option>
        {RELEASE_TYPE_OPTIONS.map(({ label, value }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
        <option value="custom">Custom Version</option>
        {selection &&
          ![
            'major',
            'minor',
            'patch',
            'intentionally-skip',
            'custom',
            '',
          ].includes(selection) && (
            <option value={selection}>Current: {selection}</option>
          )}
      </select>
      {selection === 'custom' && (
        <input
          type="text"
          placeholder="Enter version (e.g., 1.2.3)"
          onChange={(e) => onCustomVersionChange(packageName, e.target.value)}
          className="border rounded px-2 py-1"
        />
      )}
      <button
        onClick={() => void onFetchChangelog(packageName)}
        disabled={isLoadingChangelog}
        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:bg-gray-400"
      >
        {isLoadingChangelog ? 'Loading...' : 'View Changelog'}
      </button>
    </div>
  );
}
