import { ReactNode } from 'react';
import { SemVer } from 'semver';

import { DependencyErrorSection } from './DependencyErrorSection.js';
import { Markdown } from './Markdown.js';
import { Package, ReleaseType } from './types.js';
import { VersionSelector } from './VersionSelector.js';

/**
 * Props for the `PackageItem` component.
 */
type PackageItemProps = {
  pkg: Package;
  selections: Record<string, string>;
  versionErrors: Record<string, string>;
  packageDependencyErrors: Record<
    string,
    {
      missingDirectDependentNames: string[];
      missingPeerDependentNames: string[];
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
}: PackageItemProps): ReactNode {
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
        {showCheckbox && (
          <div className="pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className={`h-5 w-5 rounded border-gray-300
                ${isSelected ? 'text-blue-600' : 'text-gray-300'}
              `}
            />
          </div>
        )}
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
                      ? new SemVer(pkg.version).inc(
                          selections[pkg.name] as Exclude<
                            ReleaseType,
                            'intentionally-skip' | 'custom' | string
                          >,
                        ).version
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
              isLoadingChangelog={loadingChangelogs[pkg.name]}
            />
          </div>
        </div>
      </div>

      {packageDependencyErrors[pkg.name] && (
        <div className="flex-grow flex flex-col gap-2">
          {packageDependencyErrors[pkg.name].missingDependencies.length > 0 && (
            <DependencyErrorSection
              title="Missing Dependencies"
              items={packageDependencyErrors[pkg.name].missingDependencies}
              setSelections={setSelections}
              errorSubject={`You've included ${pkg.name} in the release. However, this package has direct or peer dependencies which have unreleased changes, and you may need to include them as well.`}
              errorDetails={
                <>
                  <p className="mb-2">
                    To resolve these errors, you need to look at the changelog
                    or commit history for {pkg.name} (and possibly each
                    dependency listed below) to make the following decision:
                  </p>
                  <ul className="list-disc ml-8 mt-2">
                    <li className="mb-2">
                      <span className="font-semibold">
                        Did a dependency introduce a new feature that {pkg.name}{' '}
                        now uses? If so, you need to include the dependency in
                        the release by bumping its version.
                      </span>
                    </li>
                    <li>
                      Once you've verified that changes to a dependency do not
                      affect {pkg.name}, you may omit it from the release by
                      pressing "Skip".
                    </li>
                  </ul>
                </>
              }
            />
          )}
          {packageDependencyErrors[pkg.name].missingDirectDependentNames
            .length > 0 && (
            <DependencyErrorSection
              title="Missing Direct Dependents"
              items={
                packageDependencyErrors[pkg.name].missingDirectDependentNames
              }
              setSelections={setSelections}
              errorSubject={`You've bumped ${pkg.name} by a major version, indicating that there are breaking changes. However, this package has dependents (that is, other packages that depend on this one) that we strongly recommend you include in the release.`}
              errorDetails={
                <>
                  <p className="mb-2">
                    To resolve these errors, for each dependent listed below,
                    you need to look at its changelog or commit history to make
                    the following decision:
                  </p>
                  <ul className="list-disc ml-8 text-sm">
                    <li className="mb-2">
                      <span className="font-semibold">
                        Did you need to make changes to a dependent package in
                        response to the breaking changes? You <em>must</em>{' '}
                        include that dependent in the release.
                      </span>{' '}
                      For instance, say you've modified the return type of a
                      messenger action{' '}
                      <code className="font-mono">
                        FooController:doSomething
                      </code>
                      {', '}
                      which is used by a controller in other package,{' '}
                      <code className="font-mono">BarController</code>. In this
                      case, you would need to release the package that contains{' '}
                      <code className="font-mono">BarController</code> as well,
                      or else it wouldn't work at runtime.
                    </li>
                    <li>
                      <span className="font-semibold">
                        Even if you didn't have to make changes to a dependent
                        package, it's highly recommended you include the
                        dependent in the release anyway.
                      </span>{' '}
                      If you don't do this, multiple versions of the same
                      dependent will exist in the dependency tree, bloating the
                      installed size of the extension or mobile app. For
                      instance, you could end up with something like this:
                      <pre className="font-mono text-sm mt-2 mb-2 ml-4">
                        {`
- @metamask/foo-controller 2.0.0     # new version released
- @metamask/bar-controller 5.0.0     # no new version released
  - @metamask/foo-controller 1.0.0   # previous version
                                `.trim()}
                      </pre>
                      Whereas ideally we want this:
                      <pre className="font-mono text-sm mt-2 mb-2 ml-4">
                        {`
- @metamask/foo-controller 2.0.0     # new version released
- @metamask/bar-controller 6.0.0     # new version released
  - @metamask/foo-controller 2.0.0   # will get de-duplicated with direct dependency
                                `.trim()}
                      </pre>
                    </li>
                  </ul>
                </>
              }
            />
          )}
          {packageDependencyErrors[pkg.name].missingPeerDependentNames.length >
            0 && (
            <DependencyErrorSection
              title="Missing Peer Dependents"
              items={
                packageDependencyErrors[pkg.name].missingPeerDependentNames
              }
              setSelections={setSelections}
              errorSubject={`You've bumped ${pkg.name} by a major version, indicating that there are breaking changes. However, this package has peer dependents (that is, other packages that list this one as a peer dependency) that you should include in the release.`}
              errorDetails={
                <>
                  <p className="mb-2">
                    If a package has a peer dependency on other package, it
                    means that a project which declares the first package as a
                    dependency must also declare the second one in order for the
                    first one to function correctly, and the version used for
                    the second package must satisfy the requested version range.
                    If this is not the case, a peer dependency warning will
                    appear when dependencies are installed. (For instance, if{' '}
                    <code className="font-mono">@metamask/foo-controller</code>{' '}
                    has a peer dependency on{' '}
                    <code className="font-mono">@metamask/bar-controller</code>{' '}
                    ^1.0.0, then if{' '}
                    <code className="font-mono">@metamask/foo-controller</code>{' '}
                    is present in a client's{' '}
                    <code className="font-mono">package.json</code>,{' '}
                    <code className="font-mono">@metamask/bar-controller</code>{' '}
                    1.x must also be present.)
                  </p>
                  <p className="mb-2">
                    If you release a new major version of {pkg.name}, and you
                    upgrade it in a client, and you don't release any of the
                    peer dependents listed below, you will receive a peer
                    dependency warning, because all of the peer dependents
                    expect the client to be using the previous version, and now
                    that requirement is no longer satisfied.
                  </p>
                  <p>
                    <span className="font-semibold">
                      To fix this, you need to navigate to each of the
                      dependents and include them in the release.
                    </span>
                  </p>
                </>
              }
            />
          )}
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
