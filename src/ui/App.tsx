import './style.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SemVer } from 'semver';
import { ErrorMessage } from './ErrorMessage.js';
import { PackageItem } from './PackageItem.js';
import { Package, RELEASE_TYPE_OPTIONS, ReleaseType } from './types.js';

type SubmitButtonProps = {
  selections: Record<string, string>;
  packageDependencyErrors: Record<
    string,
    { missingDependentNames: string[]; missingDependencies: string[] }
  >;
  onSubmit: () => Promise<void>;
};

function SubmitButton({
  selections,
  packageDependencyErrors,
  onSubmit,
}: SubmitButtonProps) {
  const isDisabled =
    Object.keys(selections).length === 0 ||
    Object.keys(packageDependencyErrors).length > 0 ||
    Object.values(selections).every((value) => value === 'intentionally-skip');

  return (
    <button
      onClick={() => void onSubmit()}
      disabled={isDisabled}
      className={`mt-6 px-4 py-2 rounded ${
        isDisabled
          ? 'bg-blue-300 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600'
      } text-white`}
    >
      Create Release Branch
    </button>
  );
}

function App() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
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
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  useEffect(() => {
    fetch('/api/packages')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Received ${res.status}`);
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

  const checkDependencies = async (selectionData: Record<string, string>) => {
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
    if (value === '') {
      const { [packageName]: _, ...rest } = selections;
      setSelections(rest);

      const { [packageName]: __, ...remainingErrors } = packageDependencyErrors;
      setPackageDependencyErrors(remainingErrors);
    } else {
      setSelections({
        ...selections,
        [packageName]: value,
      });
    }
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

  const handleBulkAction = (action: ReleaseType) => {
    const newSelections = { ...selections };
    selectedPackages.forEach((packageName) => {
      newSelections[packageName] = action;
    });
    setSelections(newSelections);
    setSelectedPackages(new Set());
    setShowCheckboxes(true);
  };

  const togglePackageSelection = (packageName: string) => {
    setSelectedPackages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(packageName)) {
        newSet.delete(packageName);
      } else {
        newSet.add(packageName);
      }
      return newSet;
    });
  };

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">Create Release Branch</h2>
          <p className="mb-6">
            Please wait while we create the release branch with your selections.
            This may take a few minutes...
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">
            Release Branch Successfully Created!
          </h2>
          <p className="mb-6">
            You are now on a new branch that represents the new release. You are
            free to close this window and make whatever other changes you would
            like to the branch. When you're ready, push it up and make a new
            pull request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Core Release</h1>

      <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
        <h2 className="text-xl font-semibold mb-2">How to use this tool</h2>
        <p className="mb-2">
          Listed below are the packages in this monorepo which have unreleased
          changes. You do not need to release all packages; you may release a
          subset. To add a new package, you first need to decide how to bump its
          version. Look over the changelog or commit history to understand the
          nature of the changes that have been made to the package. Then you can
          select a version from the dropdown next to the package. If there are
          breaking changes, select "Major"; if there are new features, select
          "Minor"; and if there are only non-functional backward-compatible
          changes, select "Patch".
        </p>
        <p>
          Some packages are linked via dependencies, and because of this you may
          be asked to include other packages in the release you were not
          anticipating. We've done our best to explain why, but feel free to
          reach out to the Wallet Framework team if you have any questions.
        </p>
      </div>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        {showCheckboxes && selectedPackages.size > 0 ? (
          <>
            <span className="mr-2">
              Bulk action for {selectedPackages.size} packages:
            </span>
            {RELEASE_TYPE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  handleBulkAction(value as ReleaseType);
                  setShowCheckboxes(false);
                }}
                className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {label}
              </button>
            ))}
          </>
        ) : (
          <button
            onClick={() => setShowCheckboxes(!showCheckboxes)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Select multiple packages
          </button>
        )}
      </div>

      <div className="space-y-4">
        {packages.map((pkg) => (
          <PackageItem
            key={pkg.name}
            pkg={pkg}
            selections={selections}
            versionErrors={versionErrors}
            packageDependencyErrors={packageDependencyErrors}
            loadingChangelogs={loadingChangelogs}
            changelogs={changelogs}
            isSelected={selectedPackages.has(pkg.name)}
            showCheckbox={showCheckboxes}
            onSelectionChange={handleSelectionChange}
            onCustomVersionChange={handleCustomVersionChange}
            onFetchChangelog={fetchChangelog}
            setSelections={setSelections}
            setChangelogs={setChangelogs}
            onToggleSelect={() => togglePackageSelection(pkg.name)}
          />
        ))}
      </div>

      {packages.length > 0 && (
        <SubmitButton
          selections={selections}
          packageDependencyErrors={packageDependencyErrors}
          onSubmit={handleSubmit}
        />
      )}

      {error && <div className="text-red-600 p-4">Error: {error}</div>}

      {submitErrors.length > 0 && <ErrorMessage errors={submitErrors} />}
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
