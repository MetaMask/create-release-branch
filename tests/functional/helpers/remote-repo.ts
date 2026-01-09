import fs from 'fs';
import path from 'path';

import Repo from './repo.js';

/**
 * A facade for the "remote" repo, which only exists so that the tool can run
 * `git fetch --tags`.
 */
export default class RemoteRepo extends Repo {
  /**
   * Creates a bare repo.
   */
  async create(): Promise<void> {
    await fs.promises.mkdir(this.getWorkingDirectoryPath(), {
      recursive: true,
    });
    await this.runCommand('git', ['init', '-b', 'main', '--bare']);
  }

  /**
   * Returns the path of the directory where this repo is located.
   *
   * @returns `remote-repo` within the environment directory.
   */
  getWorkingDirectoryPath(): string {
    return path.join(this.environmentDirectoryPath, 'remote-repo');
  }
}
