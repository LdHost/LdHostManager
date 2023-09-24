async function fetchMethod (method, url, args) {
  const headers = new Headers([
    ['Content-Type', 'application/x-www-form-urlencoded'],
    ['accept', 'application/json'],
  ]);
  const body = new URLSearchParams(args);
  /* using curlFetch to bypass this warning:
   *   (node:944752) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
   *   (Use `node --trace-warnings ...` to show where the warning was created)
   */
  const resp = await fetch(url, { method, headers, body }); // or curlFetch
  const status = resp.status;
  const text = await resp.text();
  if (!resp.ok) {
    throw Error(text);
  }
  return {status, result: JSON.parse(text)};
  // return oldCurl(args.type, args.owner, args.repo);
}

async function createSite (manager, type, owner, repo) {
  return await fetchMethod('POST', manager, {type, owner, repo});
}

async function updateSubdomain (manager, type, owner, repo, subdomain) {
  return await fetchMethod('POST', manager, {type, owner, repo, subdomain});
}

async function deleteSite (manager, type, owner, repo) {
  return await fetchMethod('DELETE', manager, {type, owner, repo});
}

async function deleteSubdomain (manager, subdomain) {
  return await fetchMethod('DELETE', manager, {subdomain});
}

if (typeof module !== 'undefined')
  module.exports = {createSite, updateSubdomain, deleteSubdomain, deleteSite};
