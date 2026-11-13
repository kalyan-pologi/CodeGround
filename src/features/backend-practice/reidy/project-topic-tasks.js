import { topics } from '../java-backend/data/topics.js';
import { propertyCatalogTask } from './project-catalog-task.js';
import { mediumJavaTasks } from './project-medium-java.js';
import { advancedJavaTasks } from './project-medium-java-advanced.js';
import { mediumDataTasks } from './project-medium-data.js';
import { mediumApiTasks } from './project-medium-api.js';
import { mediumWorkflowTasks } from './project-medium-workflows.js';
import { mediumDeliveryTasks } from './project-medium-delivery.js';
import { mediumOperationTasks } from './project-medium-operations.js';
import { productionExercises } from './production-exercises.js';
import { buildDeepReidyTasks } from './deep-reidy-task-plan.js';

const tasks = [propertyCatalogTask, ...mediumJavaTasks, ...advancedJavaTasks, ...mediumDataTasks,
  ...mediumApiTasks, ...mediumWorkflowTasks, ...mediumDeliveryTasks, ...mediumOperationTasks];
const byTopic = new Map(tasks.map(task => [task.topic, task]));
if (byTopic.size !== tasks.length) throw new Error('Duplicate ReidyAI topic');

const topicTasks = topics.map((topic, index) => {
  const task = byTopic.get(topic);
  if (!task) throw new Error(`Missing ReidyAI task for ${topic}`);
  return { ...task, id: index + 1, runtime: task.runtime || 'java' };
});
export const projectTopicTasks = buildDeepReidyTasks(productionExercises, topicTasks);
