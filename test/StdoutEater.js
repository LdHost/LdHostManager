/**
 * test a process's stdout. handy for servers.
 * Taken from shex.js
 */


class PromiseKeeper {
  constructor () {
    this.promise = new Promise((accept, reject) => {
      this.accept = accept;
      this.reject = reject;
    });
  }

  isDone () { return this.promise; }
}

class Expecter extends PromiseKeeper {
  constructor (pattern) {
    super();
    this.pattern = pattern;
  }

  isDone () { return this.promise; }
}

/**
 * Wrap a running ChildProcess to collect stdout.
 */
class StdoutEater {
  /**
   * build StdoutEater from running process
   * @param process ChildProcess already started with e.g. child_process.spawn
   */
  constructor (process) {
    // public:
    this.process = process;
    this.process.stdout.on('data', this.handleStdout.bind(this));
    this.process.stderr.on('data', this.handleStderr.bind(this));;
    this.process.on('exit', this.handleExit.bind(this));
    this.stdout = '';
    this.eaters = [];

    // private:
    this._promiseKeeper = new PromiseKeeper();
  }

  // public API

  /**
   * Test if process promise has resolved (accepted).
   */
  isDone () { return this._promiseKeeper.isDone(); }

  /**
   * Test if pattern was matched in the process's stdout.
   */
  expectOut (pattern) {
    const m = this.stdout.match(pattern);
    if (m) {

      // stdout already matches
      this.stdout = this.stdout.substring(m.index + m[0].length)
      return Promise.resolve(m);
    } else {

      // make a promise to resolve when stdout matches
      const expecter = new Expecter(pattern);
      expecter.promise = new Promise((accept, reject) => {
        expecter.accept = accept;
        expecter.reject = reject;
      });
      this.eaters.push(expecter);
      return expecter.promise;
    }
  }

  accept (result) { this._promiseKeeper.accept(result); }
  reject (result) { this._promiseKeeper.reject(result); }

  handleStdout (data) {
    this.stdout += data.toString();
    // for (let iEater in this.eaters) ... works but is it specified?
    for (let iEater = 0; iEater < this.eaters.length; ++iEater) {
      const expecter = this.eaters[iEater];
      const m = this.stdout.match(expecter.pattern);
      if (m) {
        this.stdout = this.stdout.substring(m.index + m[0].length)
        this.eaters.splice(iEater--, 1);
        expecter.accept(m);
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

}

module.exports = {StdoutEater}
