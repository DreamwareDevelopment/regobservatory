This project is hosted at https://regobservatory.vercel.app

# Purpose

This tool is for analyzing the size and scope of federal agency regulations located [here](https://ecfr.gov).

## Features

1. Historical word count bar chart, optionally filterable by agency.
2. Bubble plot showing the relative size of agencies with regard to their regulation word counts.
3. Vector search of regulation text, optionally filterable by agency.

# Architecture

## Ingest

- Data is ingested with the help of [Inngest](https://www.inngest.com/).
  - Manual jobs may be triggered through their dashboard.
- Ingest runs on Vercel serverless functions.
- Data is stored on a managed postgres instance hosted by [Neon](https://neon.tech/home)

## Workflow

1. Agencies are loaded in an idemptotent manual job load-agencies.
2. Ingest is started via the ingest manual job.
   - The ingest begins from the start date of eCFR data (2017-01-01).
   - Ingest fetches the agencies then kicks off a job called process-reference for each agency.

## Process Reference

1. Fetch the xml for the agency as indicated by the reference.
2. Parse the xml for paragraphs. Take note of the encapsulating sections.
3. Get the word count and upsert the history.
4. If the date being processed is the current date or RUN_UNTIL, generate and store embeddings.
5. The ingest job will update the application state once process references is done for all agencies.
6. If the date is less than the current date or RUN_UNTIL, the ingest job will kick off another iteration with the next day.

## Cron Ingest

1. Runs once a day.
2. If the application state indicates ingest is caught up to the current date it will kick off the ingest job for the current date.

# Frontend

The app is built with NextJS + React 18

# Notable libraries:
- AI SDK
- Dayjs
- Recharts
- D3 JS
