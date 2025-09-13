import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function getBuildNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

function getGitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Could not get git SHA, using fallback');
    return 'unknown';
  }
}

function getVersionFromPackageJson(packagePath) {
  try {
    const packageContent = readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    return packageJson.version;
  } catch (error) {
    console.warn(`Could not read version from ${packagePath}`);
    return 'unknown';
  }
}

function getVersionFromPyprojectToml(pyprojectPath) {
  try {
    const content = readFileSync(pyprojectPath, 'utf8');
    const versionMatch = content.match(/^version\s*=\s*"([^"]+)"/m);
    return versionMatch ? versionMatch[1] : 'unknown';
  } catch (error) {
    console.warn(`Could not read version from ${pyprojectPath}`);
    return 'unknown';
  }
}

function main() {
  const buildNumber = getBuildNumber();
  const shortSha = getGitShortSha();
  const builtAt = new Date().toISOString();

  const frontendVersion = getVersionFromPackageJson('./package.json');
  const backendVersion = getVersionFromPyprojectToml('../backend/pyproject.toml');

  const releaseId = `${buildNumber}-${shortSha}`;

  const buildInfo = {
    release_id: releaseId,
    built_at: builtAt,
    frontend_version: frontendVersion,
    backend_version: backendVersion
  };

  // Ensure public directory exists
  if (!existsSync('./public')) {
    mkdirSync('./public', { recursive: true });
  }

  // Write build info to public directory
  const buildInfoPath = './public/build-info.json';
  writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

  console.log('Build info generated:');
  console.log(JSON.stringify(buildInfo, null, 2));
}

main();
