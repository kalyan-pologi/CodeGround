import { coreChallenges } from './core-challenges.js';
import { springChallenges } from './spring-challenges.js';
export const challenges = [...coreChallenges, ...springChallenges].map((challenge, index) => ({ id: index + 1, ...challenge }));
