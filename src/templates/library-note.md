---
createdAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
---
# {{libraryTitle}} series
{{seriesCount}} series

{{#each series}}

> [!book-open]+ [[{{seriesNotePath}}|{{name}}]]
>
> Books: {{finishedBookCount}} / {{bookCount}}
> Duration: {{progressDurationHours}} h / {{totalDurationHours}} h
>
> {{#each books}}
> :{{statusIcon}}: **{{title}}** by {{authorName}} · {{statusLabel}}
> {{/each}}

{{/each}}