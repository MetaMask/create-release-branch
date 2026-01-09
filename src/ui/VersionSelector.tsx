import { ReactNode } from 'react';

import { RELEASE_TYPE_OPTIONS, ReleaseType } from './types.js';

/**
 * Props for the `VersionSelector` component.
 */
type VersionSelectorProps = {
  packageName: string;
  selection: string;
  onSelectionChange: (packageName: string, value: ReleaseType | '') => void;
  onCustomVersionChange: (packageName: string, version: string) => void;
  onFetchChangelog: (packageName: string) => Promise<void>;
  isLoadingChangelog: boolean;
};

/**
 * The dropdown used to select a version for a package.
 *
 * @param props - The props.
 * @param props.packageName - The name of the package.
 * @param props.selection - The selected value of the dropdown.
 * @param props.onSelectionChange - Callback called when the value of the
 * dropdown changes.
 * @param props.onCustomVersionChange - Callback called when the value of the
 * custom version text field is changed.
 * @param props.onFetchChangelog - Callback called when the changelog for the
 * package is fetched.
 * @param props.isLoadingChangelog - Whether the changelog for the package is
 * being loaded.
 * @returns The version selector component.
 */
export function VersionSelector({
  packageName,
  selection,
  onSelectionChange,
  onCustomVersionChange,
  onFetchChangelog,
  isLoadingChangelog,
}: VersionSelectorProps): ReactNode {
  return (
    <div className="flex items-center space-x-2">
      <select
        value={selection}
        onChange={(event) => onSelectionChange(packageName, event.target.value)}
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
          onChange={(event) =>
            onCustomVersionChange(packageName, event.target.value)
          }
          className="border rounded px-2 py-1"
        />
      )}
      <button
        onClick={() => {
          onFetchChangelog(packageName).catch(console.error);
        }}
        disabled={isLoadingChangelog}
        className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:bg-gray-400"
      >
        {isLoadingChangelog ? 'Loading...' : 'View Changelog'}
      </button>
    </div>
  );
}
