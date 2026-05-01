---
generatedAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
seriesCount: {{seriesCount}}
---
# {{libraryTitle}} series
{{seriesCount}} series

{{#each series}}

> [!book-open]+ {{name}}
> 
> Books: {{finishedBookCount}} / {{bookCount}}
> Duration: {{progressDurationHours}} h / {{totalDurationHours}} h
> ---
> {{#each books}}
> :{{statusIcon}}: **{{title}}** by {{authorName}}
> {{/each}}

{{/each}}