# Addendum: Maintaining the changelog

We use [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) as a guide for writing changelogs. To summarize, however, the goal of a changelog is to document the noteworthy changes that have been made to the project. Although this tool provides some automation around keeping changelogs up to date, they are designed to be maintained by hand.

After running this tool, you'll want to follow a few steps:

1. First, you'll want to ensure that each change entry has been placed into an appropriate change category (see [here](https://keepachangelog.com/en/1.0.0/#types) for the full list of change categories as well as the correct ordering).

2. Next, you'll want to curate the entries in each category. This could mean:

   - **Rewording/rephrasing.** The changelog should be understandable by anyone who wants to use your project, regardless of their experience. Although references to modules/interfaces may be necessary, prefer abstract and non-technical language over jargon.
   - **Consolidation.** A changelog entry represents a complete unit of work, and some work may be split across multiple commits. In this case, you can combine multiple entries together, listing multiple PRs instead of just one.
   - **Omission.** Some changes do not affect end users of the project (e.g. lockfile changes, development environment changes, etc.). In these cases, you may remove these entries entirely. Exceptions may be made for changes that might be of interest despite not having an effect upon the published package (e.g. major test improvements, security improvements, improved documentation, etc.).

3. Once you're made your edits, make sure to run `yarn auto-changelog validate --rc --prettier` to check that the changelog is correctly formatted.
