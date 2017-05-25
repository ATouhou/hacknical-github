
import GitHubOrgs from './schema';

/**
 * private
 */
const getOrgInfo = orgInfo => ({
  login: orgInfo.login,
  name: orgInfo.name,
  avatar_url: orgInfo.avatar_url,
  company: orgInfo.company,
  blog: orgInfo.blog,
  location: orgInfo.location,
  email: orgInfo.email,
  description: orgInfo.description,
  created_at: orgInfo.created_at,
  updated_at: orgInfo.updated_at,
  public_repos: orgInfo.public_repos,
  public_gists: orgInfo.public_gists,
  followers: orgInfo.followers,
  following: orgInfo.following,
  html_url: orgInfo.html_url,
  type: orgInfo.type,
  repos: orgInfo.repos || []
});

const getReposInfo = repos => ({
  full_name: repos.full_name,
  name: repos.name,
  html_url: repos.html_url,
  description: repos.description,
  fork: repos.fork,
  created_at: repos.created_at,
  updated_at: repos.updated_at,
  pushed_at: repos.pushed_at,
  homepage: repos.homepage,
  size: repos.size,
  stargazers_count: repos.stargazers_count,
  watchers_count: repos.watchers_count,
  language: repos.language,
  languages: repos.languages,
  contributors: repos.contributors,
  forks_count: repos.forks_count,
  forks: repos.forks,
  watchers: repos.watchers
});

/* === API === */

const findOrgByLogin = async login => await GitHubOrgs.findOne({ login });

const findOrgsByLogin = async logins => await GitHubOrgs.find({
  login: {
    $in: logins
  }
});

const updateOrg = async (login) => {

};

const updateOrgRepos = async (login, repos) => {
  const findOrg = await findOrgByLogin(login);
  if (!findOrg) {
    return Promise.resolve({
      success: false
    });
  }
  const newRepos = repos.map(repository => getReposInfo(repository));
  findOrg.repos = [...newRepos];
  await findOrg.save();
  return Promise.resolve({
    success: true,
    result: findOrg
  });
};

const createOrg = async (orgInfo) => {
  const newOrgInfo = getOrgInfo(orgInfo);
  const { login, repos } = newOrgInfo;
  const newRepos = repos.map(repository => getReposInfo(repository));
  newOrgInfo.repos = newRepos;

  let findOrg = await findOrgByLogin(login);
  if (findOrg) {
    Object.assign(findOrg, newOrgInfo);
    await findOrg.save();
    return Promise.resolve({
      success: true,
      result: findOrg
    });
  }
  const newOrg = await GitHubOrgs.create(newOrgInfo);
  return Promise.resolve({
    success: true,
    result: newOrg
  });
};

export default {
  find: findOrgByLogin,
  findMany: findOrgsByLogin,
  create: createOrg,
  update: updateOrg,
  updateRepos: updateOrgRepos
};
