/*
(base) PS1=17:36:41-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/createSite -d type=github -d org=StaticFDP -d repo=Cotton
{"actions":["cloned http://github.com/StaticFDP/Cotton to github/StaticFDP/Cotton"]}
(base) PS1=16:54:56-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/updateSubdomain -d type=github -d org=cotton -d repo=Cotton -d subdomain=cotton
{"actions":["linked cotton to github/StaticFDP/Cotton"]}
*/
const Fs = require('fs');
const Path = require('path');
const Cp = require('child_process');
const debug = require('debug')('test:LdHostManager-curl');
const {ExpectProcessOutput} = require('./ExpectProcessOutput');
let ServerPort = null;
let time = new Date();
const Server = new ExpectProcessOutput(Cp.spawn(
  './runLdHostManager.js',
  ['3002', './test/LdHost-test.config.json'],
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
    expect(res.subdomains).toEqual( [ {
        "DocumentRoot": "/home/fdpCloud/sites/github/StaticFDP/wikidata",
        "ServerName": "wikidata.fdpcloud.org",
    } ] );
    expect(res.sites.sort((l, r) => l.repo.localeCompare(r))).toEqual(
      [
        { "dateTime": "2023-09-15T15:24:22.000Z",
          "hash": "3285971ea73195c7940519c55652530392c651bb",
          "org": "StaticFDP",
          "repo": "FlashCard1",
          "sitePath": "github/StaticFDP/FlashCard1",
          "type": "github",
          "who": "GitHub" },
        { "dateTime": "2023-09-15T08:09:50.000Z",
          "hash": "882a283c7baf83030f2ab697a4edf1eb5db6420b",
          "org": "StaticFDP",
          "repo": "wikidata",
          "sitePath": "github/StaticFDP/wikidata",
          "subdomain": "wikidata",
          "type": "github",
          "who": "Eric Prud'hommeaux" }
      ] );
    expect(curl.stderr).toEqual("");
    expect(curl.status).toEqual(0);
    const serverLog = (await Server.expectOut(/^(.*wikidata.*)$/s))[0];
    expect(serverLog).toEqual("{ 'github/StaticFDP/wikidata': 'wikidata' }\n");
  });

  it('should call createSite', async () => {
    const curl = Cp.spawnSync(
      'curl',
      [
        "-X", "POST",
        "-s", `http://localhost:${ServerPort}/createSite`,
        "-d", "type=github",
        "-d", "org=StaticFDP",
        "-d", "repo=Cotton"
      ]
    );
    expect(JSON.parse(curl.stdout)).toEqual(
      {"actions":[
        "cloned http://github.com/StaticFDP/Cotton to github/StaticFDP/Cotton"
      ]}
    );
    expect(curl.stderr.toString()).toEqual('');
    expect(curl.status).toEqual(0);
    expect((await Server.expectErr(/(cloned [^ ]+ to [^ ]+\n)/))[0]).toMatch(/cloned [^ ]+ to [^ ]+\n/);
    const repo = Path.join(__dirname, "root/home/fdpCloud/sites/github/StaticFDP/Cotton");
    console.log(await Fs.promises.unlink(repo));
  });

  it('should end', async () => {
    Server.process.kill('SIGINT');
    expect(await Server.isDone()).toEqual(2);
  });
});

