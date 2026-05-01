# Audiobookshelf series

Generated {{generatedAt}} from {{serverUrl}} ({{seriesCount}} series across {{libraryCount}} libraries).

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