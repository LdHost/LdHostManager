/**
 * test a process's stdout. handy for servers.
 * Taken from shex.js
 */

const Cp = require('child_process');

class PromiseKeeper {
  constructor () {
    this.promise = new Promise((accept, reject) => {
      this.accept = accept;
      this.reject = reject;
    });
  }

  done () { return this.promise; }
}

class StdoutEater {
  constructor () {
    // public:
    this.process = null;
    this.stdout = '';
    this.eaters = [];

    // private:
    this._promiseKeeper = null;
  }

  async init (script, args, env) {
    this._promiseKeeper = new PromiseKeeper();
    this.process = Cp.spawn(script, args, env);
    this.process.stdout.on('data', this.handleStdout.bind(this));
    this.process.stderr.on('data', this.handleStderr.bind(this));;
    this.process.on('exit', this.handleExit.bind(this));
  }

  done () { return this._promiseKeeper.done(); }
  accept (result) { this._promiseKeeper.accept(result); }
  reject (result) { this._promiseKeeper.reject(result); }

  handleStdout (data) {
    this.stdout += data.toString();
    // for (let iEater in this.eaters) ... works but is it specified?
    for (let iEater = 0; iEater < this.eaters.length; ++iEater) {
      const eater = this.eaters[iEater];
      const m = this.stdout.match(eater.pattern);
      if (m) {
        this.stdout = this.stdout.substring(m.index + m[0].length)
        this.eaters.splice(iEater--, 1);
        eater.accept(m);
      }
    }
  }

  handleStderr (data) {
    this.reject(data.toString());
  }

  handleExit (code) {
    if (this.stdout.length)
      this.reject(this.stdout);
    this.accept(code);
  }

  eat (pattern) {
    const m = this.stdout.match(pattern);
    if (m) {
      this.stdout = this.stdout.substring(m.index + m[0].length)
      return Promise.resolve(m);
    } else {
      const eater = {
        pattern,
        accept: null,
        reject: null,
        promise: null,
      };
      eater.promise = new Promise((accept, reject) => {
        eater.accept = accept;
        eater.reject = reject;
      });
      this.eaters.push(eater);
      return eater.promise;
    }
  }
}

module.exports = {StdoutEater}
