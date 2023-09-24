const NodeGit = require( 'nodegit' );
const Fs = require('fs');
const Path = require('path');
const Cp = require('child_process');

async function getSiteData (root, repoDir, subdomains) {
  const errors = [];
  const sitePathToSubdomain = subdomains.reduce((acc, subd) => {
    let sitePath = subd.DocumentRoot;
    acc[sitePath] = subd.ServerName.split('.')[0];
    return acc;
  }, {});
  console.log(sitePathToSubdomain);

  const sites = []
  for (const type of Fs.readdirSync(Path.join(root, repoDir), { withFileTypes: true })) {
    const typeDir = Path.join(root, repoDir, type.name);
    for (const owner of Fs.readdirSync(typeDir, { withFileTypes: true })) {
      const orgDir = Path.join(typeDir, owner.name);
      for (const repo of Fs.readdirSync(orgDir, { withFileTypes: true })) {
        const repoPath = Path.join(orgDir, repo.name);
        const sitePath = type.name + '/' + owner.name + '/' + repo.name;
        const subdomain = sitePathToSubdomain[sitePath];
        const dotGitDir = Path.join(repoPath, ".git");
        try {
          Fs.readdirSync(dotGitDir, { withFileTypes: true }); // 1st pass at verifying that it's a git repo
          const repository = await NodeGit.Repository.open(repoPath);
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
        } catch (e) {
          sites.push({
            type: type.name,
            owner: owner.name,
            repo: repo.name,
            sitePath,
            subdomain,
            dateTime: new Date("0000"),
            who: "I'm broken!!!",
            hash: e.message.replace(new RegExp(Path.join(root, repoDir), "g"), ""),
          });
        }
      }
    }
  }
  return sites;
}

/**
 * early returns for errors
 */
function expectArgs (labeledArgs) {
  labeledArgs.forEach(arg => {
    if (!arg.value) throw Error(`missing ${arg.name}`);
  });
}
async function createSite (debug, root, type, owner, repo, repoDir) {
  expectArgs([
    {name: 'type', value: type},
    {name: 'owner', value: owner},
    {name: 'repo', value: repo},
  ]);

  let repoUrl = null;
  // let repoData = null;
  switch (type) {
  case 'github':
    repoUrl = `http://github.com/${Path.join(owner, repo)}`;
    // repoData = await getGithubRepo(repoUrl);
    // debug('remote: ' + JSON.stringify(repoData));
    break;
  default:
    throw Error(`unknown repo type: ${type}`);
  }

  const absSiteDir = await ensureRepoDir(debug, `${Path.join(root, repoDir)}`, type, owner, repo);
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

async function deleteSite (debug, root, type, owner, repo, repoDir) {
  expectArgs([
    {name: 'type', value: type},
    {name: 'owner', value: owner},
    {name: 'repo', value: repo},
  ]);

  const deleted = [];
  await Fs.promises.rm(Path.join(root, repoDir, type, owner, repo), { recursive: true });
  deleted.unshift(repo);
  if (Fs.readdirSync(Path.join(root, repoDir, type, owner)).length === 0) {
    await Fs.promises.rmdir(Path.join(root, repoDir, type, owner));
    deleted.unshift(owner);
    if (Fs.readdirSync(Path.join(root, repoDir, type)).length === 0) {
      await Fs.promises.rmdir(Path.join(root, repoDir, type));
      deleted.unshift(type);
    }
  }
  const deletedStr = Path.join.apply(null, deleted);
  debug(`deleted ${Path.join(root, repoDir, deletedStr)}`);
  return [`deleted ${deletedStr}`];
}

async function updateSubdomain (debug, root, type, owner, repo, subdomain, repoDir, subdomainDir) {
  const sitePath = Path.join(type, owner, repo);
  const absSiteDir = Path.join(root, repoDir, sitePath);
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

async function deleteSubdomain (debug, root, subdomain, repoDir, subdomainDir) {
  expectArgs([
    {name: 'root', value: root},
    {name: 'subdomain', value: subdomain},
    {name: 'repoDir', value: repoDir},
    {name: 'subdomainDir', value: subdomainDir},
  ]);

  const subdomainFilePath = Path.join(root, subdomainDir, subdomain);
  await Fs.promises.unlink(subdomainFilePath);

  debug(`deleted subdomainFilePath`);
  return [`deleted ${subdomain}`];
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

module.exports = {getSiteData, createSite, deleteSite, updateSubdomain, deleteSubdomain};
