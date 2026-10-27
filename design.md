# EventOps visual direction

The approved source is [Experience and visual system](docs/specs/0001-eventops/0003-experience.md). Use its Swiss direction: clear type, a visible grid, generous space, and restrained blue emphasis. Color and dimension values live in [tokens.css](src/styles/tokens.css), not in a second token list here.

## Composition

The introduction has a wordmark and concise navigation, a left aligned purpose statement, a three stage distinction between records and revisions, an operational workflow, and an event preparation checklist. It contains no invented event data, testimonials or statistics. Every visible control has an implemented destination. Account entry is added with the authentication milestone, not simulated here.

## Component and usage rules

Use the shared page shell, button, text field, and state components. Labels remain visible; errors describe the next useful action. The comparison structure aligns current, proposed, and source information, stacking into labeled blocks on mobile. No decorative imagery, gradients, warm paper, serif type, or fake charts. Helvetica Neue is a system font with Helvetica and Arial fallbacks; no remote font request is needed.

## Responsive behavior

Build from narrow layouts, expand the workflow at 640 px and the hero at 1024 px. Maintain readable line lengths, visible focus, 44 px practical targets, reduced motion, and no horizontal page scrolling at 320 CSS px. The internal state exercise is excluded from production.
