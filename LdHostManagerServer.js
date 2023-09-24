#!/usr/bin/env node

const debug = require('debug')('backend:server');
const {createServer} = require('http');
const {parse} = require('querystring');
const Fs = require('fs');

const {getSubdomainData} = require('./system/subdomainData');
const {getSiteData, createSite, deleteSite, updateSubdomain, deleteSubdomain} = require('./system/siteData');

class LdHostManagementServer {
  static FormUrlencoded = 'application/x-www-form-urlencoded';
  constructor (portParam, configPath) {
    this.port = this.normalizePort(portParam);
    this.configPath = configPath;
  }

  /**
   * launch server
   */
  async start () {
    // const config = require(this.configPath);
    const config = JSON.parse(await Fs.promises.readFile(this.configPath, 'utf-8'));
    this.domain = config.domain;
    this.root = config.root;
    this.repoDir = config.repoDir;
    this.subdomainDir = config.subdomainDir;

    this.server = createServer(this.requestHandler.bind(this));

    // listen on all network interfaces
    this.server.listen(this.port);
    this.server.on('error', this.onError);
    this.server.on('listening', this.onListening.bind(this));
  }

  /**
   * Event listener for HTTP server "listening" event.
   */
  onListening () {
    const addr = this.server.address();
    const bind = typeof addr === 'string'
          ? 'pipe ' + addr
          : 'port ' + addr.port;
    debug('Listening on ' + bind);
  }

  /**
   * generic http module request handler
   */
  async requestHandler (req, res) {
    // Hand CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if ( req.method === 'OPTIONS' ) {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, 'https://example.com');
    const path = url.pathname; // it's NOT a URL!
    let status = 200;
    let payload = null;
    try {
      switch (path) {

      case '/':
        payload = { path: path, status: "OK" };
        break;

      case '/sites':
        const subdomains = await getSubdomainData(debug, this.root, this.repoDir, this.subdomainDir);
        const sites = await getSiteData(this.root, this.repoDir, subdomains);
        payload = { subdomains, sites };
        break;

      case '/createSite':
      case '/updateSubdomain':
        {
          if (req.method !== "POST")
            throw Error(`${path} is a POST method`);
          const searchParams = await this.parseBody(req, url.searchParams);

          switch (path) {

          case '/createSite':
            {
              const {type, owner, repo} = this.expectAll(searchParams, 'type', 'owner', 'repo');
              payload = {
                actions: await createSite(debug, this.root, type, owner, repo, this.repoDir)
              };
            }
            break;

          case '/updateSubdomain':
            {
              const {type, owner, repo, subdomain} = this.expectAll(searchParams, 'type', 'owner', 'repo', 'subdomain');
              payload = {
                actions: await updateSubdomain(debug, this.root, type, owner, repo, subdomain, this.repoDir, this.subdomainDir)
              };
            }
            break;

          }
        }
        break;

      case '/deleteSite':
      case '/deleteSubdomain':
        {
          if (req.method !== "POST")
            throw Error(`${path} is a POST method`);
          const searchParams = await this.parseBody(req, url.searchParams);

          switch (path) {

          case '/deleteSite':
            {
              const {type, owner, repo} = this.expectAll(searchParams, 'type', 'owner', 'repo');
              payload = {
                actions: await deleteSite(debug, this.root, type, owner, repo, this.repoDir)
              };
            }
            break;

          case '/deleteSubdomain':
            {
              const {subdomain} = this.expectAll(searchParams, 'subdomain');
              payload = {
                actions: await deleteSubdomain(debug, this.root, subdomain, this.repoDir, this.subdomainDir)
              };
            }
            break;

          }
          break;
        }

      default:
        status = 404;
        payload = { path, status: "not found" };
      }
    } catch (error) {
      debug(error.message);
      status = 500;
      payload = {type: "error", error: error.message.replace(new RegExp(this.root, "g"), ""), stack: error.stack};
    }
    res.writeHead(status, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(payload));
    res.end('\n');
  }

  /**
   *
   */
  async parseBody (req, searchParams) {
    if(req.headers['content-type'] !== LdHostManagementServer.FormUrlencoded)
      return Promise.resolve(searchParams);
    const params = parse(await this.getBody(req));
    for (const [key, value] of Object.entries(params))
      searchParams.set(key, value);
    return searchParams;
  }

  /**
   *
   */
  expectAll (searchParams, ...labels) {
    return labels.reduce((acc, label) => {
      const value = searchParams.get(label);
      if (!value)
               throw Error(`expected a ${label} parameter`);
      acc[label] = value;
      return acc;
    }, {});
  }

  /**
   * Get the HTTP message body
   */
  getBody (req) {
    return new Promise((accept, reject) => {
      const parts = []
      req.on('data', data => parts.push(data));
      req.on('error', (error) => reject(error));
      req.on('end', () => accept(parts.join('')));
    });
  }

  /**
   * Normalize a port into a number, string, or false.
   */
  normalizePort (val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

  /**
   * Event listener for HTTP server "error" event.
   */
  onError (error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    var bind = typeof this.port === 'string'
        ? 'Pipe ' + this.port
        : 'Port ' + this.port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
    }
  }

}

module.exports = {LdHostManagementServer};
