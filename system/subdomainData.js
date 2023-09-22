const Fs = require('fs');
const Path = require('path');

async function getSubdomainData (root, subdomainDir) {
  const absSubdomainDir = Path.join(root, subdomainDir);
  const subdomains = []
  for (const subdomain of Fs.readdirSync(absSubdomainDir, { withFileTypes: true })) {
    const filePath = Path.join(absSubdomainDir, subdomain.name);
    const text = await Fs.promises.readFile(filePath, 'utf-8');

    const mServerName = text.match(/ServerName\s+([a-z0-9.]+)/sm);
    if (!mServerName)
      throw Error(`no ServerName found in ${subdomain.name}`);
    const ServerName = mServerName[1];

    const mDocumentRoot = text.match(/DocumentRoot\s+([a-z0-9A-Z./]+)/sm);
    if (!mDocumentRoot)
      throw Error(`no DocumentRoot found in ${subdomain.name}`);
    const DocumentRoot = mDocumentRoot[1];

    // const warnings = [];
    subdomains.push({ServerName, DocumentRoot});
  }
  return subdomains
  // return [{
  //   ServerName: "wikidata.fdpcloud.org",
  //   DocumentRoot: "/home/fdpCloud/sites/github/StaticFDP/wikidata",
  // }];
}

module.exports = {getSubdomainData};
