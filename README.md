# SiteFit: Commercial Property Decision Tool

SiteFit is a commercial real estate comparison tool I built around Wake County, North Carolina property listings.

The project started as a Java class project. The first version loaded property data, filtered listings by budget and business type, and compared two properties using price, lot size, city population, and a simple suitability lookup. I liked the idea enough to keep working on it as a personal project.

This version turns that original console program into a browser-based tool with a larger dataset, interactive filtering, mapping, property scoring, adjustable weights, and side-by-side comparison.

## What it does

- Filters listings by city, property type, budget, acreage, building size, and score
- Lets the user choose a business type such as restaurant, retail, office, industrial, or multifamily
- Changes the default scoring weights based on the selected business
- Lets the user adjust the scoring weights manually
- Scores each property from 0 to 100
- Shows exactly how the score was calculated
- Lists strengths and missing information for each property
- Compares up to three properties side by side
- Displays geocoded listings on an interactive map
- Uses municipal population and population growth as part of the market score
- Imports a local CREXi Excel export without committing the raw file to GitHub
- Includes a synthetic public demo dataset for GitHub Pages

## How the score works

The score has five parts:

| Part | What it looks at |
| --- | --- |
| Business fit | How well the listing type and subtype match the selected business |
| Market | Municipal population and recent population growth |
| Value | Relative property price and the user's budget |
| Financial | Cap rate when the listing includes one |
| Data quality | How much useful information is available for the listing |

The weights are not the same for every business.

For example, the restaurant profile puts more weight on business fit and the local customer market. The industrial profile puts more weight on industrial property fit and property value while giving local population less influence.

The user can also change the weights directly in the app. SiteFit normalizes the selected weights so they always add up to 100%.

### Restaurant example

A restaurant gets a higher business-fit score when a listing includes terms such as:

- Restaurant
- QSR / fast food
- Bar
- Storefront
- Shopping center
- Retail

A warehouse or industrial property receives a much lower restaurant-fit score.

This does not mean SiteFit can determine whether a restaurant will succeed. The current property export does not include important factors such as traffic counts, parking, nearby competition, or verified zoning. Those are future improvements.

## Project structure

```text
sitefit/
├── docs/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── data/
│       ├── demo-properties.json
│       └── city-metrics.json
│
├── src/main/java/com/sitefit/
│   └── SiteFitServer.java
│
├── scripts/
│   └── import_crexi.py
│
├── data/
│   ├── raw/
│   └── private/
│
├── run.bat
├── run.sh
└── README.md
```

## Run it on Windows

You need Java 21 or newer.

From the project folder, run:

```powershell
.\run.bat
```

Then open:

```text
http://localhost:8080
```

The Java server uses `data/private/properties.json` when that file exists. If the private data is missing, the site falls back to the synthetic demo dataset.

## Import a newer CREXi export

Run:

```powershell
python scripts\import_crexi.py "C:\path\to\Sales_Export.xlsx"
```

or:

```powershell
.\import-data.bat "C:\path\to\Sales_Export.xlsx"
```

Then restart the Java server.

## Data used

The full CREXi export is kept local. The `data/raw/` and `data/private/` folders are ignored by Git so the original export is not published in the repository.

The public GitHub Pages version uses a small synthetic dataset instead.

Municipal population data comes from the North Carolina Office of State Budget and Management's 2024 population estimates.

Source:

- NC OSBM Municipal Population Change: https://www.osbm.nc.gov/facts-figures/population-demographics/state-demographer/municipal-population-estimates/municipal-population-change

## What I changed from the original project

The original version mainly practiced Java classes, ArrayLists, HashMaps, file input, filtering, and comparison logic.

The personal-project version adds:

- Real-world data cleaning
- A local Java web server
- JSON data
- A browser interface
- Interactive filtering
- Business-specific scoring
- User-adjustable scoring weights
- Score explanations
- Mapping
- Side-by-side comparison
- Public/private data separation for GitHub

## Current limitations

SiteFit is a screening tool, not an appraisal or investment recommendation.

The score does not currently verify:

- Zoning
- Parking
- Traffic counts
- Nearby competitors
- Environmental conditions
- Financing
- Title issues
- Whether a specific business will be profitable

I would rather show those limitations than make up data that is not in the property export.

## Future improvements

- Add Census/ACS income and workforce data
- Add traffic-count data
- Add nearby competitor analysis
- Add zoning verification links
- Add parking information when available
- Add historical listing snapshots and price changes
- Store properties in PostgreSQL instead of JSON
- Add automated tests for the importer and scoring logic
- Move the backend to Spring Boot as the project grows

## Tech used

- Java 21
- JavaScript
- HTML/CSS
- Python
- JSON
- Git/GitHub
- Leaflet
