import Koa from 'koa';
import log from 'koa-logger';
import convert from 'koa-convert';
import bodyParser from 'koa-bodyparser';
import onerror from 'koa-onerror';
import json from 'koa-json';
import cors from 'kcors';
import config from 'config';
import router from '../modules';
import logger from '../utils/log';
import params from '../middlewares/params';
import authMiddleware from '../middlewares/auth';
import verifyMiddleware from '../middlewares/verify';

const appKey = config.get('appKey');
const port = config.get('port');
const app = new Koa();
app.keys = [appKey];

app.use(convert(cors()));

// error handle
onerror(app);
// bodyparser
app.use(bodyParser());
// json parse
app.use(convert(json()));
// koa-logger
app.use(convert(log()));
// check if validate app
app.use(params.checkApp('x-app-name'));
// auth
app.use(authMiddleware({
  whiteList: [
    /^\/api\/github\/(zen)|(octocat)|(verify)/
  ]
}));
// verify token params
app.use(verifyMiddleware());

// router
app.use(router.routes(), router.allowedMethods());
// error
app.on('error', (err) => {
  logger.error(err);
});

app.listen(port, () => {
  logger.info(
    `[SERVER START][${config.get('appName')}][Running at port ${port}]`
  );
});

export default app;
