# Project Notes

## What changed from the original console program

The original program already had the core product idea:

- `Property` object
- CSV-style data ingestion
- budget filtering
- business-type suitability
- side-by-side property comparison
- cost, lot-size, city-population, and suitability comparisons

This version keeps those concepts but separates them into three layers:

1. **Data ingestion** — `scripts/import_crexi.py`
2. **Java serving layer** — `SiteFitServer.java`
3. **Interactive analysis UI** — `docs/app.js`

That progression is easy to explain as a student project because every layer maps to something the original program already did.

## Interview explanation

A concise explanation:

> I originally wrote this as a Java console project for comparing commercial properties. I later exported a larger Wake County dataset and rebuilt it as a web tool. I wrote an importer to clean the Excel data, kept Java as the local server, and created an explainable score instead of a simple suitable/not-suitable lookup. The score combines business/property-type fit, municipal population growth, relative listing value, cap rate, and data completeness. I made the public GitHub version use synthetic data so I wouldn't publish the raw third-party export.

## Decisions worth being able to explain

### Why no Spring Boot yet?

The server uses Java's built-in `HttpServer`. That avoids framework boilerplate and makes the first web version easy to understand. Spring Boot is a sensible later upgrade when you add a database, accounts, or a larger API.

### Why use a heuristic score instead of machine learning?

There is no labeled dataset saying which property is "best" for a business. A transparent weighted model is more defensible than pretending an ML model has learned an objective truth.

### Why population growth?

It is only one market-demand proxy, so it gets 25% of the total score rather than dominating the ranking. It is public, understandable, and available consistently across municipalities.

### Why can a high-growth small town still score well?

The market component blends population size and growth. A large city benefits from scale; a smaller municipality can partially offset that through rapid growth.

### Biggest limitation

Listing data is incomplete. Many properties have no asking price, building size, or cap rate. SiteFit keeps those listings visible but penalizes low data completeness and shows missing values instead of inventing them.
