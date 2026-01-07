import { SemVer } from 'semver';
import { Markdown } from './Markdown.js';
import { VersionSelector } from './VersionSelector.js';
import { DependencyErrorSection } from './DependencyErrorSection.js';
import { Package, ReleaseType } from './types.js';

type PackageItemProps = {
  pkg: Package;
  selections: Record<string, string>;
  versionErrors: Record<string, string>;
  packageDependencyErrors: Record<
    string,
    {
      missingDependentNames: string[];
      missingDependencies: string[];
    }
  >;
  loadingChangelogs: Record<string, boolean>;
  changelogs: Record<string, string>;
  isSelected: boolean;
  showCheckbox: boolean;
  onSelectionChange: (packageName: string, value: ReleaseType | '') => void;
  onCustomVersionChange: (packageName: string, version: string) => void;
  onFetchChangelog: (packageName: string) => Promise<void>;
  setSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setChangelogs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onToggleSelect: () => void;
};

/**
 * Displays a box for a candidate package within a release, which contains the
 * name of the package, its current and new version, a dropdown for selecting a
 * new version, and any errors that are generated when selecting a new version.
 *
 * @param props - The props.
 * @param props.pkg - Data on the package.
 * @param props.selections - The list of selected packages in this release.
 * @param props.versionErrors - Validation errors specific to the new version
 * chosen.
 * @param props.packageDependencyErrors - Errors related to dependencies or
 * dependents of the package.
 * @param props.loadingChangelogs - Used to determine whether the changelog for
 * this package is being loaded.
 * @param props.changelogs - Used to display the changelog for this package.
 * @param props.isSelected - Whether this package is selected (for bulk
 * actions).
 * @param props.showCheckbox - Whether a checkbox should be shown next to the
 * package name (for bulk actions).
 * @param props.onSelectionChange - Callback called when the version selector
 * for the package is changed.
 * @param props.onCustomVersionChange - Callback called when a custom version is
 * set or changed.
 * @param props.onFetchChangelog - Callback called when the changelog is fetched.
 * @param props.setSelections - Used to update the list of packages selected for
 * this release.
 * @param props.setChangelogs - Used to update the list of changelogs loaded
 * across all packages.
 * @param props.onToggleSelect - Callback called when selection for this package
 * is toggled.
 * @returns The package item component.
 */
export function PackageItem({
  pkg,
  selections,
  versionErrors,
  packageDependencyErrors,
  loadingChangelogs,
  changelogs,
  isSelected,
  showCheckbox,
  onSelectionChange,
  onCustomVersionChange,
  onFetchChangelog,
  setSelections,
  setChangelogs,
  onToggleSelect,
}: PackageItemProps) {
  return (
    <div
      key={pkg.name}
      id={`package-${pkg.name}`}
      className={`border p-4 rounded-lg ${
        selections[pkg.name] && selections[pkg.name] !== 'intentionally-skip'
          ? 'border-2'
          : 'border-gray-200'
      } ${
        packageDependencyErrors[pkg.name] &&
        packageDependencyErrors[pkg.name].missingDependencies.length > 0
          ? 'border-red-500'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className={`h-5 w-5 rounded border-gray-300
                ${isSelected ? 'text-blue-600' : 'text-gray-300'}
              `}
            />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{pkg.name}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Current version: {pkg.version}</p>
              {selections[pkg.name] &&
                selections[pkg.name] !== 'intentionally-skip' &&
                selections[pkg.name] !== 'custom' &&
                !versionErrors[pkg.name] && (
                  <p className="text-yellow-700">
                    New version:{' '}
                    {['patch', 'minor', 'major'].includes(selections[pkg.name])
                      ? new SemVer(pkg.version)
                          .inc(
                            selections[pkg.name] as Exclude<
                              ReleaseType,
                              'intentionally-skip' | 'custom' | string
                            >,
                          )
                          .toString()
                      : selections[pkg.name]}
                  </p>
                )}
              {versionErrors[pkg.name] && (
                <p className="text-red-500 text-sm mt-1">
                  {versionErrors[pkg.name]}
                </p>
              )}
            </div>
            <VersionSelector
              packageName={pkg.name}
              selection={selections[pkg.name]}
              onSelectionChange={onSelectionChange}
              onCustomVersionChange={onCustomVersionChange}
              onFetchChangelog={onFetchChangelog}
              isLoadingChangelog={loadingChangelogs[pkg.name] === true}
            />
          </div>
        </div>
      </div>

      {packageDependencyErrors[pkg.name] && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex-grow">
            {packageDependencyErrors[pkg.name].missingDependencies.length >
              0 && (
              <DependencyErrorSection
                title="Missing Dependencies"
                items={packageDependencyErrors[pkg.name].missingDependencies}
                setSelections={setSelections}
                description={`The following packages are dependencies or peer dependencies of ${pkg.name}. Because they may have introduced new changes that ${pkg.name} is now using, you need to verify whether to include them in the release.

To do this, look at the change history for each package and compare it with the change history for ${pkg.name}. If ${pkg.name} uses any new changes from a package, then you need to include it by bumping its version. If you have confirmed that the changes to a package do not affect ${pkg.name}, you may omit it from the release by choosing "Skip" instead.`}
              />
            )}
            {packageDependencyErrors[pkg.name].missingDependentNames.length >
              0 && (
              <div className="mt-4">
                <DependencyErrorSection
                  title="Missing Dependents"
                  items={
                    packageDependencyErrors[pkg.name].missingDependentNames
                  }
                  setSelections={setSelections}
                  description={`Because ${pkg.name} is being released with a new major version, to prevent peer dependency warnings in consuming projects, all of the following packages which list ${pkg.name} as a peer dependency need to be included in the release. Please choose new versions for these packages. If for some reason you feel it is safe to omit a package you may choose "Skip".`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {changelogs[pkg.name] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex justify-end mb-2">
              <button
                onClick={() =>
                  setChangelogs((prev) => ({ ...prev, [pkg.name]: '' }))
                }
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <Markdown content={changelogs[pkg.name]} />
          </div>
        )}
      </div>
    </div>
  );
}
