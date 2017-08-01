import logger from '../../utils/logger';
import OrgsModel from '../../databases/github-orgs';
import ReposModel from '../../databases/github-repos';
import CommitsModel from '../../databases/github-commits';
import UsersModel from '../../databases/github-users';
import GitHubV3 from '../../services/github-v3';
import GitHubV4 from '../../services/github-v4';
import {
  PER_PAGE,
  sortByCommits,
  validateReposList,
} from '../../utils/github';

/* ================== private helper ================== */
const fetchRepository = async (fullname, verify, repos = {}) => {
  delete repos._id;

  const getReposResult = await GitHubV4.getRepository(fullname, verify);
  const repository = Object.assign({}, repos, getReposResult);
  const login = repository.owner.login;

  await ReposModel.setRepository(login, repository);
  return repository;
};

/**
 * =============== repos ===============
 */
const fetchRepos = async (options = {}) => {
  const {
    login,
    verify,
    perPage,
  } = options;

  const multiRepos =
    await GitHubV4.getPersonalPubRepos(login, verify, perPage);

  await ReposModel.setRepos(login, multiRepos);
  return multiRepos;
};

const fetchContributedRepos = async (options) => {
  const {
    login,
    verify,
    perPage,
  } = options;

  const multiRepos =
    await GitHubV4.getPersonalContributedRepos(login, verify, perPage);

  const userContributeds = multiRepos.filter(
    repository => repository.owner.login !== login
  );
  const contributions = userContributeds.map(
    repository => repository.full_name
  );

  await Promise.all(userContributeds.map(async (repository) => {
    const owner = repository.owner.login || repository.full_name.split('/')[0];
    await ReposModel.setRepository(owner, repository);
  }));

  await UsersModel.updateUserContributions(login, contributions);
  return userContributeds;
};

const getRepository = async (fullname, verify, required = []) => {
  const findResult = await ReposModel.getRepository(fullname);
  if (!findResult || required.some(key => !findResult[key] || !findResult[key].length)) {
    return await fetchRepository(fullname, verify, findResult || {});
  }
  return findResult;
};

const getRepos = async (login, verify) => {
  const findResult = await ReposModel.getRepos(login);
  if (findResult.length) {
    return findResult;
  }

  return await fetchRepos({
    login,
    verify,
    perPage: PER_PAGE.REPOS
  });
};

const getUserContributed = async (login, verify) => {
  const user = await getUser(login, verify);
  const { contributions } = user;
  if (!contributions || !contributions.length) {
    return await fetchContributedRepos({
      login,
      verify,
      perPage: PER_PAGE.REPOS
    });
  }
  const repos = [];

  await Promise.all(contributions.map(async (contribution) => {
    const fullname = contribution;
    const repository = await getRepository(fullname, verify);
    repos.push(repository);
  }));
  return repos;
};

const getUserPublicRepos = async (login, verify) =>
  await getRepos(login, verify);

const getUserContributedRepos = async (login, verify) =>
  await getUserContributed(login, verify);

const getUserStarred = async ({ login, verify, after, perPage = PER_PAGE.STARRED }) => {
  const result = await GitHubV4.getUserStarred({
    after,
    login,
    verify,
    first: perPage
  });
  const {
    results,
  } = result;

  await Promise.all(results.map(async (repository) => {
    const { owner } = repository;
    await ReposModel.setRepository(owner.login, repository);
  }));
  return result;
};

/**
 * =============== commits ===============
 */
const fetchCommits = async (login, verify) => {
  const repos = await getUserPublicRepos(login, verify);
  const reposList = validateReposList(repos);
  try {
    const fetchedResults =
      await GitHubV3.getAllReposYearlyCommits(reposList, verify);
    const results = fetchedResults.map((fetchedResult) => {
      const { full_name, data } = fetchedResult;
      const repository = reposList.find(
        item => item.full_name === full_name
      );
      if (!repository || !data.length) return {};
      const { name, created_at, pushed_at } = repository;
      const totalCommits = data.reduce(
        (pre, next, i) => (i === 0 ? 0 : pre) + next.total, 0
      );
      return {
        name,
        pushed_at,
        created_at,
        totalCommits,
        commits: data,
      };
    });
    const sortResult = sortByCommits(results);
    if (sortResult && sortResult.length) {
      await CommitsModel.setCommits(login, sortResult);
    }
    return sortResult;
  } catch (err) {
    logger.error(err);
    return [];
  }
};

const getCommits = async (login, verify) => {
  const findCommits = await CommitsModel.getCommits(login);
  if (findCommits.length) {
    return findCommits;
  }
  return await fetchCommits(login, verify);
};

/**
 * =============== orgs ===============
 */
const fetchOrgDetail = async (options = {}) => {
  const {
    orgLogin,
    verify,
    login = '',
  } = options;
  const org = await GitHubV3.getOrg(orgLogin, verify);
  if (!org.login) {
    return {};
  }

  const repos =
    await GitHubV4.getOrgPubRepos(orgLogin, verify, PER_PAGE.REPOS);

  // set repos contributors
  if (repos && repos.length) {
    try {
      // avoid tooo many repos in a organization
      const contributeds = await getUserContributedRepos(login, verify);

      const contributedsInOrg = repos.filter(
        repository => contributeds.find(item => item.full_name === repository.full_name)
      );
      const fetchedResults =
        await GitHubV3.getAllReposContributors(contributedsInOrg, verify);

      fetchedResults.forEach((fetchedResult) => {
        const { full_name, data } = fetchedResult;
        const repository = repos.find(item => item.full_name === full_name);
        if (repository && data.length) {
          repository.contributors = data;
        } else {
          repository.contributors = [];
        }
      });
    } catch (err) {
      logger.error(err);
    }
  }

  org.repos = repos;
  await OrgsModel.update(org);
  return org;
};

const fetchUserOrgs = async (login, verify) => {
  const pubOrgs =
    await GitHubV3.getPersonalPubOrgs(login, verify, PER_PAGE.ORGS);
  await UsersModel.updateUserOrgs(login, pubOrgs);
  return pubOrgs;
};

const getUserOrgs = async (login, verify) => {
  const findUser = await UsersModel.findUser(login);
  const pubOrgs = findUser.orgs;
  if (pubOrgs && pubOrgs.length) return pubOrgs;
  return await fetchUserOrgs(login, verify);
};

const updateOrgs = async (login, verify) => {
  try {
    const userOrgs = await fetchUserOrgs(login, verify);

    await Promise.all(userOrgs.map(async (userOrg) => {
      const orgLogin = userOrg.login;
      await fetchOrgDetail({
        login,
        verify,
        orgLogin,
      });
    }));
  } catch (err) {
    logger.error(err);
  }
};

const getDetailOrgs = async (pubOrgs, verify, login) => {
  const orgs = [];

  await Promise.all(pubOrgs.map(async (pubOrg) => {
    const orgLogin = pubOrg.login;
    let org = await OrgsModel.find(orgLogin);
    if (!org) {
      org = await fetchOrgDetail({
        login,
        verify,
        orgLogin,
      });
    }
    orgs.push(org);
  }));
  return orgs;
};

const getOrgs = async (login, verify) => {
  const userOrgs = await getUserOrgs(login, verify);
  return await getDetailOrgs(userOrgs, verify, login);
};

/*
 * =============== user ===============
 */
const fetchUser = async (login, verify) => {
  const userInfo = await GitHubV4.getUser(login, verify);
  const addResut = await UsersModel.createGitHubUser(userInfo);
  return addResut.result;
};

const getUser = async (login, verify) => {
  const user = await UsersModel.findUser(login);
  if (user) { return user; }
  return await fetchUser(login, verify);
};

export default {
  // repos
  fetchRepos,
  getRepos,
  getRepository,
  getUserStarred,
  getUserPublicRepos,
  getUserContributedRepos,
  // commits
  fetchCommits,
  getCommits,
  // orgs
  getOrgs,
  updateOrgs,
  getUser,
};