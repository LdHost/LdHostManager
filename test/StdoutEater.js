const Cp = require('child_process');
class StdoutEater {
  constructor () {
    this.process = null;
    this.promise = null;
    this.stdout = '';
    this.eaters = [];
  }

  async init (script, args, env) {
    this.promise = new Promise((accept, reject) => {
      this.process = Cp.spawn(script, args, env);
      this.process.stdout.on('data', this.handleStdout.bind(this, accept, reject));
      this.process.stderr.on('data', this.handleStderr.bind(this, accept, reject));;
      this.process.on('exit', this.handleExit.bind(this, accept, reject));
    });
  }

  handleStdout (accept, reject, data) {
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

  handleStderr (accept, reject, data) {
    reject(data.toString());
  }

  handleExit (accept, reject, code) {
    if (this.stdout.length)
      reject(this.stdout);
    accept(code);
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
