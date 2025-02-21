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
  onSelectionChange: (packageName: string, value: ReleaseType | '') => void;
  onCustomVersionChange: (packageName: string, version: string) => void;
  onFetchChangelog: (packageName: string) => Promise<void>;
  setSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setChangelogs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export function PackageItem({
  pkg,
  selections,
  versionErrors,
  packageDependencyErrors,
  loadingChangelogs,
  changelogs,
  onSelectionChange,
  onCustomVersionChange,
  onFetchChangelog,
  setSelections,
  setChangelogs,
}: PackageItemProps) {
  return (
    <div
      key={pkg.name}
      id={`package-${pkg.name}`}
      className={`border p-4 rounded-lg ${
        selections[pkg.name] && selections[pkg.name] !== 'intentionally-skip'
          ? 'border-gray-500'
          : 'border-gray-200'
      } ${
        packageDependencyErrors[pkg.name] &&
        packageDependencyErrors[pkg.name].missingDependencies.length > 0
          ? 'border-red-500'
          : ''
      }`}
    >
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
                {!['patch', 'minor', 'major'].includes(selections[pkg.name])
                  ? selections[pkg.name]
                  : new SemVer(pkg.version)
                      .inc(
                        selections[pkg.name] as Exclude<
                          ReleaseType,
                          'intentionally-skip' | 'custom' | string
                        >,
                      )
                      .toString()}
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

      {packageDependencyErrors[pkg.name] && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex-grow">
            {packageDependencyErrors[pkg.name].missingDependencies.length >
              0 && (
              <DependencyErrorSection
                title="Missing Dependencies"
                items={packageDependencyErrors[pkg.name].missingDependencies}
                setSelections={setSelections}
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
