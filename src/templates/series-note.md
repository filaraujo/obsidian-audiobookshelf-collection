---
createdAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
---

# {{series.name}}
**Books:** {{series.finishedBookCount}} / {{series.bookCount}} · **Duration:** {{series.progressDurationHours}} h / {{series.totalDurationHours}} h

{{#if series.description}}
{{series.description}}

{{/if}}

{{#each series.books}}

---

## {{title}}
**Progress:** :{{statusIcon}}: {{statusLabel}} · **Author:** {{authorName}}

{{#if imageUrl}}
<img src="{{imageUrl}}" alt="{{title}}" height="320" />
{{/if}}

{{#if description}}
{{description}}
{{/if}}

{{/each}}
