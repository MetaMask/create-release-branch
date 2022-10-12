#!/usr/bin/env bash

set -euo pipefail

yarn tsc --project tsconfig.build.json
mkdir tmp
touch tmp/cli.js
echo "#!/usr/bin/env node" >> tmp/cli.js
echo >> tmp/cli.js
cat dist/cli.js >> tmp/cli.js
mv tmp/cli.js dist/cli.js
rm -r tmp
chmod +x dist/cli.js
