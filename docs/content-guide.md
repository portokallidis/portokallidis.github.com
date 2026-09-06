# Editing content

Edit typed records and trusted Markdown under src/content.
Describe project context separately from Nick's personal contribution.
Preserve historical technology names and bibliographic author records.
Use Nick Portokallidis in visible personal references.
The original NP logo is unchanged; nporto.com appears in accessible branding and metadata, without a visible wordmark.

## Publications and sources

Append new canonical publication entries to preserve positional corpus IDs.
The About view sorts a copy by descending year.
Use the optional url field for a verified HTTPS DOI or publisher page.
Keep titles, venues, pages, years, and author lists grounded in the supplied CV or an explicit owner update.

The two 2026 BIOSTEC entries use the volume numbers printed on their publisher PDFs: 4 for the ultrasound dataset and 3 for rehabilitation acquisition.
SciTePress HTML/BibTeX metadata disagrees with those PDFs.
The ThrombUS+ CSBJ identifier 0082 is an article number, not a page range.

Do not infer business outcomes, team sizes, clinical efficacy, or current employment.
ThrombUS+ remains Start: 2024 until participation status is confirmed.
Keep raw CVs, private notes, residential addresses, and unapproved media outside the public source and artifact.
The existing archive retains previously committed legacy material and is not private storage.

## Validate a change

~~~sh
npm run evaluate:retrieval
npm run check
npm test
npm run build
npm run verify:dist
~~~

The generator validates content and produces a versioned corpus with stable source IDs, section URLs, and content hashes.
Only corpus.json is deployed under lab-artifacts.
Evaluation questions and retrieval measurements are generated into .build.
Never edit generated files by hand.

Changed content invalidates previous corpus-specific model measurements.
Run the development model evaluation again before making claims about the new release.
Keep genuine run output intact and attach reviews separately.
Historical recordings under docs/evidence are preserved evidence, not current-release results or public chat examples.

Run the production browser suite for route, layout, or interaction changes.
