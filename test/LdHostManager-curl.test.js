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
    expect(res.subdomains).toEqual( [ {
      "DocumentRoot": '/' + Path.join(Config.repoDir, repoPath),
      "ServerName": `wikidata.${Config.domain}`,
    } ] );
    expect(res.sites.sort((l, r) => l.repo.localeCompare(r))).toEqual(
      [
        { "dateTime": "2023-09-15T15:24:22.000Z",
          "hash": "3285971ea73195c7940519c55652530392c651bb",
          "owner": "StaticFDP",
          "repo": "FlashCard1",
          "sitePath": "github/StaticFDP/FlashCard1",
          "type": "github",
          "who": "GitHub" },
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
    await createSite("github", "StaticFDP", "Cotton");
  });

  it('should call updateSubdomain', async () => {
    await updateSubdomain("github", "StaticFDP", "Cotton", "cotton");
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

async function fetchPost (url, args) {
  const method = 'POST';
  const headers = new Headers([
    ['Content-Type', 'application/x-www-form-urlencoded'],
    ['accept', 'application/json'],
  ]);
  const body = new URLSearchParams(args);
  /* using curlFetch to bypass this warning:
   *   (node:944752) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
   *   (Use `node --trace-warnings ...` to show where the warning was created)
   */
  const resp = await curlFetch(url, { method, headers, body }); // or curlFetch
  const status = resp.status;
  const text = await resp.text();
  if (!resp.ok)
    throw Error(text);
  return {status, text};
  // return oldCurl(args.type, args.owner, args.repo);
}

async function createSite (type, owner, repo) {
  // const {status, text} = await oldCurl(type, owner, repo);
  const {status, text} = await fetchPost(
    `http://localhost:${ServerPort}/createSite`,
    {type, owner, repo}
  );
  const created = Path.join(type, owner, repo);
  expect(JSON.parse(text)).toEqual(
    {"actions":[
      `cloned http://${type}.com/${owner}/${repo} to ${created}`
    ]}
  );
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(cloned [^ ]+ to [^ ]+\n)/))[0]).toMatch(/cloned [^ ]+ to [^ ]+\n/);
  /*
    const rm = Cp.spawnSync('rm', ["-rf", created]);
    console.log(process.cwd());
    console.log(rm.stdout.toString().length);
  */
  await Fs.promises.rm(Path.join(Config.root, Config.repoDir, created), { recursive: true });
}

async function updateSubdomain (type, owner, repo, subdomain) {
  const {status, text} = await fetchPost(
    `http://localhost:${ServerPort}/updateSubdomain`,
    { type, owner, repo, subdomain, }
  );
  const created = Path.join(type, owner, repo);
  expect(JSON.parse(text)).toEqual(
    {"actions":[
      `linked cotton to ${created}`
    ]}
  );
  expect(status).toEqual(200);
  // should log that it was cloned
  expect((await Server.expectErr(/(linked [^ ]+ to [^ ]+\n)/))[0]).toMatch(/linked [^ ]+ to [^ ]+\n/);
  /*
    const rm = Cp.spawnSync('rm', ["-rf", created]);
    console.log(process.cwd());
    console.log(rm.stdout.toString().length);
  */
  await Fs.promises.rm(Path.join(Config.root, Config.subdomainDir, subdomain), { recursive: true });
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
