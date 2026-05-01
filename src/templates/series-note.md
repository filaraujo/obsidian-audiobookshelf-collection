---
createdAt: "{{generatedAt}}"
serverUrl: "{{serverUrl}}"
---
# {{series.name}}

{{#if series.description}}
{{series.description}}

{{/if}}

---

Books: {{series.finishedBookCount}} / {{series.bookCount}}
Duration: {{series.progressDurationHours}} h / {{series.totalDurationHours}} h

{{#each series.books}}

> [!{{statusIcon}}]+ {{title}}
>
> Status: :{{statusIcon}}:
> Author: {{authorName}}
>
> {{#if description}}
> {{description}}
> {{/if}}
>
{{/each}}