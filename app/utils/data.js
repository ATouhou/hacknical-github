export const CRAWLER_STATUS = {
  RUNNING: 'running',
  PENDING: 'pending',
  SUCCEED: 'succeed',
  FAILED: 'failed',
  INITIAL: 'initial',
};

export const CRAWLER_STATUS_CODE = {
  [CRAWLER_STATUS.INITIAL]: 0,
  [CRAWLER_STATUS.SUCCEED]: 1,
  [CRAWLER_STATUS.PENDING]: 2,
  [CRAWLER_STATUS.RUNNING]: 3,
  [CRAWLER_STATUS.FAILED]: 4,
};
