# Ambassador School Science Week

The design and interactions are implemented. Bracketed values are intentionally unconfirmed content, not sample event facts.

## Adding final content

- Edit `data/content.ts`: `eventConfig` contains event text, dates, location, process, statistics, and exhibit headings. `projects` contains six structural project slots; replace each slot with a confirmed project and its actual category assignments.
- Required project fields are defined by the `Project` TypeScript type. Keep a field bracketed until the corresponding information is confirmed. Category filtering uses each project's `categories` array.
- Media files belong in `public/`. Project images should be prepared around 4:5 for gallery use and 16:9 for detail use; exhibit media should suit the existing portrait frame. Replace the media-slot component with confirmed media only, keeping meaningful alt text.
- Navigation labels and Ambassador School identity are permanent interface content. No schedule data exists yet, so add a schedule entity only if a real schedule is supplied.

Run `pnpm run typecheck` and `pnpm run build` after content updates.
