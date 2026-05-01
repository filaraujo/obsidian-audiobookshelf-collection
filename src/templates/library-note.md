---
createdAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
---
# All Series
**Series:** {{ seriesCount }} · **Books:** {{ bookCount }} · **Duration:** {{ totalDurationHours }} h

{{#each series}}

> [!series]+ [[{{seriesNotePath}}|{{name}}]]
> **Books:** {{finishedBookCount}} / {{bookCount}} · **Duration:** {{progressDurationHours}} h / {{totalDurationHours}} h
>
> {{#each books}}
> :{{statusIcon}}: **{{title}}** by {{authorName}} · {{statusLabel}}
> {{/each}}

{{/each}}