const NodeGit = require( 'nodegit' );
const Fs = require('fs');
const Path = require('path');
const Cp = require('child_process');

async function getSiteData (root, repoDir, subdomains) {
  const errors = [];
  const sitePathToSubdomain = subdomains.reduce((acc, subd) => {
    let sitePath = subd.DocumentRoot;
    if (sitePath.startsWith('/')) {
      sitePath = sitePath.substring(1);
      if (sitePath.startsWith(repoDir)) {
        sitePath = sitePath.substring(repoDir.length);
        acc[sitePath] = subd.ServerName.split('.')[0];
      } else {
        errors.push(`DocumentRoot expected to start with '${repoDir}': ${sitePath}`);
      }
    } else {
      errors.push(`DocumentRoot expected to start with '/': ${sitePath}`);
    }
    return acc;
  }, {});
  console.log(sitePathToSubdomain);

  const sites = []
  for (const type of Fs.readdirSync(Path.join(root, repoDir), { withFileTypes: true })) {
    const typeDir = Path.join(root, repoDir, type.name);
    for (const owner of Fs.readdirSync(typeDir, { withFileTypes: true })) {
      const orgDir = Path.join(typeDir, owner.name);
      for (const repo of Fs.readdirSync(orgDir, { withFileTypes: true })) {
        const repoDir = Path.join(orgDir, repo.name);
        const sitePath = type.name + '/' + owner.name + '/' + repo.name;
        const subdomain = sitePathToSubdomain[sitePath];
        const repository = await NodeGit.Repository.open(repoDir);
        const head = await repository.getHeadCommit( );
        sites.push({
          type: type.name,
          owner: owner.name,
          repo: repo.name,
          sitePath,
          subdomain,
          dateTime: head.date(),
          who: head.committer().name(),
          hash: head.sha(),
        });
      }
    }
  }
  return sites;
}

async function updateSubdomain (debug, root, type, owner, repo, subdomain, repoDir, subdomainDir) {
  const sitePath = Path.join(type, owner, repo);
  const absSiteDir = `${root}${repoDir}${sitePath}`;
  debug(`creating subdomain linking ${subdomain} to ${absSiteDir}`);
  await Fs.promises.stat(Path.join(root, subdomainDir)); // possibly throw ENOENT to caller
  const subdomainFilePath = Path.join(root, subdomainDir, subdomain);
  debug(`  in ${subdomainFilePath}`);

  const vhostContents = `  ServerName ${subdomain}.fdpcloud.org
  DocumentRoot ${absSiteDir}
  <Directory ${absSiteDir}>
    include ./sites-available/fdpcloud-dirConfig
  </Directory>
  include ./sites-available/fdpcloud-common`;

  const vhostText = `# Created by FdpManager ${new Date().toISOString()}
<VirtualHost *:80>
${vhostContents}
</VirtualHost>

<VirtualHost *:443>
${vhostContents}
  include ./sites-available/fdpcloud-ssl
</VirtualHost>
`;
  await Fs.promises.writeFile(subdomainFilePath, vhostText, { flag: 'wx' });// possibly throw EEXIST to caller
  debug(`linked ${subdomainFilePath} to ${absSiteDir}`);
  return [`linked ${subdomain} to ${sitePath}`];
}

async function ensureRepoDir (debug, siteDir, type, owner, repo) {
  let d = siteDir;
  await Fs.promises.stat(d); // possibly throw ENOENT to caller

  d = Path.join(d, type);
  try {
    await Fs.promises.mkdir(d);
  } catch (e) {
    if (e.code !== 'EEXIST')
      throw e;
  }

  d = Path.join(d, owner);;
  try {
    await Fs.promises.mkdir(d);
  } catch (e) {
    if (e.code !== 'EEXIST')
      throw e;
  }

  d = Path.join(d, repo);;
  await Fs.promises.mkdir(d); // send this error right up to the caller

  return d;
}

/**
 * early returns for errors
 */
async function createSite (debug, root, type, owner, repo, repoDir) {
  const sitePath = root + repoDir;
  const args = [
    {name: 'type', value: type},
    {name: 'owner', value: owner},
    {name: 'repo', value: repo},
  ];
  args.forEach(arg => {
    if (!arg.value) throw Error(`missing ${arg.name}`);
  });
  let repoUrl = null;
  let repoData = null;
  switch (type) {
  case 'github':
    repoUrl = `http://github.com/${owner}/${repo}`;
    // repoData = await getGithubRepo(repoUrl);
    // debug('remote: ' + JSON.stringify(repoData));
    break;
  default:
    throw Error(`unknown repo type: ${type}`);
  }

  const absSiteDir = await ensureRepoDir(debug, `${root}${repoDir}`, type, owner, repo);
  debug(`cloning ${repoUrl} to: ${absSiteDir}`);
  if (false) {
    // Cloning over API requires auth token for no reason I can think of.
    const repoObject = await NodeGit.Clone(repoUrl, absSiteDir, {
      checkoutBranch: 'main'
    });
  } else {
    Cp.execSync(`git clone ${repoUrl} ${absSiteDir}`);
  }
  debug(`cloned ${repoUrl} to ${absSiteDir}`);
  return [`cloned ${repoUrl} to ${Path.join(type, owner, repo)}`];
}

module.exports = {getSiteData, updateSubdomain, createSite};
