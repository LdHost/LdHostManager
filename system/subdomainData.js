const Fs = require('fs');
const Path = require('path');

async function getSubdomainData (debug, root, repoDir, subdomainDir) {
  const absSubdomainDir = Path.join(root, subdomainDir);
  let absRepoDir = Path.join(root, repoDir);
  if (!absRepoDir.endsWith('/'))
    absRepoDir += '/';
  const subdomains = []
  for (const subdomain of Fs.readdirSync(absSubdomainDir, { withFileTypes: true })) {
    const filePath = Path.join(absSubdomainDir, subdomain.name);
    const text = await Fs.promises.readFile(filePath, 'utf-8');

    const errors = [];
    let ServerName = '???';
    const mServerName = text.match(/ServerName\s+([a-z0-9.|-]+)/sm);
    if (mServerName) {
      ServerName = mServerName[1];
    } else {
      debug(`no ServerName found in ${subdomain.name}`);
      errors.push(`no ServerName found in ${subdomain.name}`);
    }

    let DocumentRoot = '???';
    const mDocumentRoot = text.match(/DocumentRoot\s+([a-z0-9A-Z./]+)/sm);
    if (mDocumentRoot) {
      DocumentRoot = mDocumentRoot[1];
      if (DocumentRoot.startsWith(absRepoDir)) {
        DocumentRoot = DocumentRoot.substring(absRepoDir.length)
      } else {
        debug(`in ${filePath}, DocumentRoot ${DocumentRoot} is not in repository domain ${absRepoDir}`);
        errors.push(`DocumentRoot not in repository domain`);
        DocumentRoot = '!!!';
      }
    } else {
      debug(`no DocumentRoot found in ${subdomain.name}`);
      errors.push(`no DocumentRoot found in ${subdomain.name}`);
    }


    // const warnings = [];
    subdomains.push(Object.assign(
      {ServerName, DocumentRoot},
      errors.length ? {errors} : {}
    ));
  }
  return subdomains;
  // e.g. [{ ServerName: "wikidata.fdpcloud.org", DocumentRoot: "github/StaticFDP/wikidata" }];
  // or [{ ServerName: "wikidata.fdpcloud.org", DocumentRoot: "github/StaticFDP/wikidata" }];
}

module.exports = {getSubdomainData};
