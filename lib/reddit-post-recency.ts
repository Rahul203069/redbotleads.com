export const REDDIT_POST_MAX_AGE_HOURS = 3 * 24;
export const REDDIT_POST_MAX_AGE_MS = REDDIT_POST_MAX_AGE_HOURS * 60 * 60 * 1000;

export function getRedditPostRecencyCutoff(referenceTime: Date = new Date()) {
  return new Date(referenceTime.getTime() - REDDIT_POST_MAX_AGE_MS);
}

export function isRedditPostOutsideRecencyWindow(
  createdUtc: Date,
  referenceTime: Date = new Date(),
) {
  return createdUtc.getTime() < getRedditPostRecencyCutoff(referenceTime).getTime();
}
