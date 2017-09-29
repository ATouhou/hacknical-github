import config from 'config';
import UsersModel from '../../databases/github-users';
import GitHubV3 from '../../services/github-v3';
import GitHubV4 from '../../services/github-v4';
import Spider from '../../services/spider';
import dateHelper from '../../utils/date';
import Helper from '../shared/helper';
import logger from '../../utils/logger';
import {
  PER_PAGE,
} from '../../utils/github';

const REFRESH_LIMIT = 5 * 60;
const app = config.get('app');


/* ================== router handler ================== */

const getZen = async (ctx) => {
  const { verify } = ctx.request.query;
  const result = await GitHubV3.getZen(verify);

  ctx.body = {
    result,
    success: true,
  };
};

const getOctocat = async (ctx) => {
  const { verify } = ctx.request.query;
  const result = await GitHubV3.getOctocat(verify);

  ctx.body = {
    result,
    success: true,
  };
};

const getVerify = async (ctx) => {
  ctx.body = {
    success: true,
    result: app[ctx.state.appName].clientId
  };
};

const getToken = async (ctx) => {
  const { code, verify } = ctx.request.query;
  const result = await GitHubV3.getToken(code, verify);
  const token = result.access_token;
  ctx.body = {
    success: true,
    result: token,
  };
};

const getLogin = async (ctx) => {
  const { verify } = ctx.request.query;
  const userInfo = await GitHubV4.getUserByToken(verify);

  ctx.mq.sendMessage({
    message: userInfo.login
  });
  const user = await UsersModel.findOne(userInfo.login);
  if (!user) {
    await UsersModel.createGitHubUser(userInfo);
  }

  ctx.body = {
    success: true,
    result: {
      id: userInfo.id,
      login: userInfo.login,
      email: userInfo.email,
      name: userInfo.name || userInfo.login,
      avatar_url: userInfo.avatar_url || '',
      html_url: userInfo.html_url || ''
    }
  };
};

const getUser = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const user = await Helper.getUser(login, verify);
  ctx.body = {
    success: true,
    result: user,
  };
};

const getUserRepositories = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const repos = await Helper.getUserRepositories(login, verify);

  ctx.body = {
    success: true,
    result: repos
  };
};

const getUserContributed = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const repos = await Helper.getUserContributed(login, verify);

  ctx.body = {
    success: true,
    result: repos
  };
};

const getUserStarred = async (ctx) => {
  const { login } = ctx.params;
  const {
    verify,
    perPage,
    after = null,
  } = ctx.request.query;

  const result = await Helper.getUserStarred({
    after,
    login,
    verify,
    perPage,
  });

  ctx.body = {
    result,
    success: true,
  };
};

const getUserStarredCount = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const count = await GitHubV4.getUserStarredCount(login, verify);
  ctx.body = {
    success: true,
    result: count,
  };
};

const getUserCommits = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const commits = await Helper.getCommits(login, verify);

  ctx.body = {
    success: true,
    result: commits
  };
};

const getUserOrganizations = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.query;
  const organizations = await Helper.getOrganizations(login, verify);
  ctx.body = {
    success: true,
    result: organizations,
  };
};

const refreshData = async (options = {}) => {
  const {
    func,
    params,
  } = options;

  try {
    await func({
      ...params
    });
    return {
      success: true,
      result: new Date()
    };
  } catch (e) {
    logger.error(e);
  }
  return {
    success: false,
    result: {
      success: false,
      error: 'Ops! Something broken..'
    }
  };
};

const refreshUserRepositories = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const user = await UsersModel.findOne(login);
  const lastUpdateTime = user.lastUpdateTime || user.created_at;

  const timeInterval =
    dateHelper.getSeconds(new Date()) - dateHelper.getSeconds(lastUpdateTime);
  if (timeInterval < REFRESH_LIMIT) {
    ctx.body = {
      success: false,
      result: {
        result: Math.ceil((REFRESH_LIMIT - timeInterval) / 60)
      }
    };
    return;
  }

  const githubUser = await GitHubV4.getUserByToken(verify);
  await UsersModel.updateUser(githubUser);

  const result = await refreshData({
    func: Helper.fetchRepositories,
    params: {
      login,
      verify,
      perPage: PER_PAGE.REPOS
    }
  });
  ctx.body = result;
};

const refreshUserCommits = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;

  const result = await refreshData({
    func: Helper.updateCommits,
    params: {
      login,
      verify
    }
  });

  ctx.body = result;
};

const refreshUserOrganizations = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;

  const result = await refreshData({
    func: Helper.updateOrganizations,
    params: {
      login,
      verify
    }
  });
  ctx.body = result;
};

const refreshUserContributed = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;

  const result = await refreshData({
    func: Helper.updateContributed,
    params: {
      login,
      verify
    }
  });
  ctx.body = result;
};

const getUserUpdateTime = async (ctx) => {
  const { login } = ctx.params;
  const findResult = await UsersModel.findOne(login);
  if (!findResult) {
    throw new Error('can not find target user');
  }
  ctx.body = {
    success: true,
    result: findResult.lastUpdateTime || findResult.created_at
  };
};

const getRepository = async (ctx) => {
  const {
    verify,
    fullname,
    required = '',
  } = ctx.request.query;

  const repository = await Helper.getRepository(
    fullname, verify, required.split(',')
  );
  ctx.body = {
    success: true,
    result: repository,
  };
};

const getRepositoryReadme = async (ctx) => {
  const {
    verify,
    fullname,
  } = ctx.request.query;

  const data = await Helper.getRepositoryReadme(fullname, verify);

  ctx.body = {
    success: true,
    result: data.readme,
  };
};

const starRepository = async (ctx) => {
  const { verify } = ctx.request.query;
  const { fullname } = ctx.request.body;
  const result = await GitHubV3.starRepository(fullname, verify);

  ctx.body = {
    result,
    success: true,
  };
};

const unstarRepository = async (ctx) => {
  const { verify } = ctx.request.query;
  const { fullname } = ctx.request.body;
  const result = await GitHubV3.unstarRepository(fullname, verify);

  ctx.body = {
    result,
    success: true,
  };
};

const userScientificData = (obj, count = 5) => {
  const result = {};
  Object.keys(obj)
    .sort((current, next) => obj[next] - obj[current])
    .slice(0, count)
    .map(key => (result[key] = obj[key]));
  return result;
};

const getUserScientific = async (ctx) => {
  const { login } = ctx.params;
  const usersCol = ctx.db.collection('users');

  const user = await usersCol.findOne({ login });
  if (!user) {
    ctx.body = {
      success: false,
    };
    return;
  }
  const {
    starred,
    created,
  } = user;
  ctx.body = {
    success: true,
    result: {
      starred: {
        keywords: userScientificData(starred.keywords, 20),
        languages: userScientificData(starred.languages),
      },
      created: {
        keywords: userScientificData(created.keywords, 20),
        languages: userScientificData(created.languages),
      }
    }
  };
};

const getUserPredictions = async (ctx) => {
  const { login } = ctx.params;
  const { verify } = ctx.request.query;
  const predictionsCol = ctx.db.collection('predictions');

  const result = await predictionsCol.findOne({ login });
  if (!result) {
    ctx.body = {
      success: false,
    };
    return;
  }
  const { predictions } = result;
  const fullnames = predictions.map(prediction => prediction.fullName);
  const repositories = await Helper.getRepositories(fullnames, verify);
  ctx.body = {
    success: true,
    result: repositories
  };
};

const getCalendar = async (ctx) => {
  const { login } = ctx.params;
  const { locale } = ctx.request.query;
  const result = await Spider.calendar(login, locale);

  ctx.body = {
    result,
    success: true
  };
};

export default {
  /* ====== */
  getCalendar,
  /* ====== */
  getZen,
  getOctocat,
  /* ====== */
  getToken,
  getVerify,
  /* ====== */
  getLogin,
  getUser,
  getRepository,
  getRepositoryReadme,
  starRepository,
  unstarRepository,
  /* ====== */
  getUserRepositories,
  getUserContributed,
  getUserStarred,
  getUserStarredCount,
  getUserCommits,
  getUserOrganizations,
  /* ====== */
  refreshUserRepositories,
  refreshUserCommits,
  refreshUserOrganizations,
  refreshUserContributed,
  getUserUpdateTime,
  getUserScientific,
  getUserPredictions,
};
