/*
(base) PS1=17:36:41-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/createSite -d type=github -d owner=StaticFDP -d repo=Cotton
{"actions":["cloned http://github.com/StaticFDP/Cotton to github/StaticFDP/Cotton"]}
(base) PS1=16:54:56-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/updateSubdomain -d type=github -d owner=cotton -d repo=Cotton -d subdomain=cotton
{"actions":["linked cotton to github/StaticFDP/Cotton"]}
*/
const Fs = require('fs');
const Path = require('path');
const Cp = require('child_process');
const debug = require('debug')('test:LdHostManager-curl');
const {ExpectProcessOutput} = require('./ExpectProcessOutput');
const {createSite, deleteSite, updateSubdomain, deleteSubdomain} = require('../client/LdHostManager-client');


let ServerPort = null;
let time = new Date();
const ConfigPath = './test/LdHost-test.config.json';
const Config = JSON.parse(Fs.readFileSync(ConfigPath));
const Server = new ExpectProcessOutput(Cp.spawn(
  './runLdHostManager.js',
  ['3002', ConfigPath],
  {env: {'DEBUG': '*', 'PATH': process.env.PATH}}
), debug);

beforeAll(async () => {
  const m = await Server.expectErr(/(backend:server Listening on port (\d+).*\n)/);
  ServerPort = parseInt(m[2]);
});

afterAll(async function () {
  await Server.process.kill(); // just to be sure
});

function stamp () {
  const t2 = new Date();
  const ret = t2 - time;
  time = t2;
  return '+' + ret + 'ms';
}

describe('LdHostManager', () => {
  it('should start', async () => {
    expect(ServerPort).toEqual(3002);
  });

  it('should GET sites', async () => {
    const curl = Cp.spawnSync(
      'curl',
      [
        "-X", "GET",
        "-s", `http://localhost:${ServerPort}/sites`
      ],
      { encoding : 'utf8' }
    );
    const res = JSON.parse(curl.stdout);
    const repoPath = 'github/StaticFDP/wikidata';
    expect(res.subdomains.sort(
      (l, r) => l.DocumentRoot.localeCompare(r.DocumentRoot)
    )).toEqual( [ {
    //   "DocumentRoot": "/home/fdpCloud/sites/github/StaticFDP/FlashCard1",
    //   "ServerName": "flashcard1.fdpcloud.org",
    // }, {
      "DocumentRoot": repoPath,
      "ServerName": `wikidata.${Config.domain}`,
    } ] );
    expect(res.sites.sort((l, r) => l.repo.localeCompare(r))).toEqual(
      [
        { "dateTime": "0000-01-01T00:00:00.000Z",
          "hash": "ENOENT: no such file or directory, scandir 'github/BrokenOwner/BrokenRepo/.git'",
          "owner": "BrokenOwner",
          "repo": "BrokenRepo",
          "sitePath": "github/BrokenOwner/BrokenRepo",
          "type": "github",
          "who": "I'm broken!!!" },
        { "dateTime": "2023-09-15T15:24:22.000Z",
          "hash": "3285971ea73195c7940519c55652530392c651bb",
          "owner": "StaticFDP",
          "repo": "FlashCard1",
          "sitePath": "github/StaticFDP/FlashCard1",
          "type": "github",
          "who": "andrawaag" },
        { "dateTime": "2023-09-15T08:09:50.000Z",
          "hash": "882a283c7baf83030f2ab697a4edf1eb5db6420b",
          "owner": "StaticFDP",
          "repo": "wikidata",
          "sitePath": repoPath,
          "subdomain": "wikidata",
          "type": "github",
          "who": "Eric Prud'hommeaux" }
      ] );
    expect(curl.stderr).toEqual("");
    expect(curl.status).toEqual(0);
    const serverLog = (await Server.expectOut(/^(.*wikidata.*)$/s))[0];
    expect(serverLog).toEqual(`{ '${repoPath}': 'wikidata' }\n`);
  });

  it('should call createSite', async () => {
    await testCreateSite("github", "StaticFDP", "Cotton");
  });

  it('should call updateSubdomain', async () => {
    await testUpdateSubdomain("github", "StaticFDP", "Cotton", "cotton");
  });

  it('should call deleteSubdomain', async () => {
    await testDeleteSubdomain("cotton");
  });

  it('should call deleteSite', async () => {
    await testDeleteSite("github", "StaticFDP", "Cotton");
  });

  it('should end', async () => {
    Server.process.kill('SIGINT');
    expect(await Server.isDone()).toEqual(2);
  });
});

async function curlFetch (url, opts) {
  const method = opts.method || 'GET';
  const args =     [
    "-X", method,
    "-s", url,
    "-i",
    // "--trace-ascii", "/tmp/toy/curlout.log",
  ];
  if (opts.headers)
    Array.prototype.push.apply(args, [...new Headers(opts.headers)].map(
      ([key, value]) => ['-H', `${key}=${value}`]
    ).flat())

  if (opts.body) {
    args.push('--data-raw');
    args.push(opts.body);
  }

  const curl = Cp.spawnSync('curl', args);
  if (curl.stderr.length > 0) {
    throw Error(curl.stderr.toString());
  }
  // parse stdout
  const stdout = curl.stdout.toString();
  const iBody = stdout.indexOf('\r\n\r\n');
  const headerLines = stdout.substring(0, iBody).split("\r\n");
  const statusLine = headerLines.shift();
  const mStatus = statusLine.match(/ (\d+)(?: (.*))?/);
  const lz = headerLines.map(h => {
    const iColon = h.indexOf(':');
    const attr = h.substring(0, iColon);
    const value = h.substring(iColon+2);
    return [attr, value];
  });
  const headers = new Headers(lz);
  const status = parseInt(mStatus[1]);
  const ok = ['2', '3'].indexOf(mStatus[1][0]) !== -1;
  const statusText = mStatus[2]
  const body = stdout.substring(iBody+2)
  const text = () => Promise.resolve(body);
  const json = () => Promise.resolve(JSON.parse(body));
  return Promise.resolve(
    { ok, status, statusText, text, json }
  );
}

fetch = curlFetch;

async function testCreateSite (type, owner, repo) {
  // const {status, text} = await oldCurl(type, owner, repo);
  const manager = `http://localhost:${ServerPort}/createSite`;
  const {status, result} = await createSite(manager, type, owner, repo);
  const created = Path.join(type, owner, repo);
  expect(result).toEqual(
    {"actions":[
      `cloned http://${type}.com/${owner}/${repo} to ${created}`
    ]}
  );
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(cloned [^ ]+ to [^ ]+\n)/))[0]).toMatch(/cloned [^ ]+ to [^ ]+\n/);
  // Don't clean up 'cause we'll need this in the deleteSite test.
}

async function testDeleteSite (type, owner, repo) {
  const manager = `http://localhost:${ServerPort}/deleteSite`;
  const {status, result} = await deleteSite(manager, type, owner, repo);
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(deleted.*\n)/))[0]).toEqual('deleted test/root/home/fdpCloud/sites/Cotton\n');
}

async function testUpdateSubdomain (type, owner, repo, subdomain) {
  const manager = `http://localhost:${ServerPort}/updateSubdomain`;
  const {status, result} = await updateSubdomain(manager, type, owner, repo, subdomain);
  const created = Path.join(type, owner, repo);
  expect(result).toEqual(
    {"actions":[
      `linked cotton to ${created}`
    ]}
  );
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(linked [^ ]+ to [^ ]+\n)/))[0]).toMatch(/linked [^ ]+ to [^ ]+\n/);
  // Don't clean up 'cause we'll need this in the deleteSubdomain test.
}

async function testDeleteSubdomain (subdomain) {
  const manager = `http://localhost:${ServerPort}/deleteSubdomain`;
  const {status, result} = await deleteSubdomain(manager, subdomain);
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(deleted.*\n)/))[0]).toEqual('deleted test/root/etc/apache2/sites-available/subdomains.d/cotton\n');
}

async function oldCurl (type, owner, repo) {
  const curl = Cp.spawnSync(
    'curl',
    [
      "-X", "POST",
      "-s", `http://localhost:${ServerPort}/createSite`,
      "-d", `type=${type}`,
      "-d", `owner=${owner}`,
      "-d", `repo=${repo}`
    ]
  );
  const errOut = curl.stderr.toString();
  if (errOut.length > 0)
    throw Error(errOut);
  return {status: curl.status === 0 ? 200 : 500, text: curl.stdout};
}

/*
  scratchpad

  delete a file with spawn:
    const rm = Cp.spawnSync('rm', ["-rf", created]);

  delete a file with fs.rm
    await Fs.promises.rm(Path.join(Config.root, Config.repoDir, created), { recursive: true });

*/
