import fs from 'fs';
import path from 'path';
import Repo from './repo';

/**
 * A facade for the "remote" repo, which is only used to hold tags so that
 * `@metamask/auto-changelog` can run `git fetch --tags`.
 */
export default class RemoteRepo extends Repo {
  /**
   * Creates a bare repo.
   */
  async create() {
    await fs.promises.mkdir(this.getWorkingDirectoryPath(), {
      recursive: true,
    });
    await this.runCommand('git', ['init', '--bare']);
  }

  /**
   * Returns the path of the directory where this repo is located.
   *
   * @returns `remote-repo` within the environment directory.
   */
  getWorkingDirectoryPath() {
    return path.join(this.environmentDirectoryPath, 'remote-repo');
  }
}
