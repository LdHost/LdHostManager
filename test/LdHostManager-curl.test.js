/*
(base) PS1=17:36:41-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/createSite -d type=github -d org=StaticFDP -d repo=Cotton
{"actions":["cloned http://github.com/StaticFDP/Cotton to github/StaticFDP/Cotton"]}
(base) PS1=16:54:56-eric@touchy:/tmp/toy/vue-js-client-crud$ curl -X POST -s http://localhost:3001/updateSubdomain -d type=github -d org=cotton -d repo=Cotton -d subdomain=cotton
{"actions":["linked cotton to github/StaticFDP/Cotton"]}
*/
const {StdoutEater} = require('./StdoutEater');
let ServerPort = null;
let time = new Date();
const Server = new StdoutEater();

beforeAll(async () => {
  await Server.init(
    './runLdHostManager-toy.js',
    ['3002', './LdHost-test.config.json'],
    {env: {'DEBUG': '*'}}
  );

  const m = await Server.eat(/^(  backend:server Listening on port (\d+) \+\d+ms)\n/);
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

  it('should see', async () => {
    expect((await Server.eat(/more stuff\n/))[0]).toEqual('more stuff\n');
  });

  it('should end', async () => {
    Server.process.kill('SIGINT');
    expect(await Server.done()).toEqual(2);
  });
});

// This script exits much quicker
