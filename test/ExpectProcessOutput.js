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
}

class Listen {
  constructor (label) {
    this.label = label;
    this.text = '';
    this.expecters = [];
  }

  handleData (data) {
    this.text += data.toString();
    // for (let iExp in this.expecters) ... works but is it specified?
    for (let iExp = 0; iExp < this.expecters.length; ++iExp) {
      const expecter = this.expecters[iExp];
      const m = this.text.match(expecter.pattern);
      if (m) {
        this.text = this.text.substring(m.index + m[0].length)
        this.expecters.splice(iExp--, 1);
        expecter.accept(m);
      }
    }
  }

  expectData (pattern) {
    const m = this.text.match(pattern);
    if (m) {

      // stdout already matches
      this.text = this.text.substring(m.index + m[0].length)
      return Promise.resolve(m);
    } else {

      // make a promise to resolve when stdout matches
      const expecter = new Expecter(pattern);
      expecter.promise = new Promise((accept, reject) => {
        expecter.accept = accept;
        expecter.reject = reject;
      });
      this.expecters.push(expecter);
      return expecter.promise;
    }
  }

  expectEmpty () {
    if (this.text.length)
      this.reject(`${this.label} expected to be empty. has ${this.text}`);
  }
}

/**
 * Wrap a running ChildProcess to collect stdout.
 */
class ExpectProcessOutput {
  /**
   * build ExpectProcessOutput from running process
   * @param process ChildProcess already started with e.g. child_process.spawn
   */
  constructor (process) {
    // public:
    this.process = process;
    this.listeners = {
      stdout: new Listen('stdout'),
      stderr: new Listen('stderr'),
    };

    // private:
    this._promiseKeeper = new PromiseKeeper();

    // set up handlers
    this.process.stdout.on('data', this.handleStdout.bind(this));
    this.process.stderr.on('data', this.handleStderr.bind(this));;
    this.process.on('exit', this.handleExit.bind(this));
  }

  // public API

  /**
   * Test if process promise has resolved (accepted).
   */
  isDone () { return this._promiseKeeper.isDone(); }

  /**
   * Test if pattern was matched in the process's stdout.
   */
  expectOut (pattern) { return this.listeners.stdout.expectData(pattern); }
  expectErr (pattern) { return this.listeners.stderr.expectData(pattern); }

  accept (result) { this._promiseKeeper.accept(result); }
  reject (result) { this._promiseKeeper.reject(result); }

  // extension API - handlers for stdout, stderr and exit
  handleStdout (data) { return this.listeners.stdout.handleData(data); }
  handleStderr (data) { return this.listeners.stderr.handleData(data); }

  handleExit (code) {
    this.listeners.stdout.expectEmpty();
    this.listeners.stderr.expectEmpty();
    this.accept(code);
  }
}

function wait (milliseconds) {
  return new Promise((accept, reject) => {
    setTimeout(() => accept(milliseconds), milliseconds);
  });
}

module.exports = {ExpectProcessOutput}
