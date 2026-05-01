# Audiobookshelf series

Generated {{generatedAt}} from {{serverUrl}} ({{seriesCount}} series across {{libraryCount}} libraries).

{{#each series}}
## {{name}}

- Books: {{bookCount}}
- Total duration: {{totalDurationHours}} h

{{#each books}}
- [ ] {{sequence}} — **{{title}}** by {{authorName}}{{#if publishedYear}} ({{publishedYear}}){{/if}}
{{/each}}

{{/each}}
