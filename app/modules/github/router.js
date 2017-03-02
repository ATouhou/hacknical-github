import koaRouter from 'koa-router';
import GitHub from './controller';
import params from '../../middlewares/params';

const router = koaRouter({
  prefix: '/api/github'
});

// zen & octocat
router.get(
  '/zen',
  GitHub.getZen
);
router.get(
  '/octocat',
  GitHub.getOctocat
);

router.get(
  '/token',
  params.checkQuery(['code']),
  GitHub.getToken
);
router.get(
  '/user',
  params.checkQuery(['token']),
  GitHub.getUser
);

module.exports = router;
