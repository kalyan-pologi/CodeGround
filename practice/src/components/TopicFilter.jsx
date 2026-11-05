import { topicGroups } from '../data/topics';

export default function TopicFilter({ value, onChange }) {
  return <label>Topic <select value={value} onChange={event => onChange(event.target.value)}>
    <option value="All">All topics</option>
    {topicGroups.map(group => <optgroup key={group.label} label={group.label}>
      {group.topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
    </optgroup>)}
  </select></label>;
}
