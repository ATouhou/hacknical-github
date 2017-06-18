import log4js from 'log4js';
import config from 'config';

const appName = config.get('appName');

if (!config.logFile) {
  log4js.configure({
    appenders: [
      { type: 'console' }
    ]
  });
} else {
  log4js.configure({
    appenders: [
      { type: 'file', filename: config.logFile, }
    ]
  });
}

const logger = log4js.getLogger(`[${appName}]`);
logger.setLevel('INFO');

export default logger;
