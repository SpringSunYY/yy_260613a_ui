<script setup lang="ts">
import type { TimelineLogProps } from './typing';

import { formatDateTime } from '@vben/utils';

import { Avatar, Timeline } from 'ant-design-vue';

defineOptions({ name: 'TimelineLog' });

withDefaults(defineProps<TimelineLogProps>(), {
  logList: () => [],
});
</script>

<template>
  <div>
    <Timeline>
      <Timeline.Item v-for="log in logList" :key="log.id">
        <template #dot>
          <slot name="dot" :log="log">
            <Avatar
              :src="log.avatar"
              :size="24"
              class="absolute left-[-5px] flex-shrink-0"
            >
              {{ log.userName?.[0] ?? '?' }}
            </Avatar>
          </slot>
        </template>

        <p>{{ formatDateTime(log.createTime) }}</p>
        <p>
          <slot name="action" :log="log"></slot>
        </p>
      </Timeline.Item>
    </Timeline>
  </div>
</template>
