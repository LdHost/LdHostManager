const Fs = require('fs');
const Path = require('path');

async function getSubdomainData (root, subdomainDir) {
  return [{
    ServerName: "wikidata.fdpcloud.org",
    DocumentRoot: "/home/fdpCloud/sites/github/StaticFDP/wikidata",
  }];
}

module.exports = {getSubdomainData};
