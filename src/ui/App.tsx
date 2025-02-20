import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { SemVer } from 'semver';

interface Package {
  name: string;
  version: string;
  location: string;
}

type ReleaseType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'intentionally-skip'
  | 'custom'
  | string;

function App() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changelogs, setChangelogs] = useState<Record<string, string>>({});
  const [loadingChangelogs, setLoadingChangelogs] = useState<
    Record<string, boolean>
  >({});
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [versionErrors, setVersionErrors] = useState<Record<string, string>>(
    {},
  );
  const [packageDependencyErrors, setPackageDependencyErrors] = useState<
    Record<
      string,
      {
        missingDependentNames: string[];
        missingDependencies: string[];
      }
    >
  >({});
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/packages')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch packages');
        }
        return res.json();
      })
      .then((data: Package[]) => {
        setPackages(data);
        setLoadingChangelogs(
          data.reduce((acc, pkg) => ({ ...acc, [pkg.name]: false }), {}),
        );
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error fetching packages:', err);
      });
  }, []);

  const checkDependencies = async (selectionData: Record<string, any>) => {
    if (Object.keys(selectionData).length === 0) return;

    try {
      const response = await fetch('/api/check-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectionData),
      });

      const data = await response.json();

      if (data.status === 'error' && data.errors) {
        setPackageDependencyErrors(data.errors);
        return false;
      }

      setSubmitErrors([]);
      setPackageDependencyErrors({});
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error checking dependencies:', err);
      return false;
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void checkDependencies(selections);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selections]);

  const handleCustomVersionChange = (packageName: string, version: string) => {
    try {
      if (!version) {
        setVersionErrors((prev) => ({
          ...prev,
          [packageName]: 'Version is required',
        }));
        return;
      }

      const newVersion = new SemVer(version);
      const currentVersion = new SemVer(
        packages.find((p) => p.name === packageName)?.version || '0.0.0',
      );

      if (newVersion.compare(currentVersion) <= 0) {
        setVersionErrors((prev) => ({
          ...prev,
          [packageName]: 'New version must be higher than current version',
        }));
        return;
      }

      setVersionErrors((prev) => {
        const { [packageName]: _, ...rest } = prev;
        return rest;
      });

      setSelections((prev) => ({
        ...prev,
        [packageName]: version,
      }));
    } catch (err) {
      setVersionErrors((prev) => ({
        ...prev,
        [packageName]: 'Invalid semver version',
      }));
    }
  };

  const handleSelectionChange = (
    packageName: string,
    value: ReleaseType | '',
  ): void => {
    setSelections((prev) => {
      if (value === '') {
        const { [packageName]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [packageName]: value,
      };
    });
  };

  const handleSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selections),
      });

      const data: {
        status: 'success' | 'error';
        packagesErrors?: Record<
          string,
          {
            missingDependentNames: string[];
            missingDependencies: string[];
          }
        >;
        errors?: {
          message: string | string[];
          lineNumber?: number;
        }[];
      } = await response.json();

      if (data.status === 'error' && data.errors) {
        setSubmitErrors(
          data.errors.flatMap((error) => {
            if (Array.isArray(error.message)) {
              return error.message;
            }
            return error.message;
          }),
        );
      }

      if (data.status === 'success') {
        setIsSuccess(true);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error submitting selections:', err);
      alert('Failed to submit selections. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchChangelog = async (packageName: string): Promise<void> => {
    setLoadingChangelogs((prev) => ({ ...prev, [packageName]: true }));
    try {
      const response = await fetch(`/api/changelog?package=${packageName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch changelog');
      }
      const changelog = await response.text();
      setChangelogs((prev) => ({ ...prev, [packageName]: changelog }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch changelog';
      setError(errorMessage);
    } finally {
      setLoadingChangelogs((prev) => ({ ...prev, [packageName]: false }));
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">Release Successful!</h2>
          <p className="mb-6">You can now close this window.</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Create Release Branch Interactive UI
      </h1>

      <div className="space-y-4">
        {packages.map((pkg) => (
          <div
            key={pkg.name}
            id={`package-${pkg.name}`}
            className={`border p-4 rounded-lg ${
              selections[pkg.name] &&
              selections[pkg.name] !== 'intentionally-skip'
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
                      {!['patch', 'minor', 'major'].includes(
                        selections[pkg.name],
                      )
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
              <div className="flex items-center space-x-2">
                <select
                  value={selections[pkg.name]}
                  onChange={(e) =>
                    handleSelectionChange(
                      pkg.name,
                      e.target.value as ReleaseType,
                    )
                  }
                  className="border rounded px-2 py-1"
                >
                  <option value="">Select version bump</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="patch">Patch</option>
                  <option value="intentionally-skip">Skip</option>
                  <option value="custom">Custom Version</option>
                  {selections[pkg.name] &&
                    ![
                      'major',
                      'minor',
                      'patch',
                      'intentionally-skip',
                      'custom',
                      '',
                    ].includes(selections[pkg.name]) && (
                      <option value={selections[pkg.name]}>
                        Current: {selections[pkg.name]}
                      </option>
                    )}
                </select>
                {selections[pkg.name] === 'custom' && (
                  <input
                    type="text"
                    placeholder="Enter version (e.g., 1.2.3)"
                    onChange={(e) =>
                      handleCustomVersionChange(pkg.name, e.target.value)
                    }
                    className="border rounded px-2 py-1"
                  />
                )}
                <button
                  onClick={() => void fetchChangelog(pkg.name)}
                  disabled={loadingChangelogs[pkg.name] === true}
                  className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:bg-gray-400"
                >
                  {loadingChangelogs[pkg.name]
                    ? 'Loading...'
                    : 'View Changelog'}
                </button>
              </div>
            </div>

            {packageDependencyErrors[pkg.name] && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex-grow">
                  {packageDependencyErrors[pkg.name].missingDependencies
                    .length > 0 && (
                    <div className="text-red-800">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold">Missing Dependencies:</p>
                        <button
                          onClick={() => {
                            const missingDeps =
                              packageDependencyErrors[pkg.name]
                                .missingDependencies;
                            setSelections((prev) => ({
                              ...prev,
                              ...missingDeps.reduce(
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
                        Please either include these packages in your release
                        selections, or choose "Skip" if you are absolutely sure
                        they are safe to omit:
                      </p>
                      <ul className="list-disc ml-4">
                        {packageDependencyErrors[
                          pkg.name
                        ].missingDependencies.map((dep) => (
                          <li
                            key={dep}
                            className="flex justify-between items-center mb-2"
                          >
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
                  )}
                  {packageDependencyErrors[pkg.name].missingDependentNames
                    .length > 0 && (
                    <div className="text-red-800 mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold">Missing Dependents:</p>
                        <button
                          onClick={() => {
                            const missingDependents =
                              packageDependencyErrors[pkg.name]
                                .missingDependentNames;
                            setSelections((prev) => ({
                              ...prev,
                              ...missingDependents.reduce(
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
                        Please either include these packages in your release
                        selections, or choose "Skip" if you are absolutely sure
                        they are safe to omit:
                      </p>
                      <ul className="list-disc ml-4">
                        {packageDependencyErrors[
                          pkg.name
                        ].missingDependentNames.map((dep) => (
                          <li
                            key={dep}
                            className="flex justify-between items-center mb-2"
                          >
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
                  <ReactMarkdown
                    children={changelogs[pkg.name]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold my-4" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold my-3" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-bold my-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="my-2" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc ml-4 my-2" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal ml-4 my-2" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="my-1" {...props} />
                      ),
                      code: ({ node, ...props }) => (
                        <code
                          className="bg-gray-100 rounded px-1 py-0.5 text-sm font-mono"
                          {...props}
                        />
                      ),
                      pre: ({ node, ...props }) => (
                        <pre
                          className="bg-gray-100 rounded p-2 my-2 overflow-x-auto font-mono text-sm"
                          {...props}
                        />
                      ),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {packages.length > 0 && (
        <button
          onClick={() => void handleSubmit()}
          disabled={
            isSubmitting ||
            Object.keys(selections).length === 0 ||
            Object.keys(packageDependencyErrors).length > 0
          }
          className={`mt-6 px-4 py-2 rounded ${
            isSubmitting ||
            Object.keys(selections).length === 0 ||
            Object.keys(packageDependencyErrors).length > 0
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Release Selections'}
        </button>
      )}

      {error && <div className="text-red-600 p-4">Error: {error}</div>}

      {submitErrors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-700 font-semibold mb-2">
            Your release spec could not be processed due to the following
            issues:
          </h3>
          <ul className="list-disc pl-5">
            {submitErrors.map((error, index) => (
              <li
                key={index}
                className="text-red-600 whitespace-pre-wrap font-mono mb-2"
              >
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
