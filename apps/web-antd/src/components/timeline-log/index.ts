import { defineAsyncComponent } from 'vue';

export const AsyncTimelineLog = defineAsyncComponent(
  () => import('./timeline-log.vue'),
);

export { default as TimelineLog } from './timeline-log.vue';

export type { TimelineLogItem, TimelineLogProps } from './typing';
