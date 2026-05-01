---
generatedAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
seriesCount: {{seriesCount}}
libraryCount: {{libraryCount}}
---
# {{libraryTitle}} series

{{#each series}}

> [!book-open]+ {{name}}
> 
> Books: {{bookCount}}
> Total duration: {{totalDurationHours}} h
> ---
> {{#each books}}
> :{{statusIcon}}: **{{title}}** by {{authorName}}
> {{/each}}

{{/each}}