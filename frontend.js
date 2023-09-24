const repo = 'repo';
const text = 'text';
const commit = 'commit';

const Host = 'localhost';
const Port = '3002';

async function addElements (addHere) {
  const manager = new URL('sites', Config.manager);
  let result = null;
  try {
    const resp = await fetch(manager);
    const text = await resp.text();
    if (!resp.ok)
      throw Error(text);
    result = JSON.parse(text);
  } catch (e) {
    appendTr(addHere, `Error loading sites from <${manager}>: ` + e.message, 'error', 3);
  }

  result.subdomains.forEach((subd) => {
    if (subd.errors) {
      appendTr(addHere, `Subdomain problem ${subd.ServerName} -> <${subd.DocumentRoot}>: ${subd.errors.join("\n")}`, 'error', 3);
    }
  });

  result.sites.forEach(site => addHere.append(renderRow(site)));
}

function renderRow (site) {
  const ret = document.createElement('tr');
  const [date, time] = new Date(site.dateTime).toISOString().split('T');
  ret.innerHTML = `
      <td class="repo"><button onclick="invokeDeleteSite(this)">⌫</button> ${site.type}</td>
      <td class="repo">${site.owner}</td>
      <td class="repo">
        <a href="http://github.com/${site.owner}${site.repo}">${site.repo}</a>
      </td>
      <td>${renderSubdomain(site.type, site.owner, site.repo, site.subdomain)}
      </td>
      <td class="commit">${date}<br/>${time}</td>
      <td class="commit">${site.who}</td>
      <td class="commit">${site.hash}</td>
      <td><a href="http://${Config.domain}/home/fdpCloud/sites/${site.type}/${site.owner}/${site.repo}">explore</a></td>
`;
  return ret;
}

function renderSubdomain (type, owner, repo, subdomain) {
  return !subdomain
    ? `          <input type="text"
             placeholder="${repo.toLowerCase()}"
             onchange="invokeUpdateSubdomain(this, '${type}', '${owner}', '${repo}', this.value)"
          ></input>`
    : `<a href="${subdomain}.${Config.domain}">${subdomain}</a> <button onclick="invokeDeleteSubdomain(this, this.previousElementSibling.text)">⌫</button>`;
}

async function invokeCreateSite (tr) {
  const [typeElt, ownerElt, repoElt, subdomainElt] =
        [...tr.querySelectorAll('input')]
  const [type, owner, repo, subdomain] =
        [typeElt, ownerElt, repoElt, subdomainElt]
        .map(elt => elt.value);

  // Check access to the repo
  let repoUrl = null;
  try {
    let repoData = null;
    switch (type) {
    case 'github':
      repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
      repoData = await getGithubRepo(repoUrl);
      appendTr(tr, 'remote: ' + JSON.stringify(repoData), 'progress', 4);
      break;
    default:
      throw Error(`unknown repo type: ${type}`);
    }
    appendTr(tr, `<${repoUrl}> appears to be a git repo`, 'progress', 3);    
  } catch (e) {
    appendTr(tr, `<${repoUrl}> failed: ` + e.message, 'error', 3);    
    return;
  }

  // Mirror the repo
  const manager = new URL('createSite', Config.manager).href;
  try {
    const {status, result} = await createSite(manager, type, owner, repo);
    if (status !== 200) {
      alert(`createSite(${manager}, ${type}, ${owner}, ${repo}) => ${status}`);
    } else {
      appendTr(tr, result.actions[0], 'success', 3);

      // Replace tr with a whole new row.
      const newSite = {type, owner, repo, subdomain: null,
                       dateTime: new Date("0000").toISOString(), who: '-', hash: '-'};
      const newTr = renderRow(newSite);
      const tBody = document.querySelector("#sites");
      tBody.append(newTr);

      if (subdomain)
        invokeUpdateSubdomain(newTr.querySelector('input'), type, owner, repo, subdomain);
    }
  } catch (e) {
    const text = `createSite(<${manager}>, "${type}", "${owner}", "${repo}", "${subdomain}") =>\n` + e.message
    appendTr(tr, text, 'error', 3);    
  }
}

async function invokeDeleteSite(tr) {
  const [typeElt, ownerElt, repoElt, subdomainElt] =
        [...tr.querySelectorAll('input')]
  const [type, owner, repo, subdomain] =
        [typeElt, ownerElt, repoElt, subdomainElt]
        .map(elt => elt.value);

  if (subdomain)
    invokeDeleteSubdomain(newTr.querySelector('input'), subdomain);

  // Mirror the repo
  const manager = new URL('deleteSite', Config.manager).href;
  try {
    const {status, result} = await deleteSite(manager, type, owner, repo);
    if (status !== 200) {
      alert(`deleteSite(${manager}, ${type}, ${owner}, ${repo}) => ${status}`);
    } else {
      appendTr(tr, result.actions[0], 'success', 3);

      // Delete this row.
      const tBody = document.querySelector("#sites");
      tBody.removeChild(tr);
    }
  } catch (e) {
    const text = `deleteSite(<${manager}>, "${type}", "${owner}", "${repo}", "${subdomain}") =>\n` + e.message
    appendTr(tr, text, 'error', 3);
  }
}

async function invokeUpdateSubdomain (input, type, owner, repo, subdomain) {
  const manager = new URL('updateSubdomain', Config.manager).href;
  try {
    const {status, result} = await updateSubdomain(manager, type, owner, repo, subdomain);
    if (status !== 200) {
      throw Error(`got status code ${status}`);
    } else {
      appendTr(input.parentNode.parentNode, result.actions[0], 'success', 3);

      // Replace input
      input.parentNode.innerHTML = renderSubdomain(type, owner, repo, subdomain);
    }
  } catch (e) {
    const text = `updateSubdomain(<${manager}>, "${type}", "${owner}", "${repo}", "${subdomain}") =>\n` + e.message
    appendTr(input.parentNode.parentNode, text, 'error', 3);    
  }
}

async function invokeDeleteSubdomain (input, type, owner, repo, subdomain) {
  const manager = new URL('deleteSubdomain', Config.manager).href;
  try {
    const {status, result} = await deleteSubdomain(manager, subdomain);
    if (status !== 200) {
      throw Error(`got status code ${status}`);
    } else {
      appendTr(input.parentNode.parentNode, result.actions[0], 'success', 3);

      // Replace input
      input.parentNode.innerHTML = renderSubdomain(type, owner, repo, null);
    }
  } catch (e) {
    const text = `deleteSubdomain(<${manager}>, "${type}", "${owner}", "${repo}", "${subdomain}") =>\n` + e.message
    appendTr(input.parentNode.parentNode, text, 'error', 3);
  }
}

function appendTr (afterMe, msg, className, colspan) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  document.querySelector('#messages').prepend(li);
  /*
  const th = document.createElement('td');
  th.className = className;
  th.setAttribute('colspan', colspan);
  th.innerText = msg;
  const tr = document.createElement('tr');
  tr.append(th);
  afterMe.after(tr);
  */
}

async function getGithubRepo (repoUrl) {
  const resp = await fetch(repoUrl, {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  if (!resp.ok)
    throw Error(await resp.text());
  const json = await(resp.json());
  const problems = [];
  if (json.archive)
    problems.push(`GitHub repo ${json.full_name} is archived.`);
  if (!json.permissions || json.permissions.indexOf("pull") === -1)
    problems.push(`No pull access to GitHub repo ${json.full_name}.`);
  if (json.visibility !== "public")
    problems.push(`GitHub repo ${json.full_name} is not public.`);
  return problems.length === 0
    ? {
      id: json.id,
      lastUpdate: json['updated_at'],
      topics: json.topics,
    } : {
      problems
    };
}
