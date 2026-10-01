# SiteFit

**SiteFit** is a commercial-property screening and comparison tool for Wake County, North Carolina.

It started as a Java console project that loaded commercial-property data, filtered listings by budget and business type, and compared properties by cost, lot size, population, and suitability. This version keeps the original idea but turns it into a browser-based decision tool with a private-data importer, interactive filters, a map, explainable scoring, and side-by-side comparison.

## What it does

- Loads a CREXi Excel export locally without committing the raw file to GitHub
- Cleans inconsistent city names and missing values
- Filters by city, property type, budget, acreage, building size, and minimum score
- Ranks properties with an explainable 0–100 SiteFit score
- Uses official NC population and population-growth data for the market component
- Compares up to three properties side-by-side
- Plots geocoded listings on an interactive map
- Has a public demo mode that can be hosted directly with GitHub Pages
- Uses a zero-dependency Java 21 HTTP server for the local/full-data version

## Project structure

```text
sitefit/
├─ docs/                         # Frontend + GitHub Pages demo
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ data/
│     ├─ demo-properties.json    # Synthetic demo data safe for public Git
│     └─ city-metrics.json       # Public NC OSBM population data
├─ src/main/java/com/sitefit/
│  └─ SiteFitServer.java         # Zero-dependency Java HTTP server
├─ scripts/
│  └─ import_crexi.py            # .xlsx -> private JSON importer
├─ data/
│  ├─ raw/                       # ignored by Git
│  └─ private/                   # ignored by Git
├─ run.bat                       # Windows launcher
├─ run.sh                        # macOS/Linux launcher
└─ README.md
```

## Run it on Windows

This ZIP already contains the converted private dataset from the CREXi export used to build the project.

1. Install **JDK 21+** if you do not already have it.
2. Open the project folder.
3. Double-click `run.bat`, or open Command Prompt in the folder and run:

```bat
run.bat
```

4. Visit:

```text
http://localhost:8080
```

The Java server automatically uses `data/private/properties.json` when it exists. If private data is missing, it falls back to the synthetic demo data.

## Import a newer CREXi export

The importer uses only Python's standard library.

```bat
python scripts\import_crexi.py "C:\path\to\Sales_Export.xlsx"
```

or:

```bat
import-data.bat "C:\path\to\Sales_Export.xlsx"
```

Then restart `run.bat`.

## SiteFit score

The score is intentionally transparent:

| Component | Weight | What it represents |
|---|---:|---|
| Property/business fit | 35% | Compatibility between the selected business use and listing type/subtype |
| Local market momentum | 25% | Municipal population + population growth |
| Relative value | 20% | Price per square foot / acre or asking price vs. nearby comparable listings |
| Financial signal | 10% | Cap rate when available |
| Data completeness | 10% | How much useful listing information is present |

Budget and minimum-size inputs also affect screening. The model is a **decision-support heuristic**, not an appraisal, investment recommendation, zoning opinion, or substitute for due diligence.

The market-research logic follows the SBA's guidance that location decisions should consider the target market, costs, local restrictions, and demographic/economic information. Population inputs come from the North Carolina Office of State Budget and Management's 2024 municipal population estimates.

Sources:

- NC OSBM, Municipal Population Change: https://www.osbm.nc.gov/facts-figures/population-demographics/state-demographer/municipal-population-estimates/municipal-population-change
- U.S. Small Business Administration, Plan Your Business / Market Research: https://www.sba.gov/counseling/plan-your-business/
- U.S. Small Business Administration, Pick Your Business Location: https://www.sba.gov/counseling/launch-your-business/

## Why the CREXi export is not committed

`data/raw/` and `data/private/` are ignored by Git. That keeps the public repository focused on code and prevents accidentally publishing the full third-party export.

The public `docs/data/demo-properties.json` file is synthetic and exists only so the GitHub Pages demo works.

## Push this project to GitHub

### 1. Create an empty repo on GitHub

Create a new repository named something like:

```text
sitefit
```

Do **not** add a README, .gitignore, or license on GitHub because those are already in this folder.

### 2. Open Command Prompt or PowerShell in this folder

Then run:

```bash
git init
git add .
git status
git commit -m "Build SiteFit commercial property analyzer"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sitefit.git
git push -u origin main
```

Before the commit, `git status` should **not** show your CREXi `.xlsx` file or `data/private/properties.json`. The `.gitignore` is designed to protect them.

### 3. Turn on GitHub Pages

On the GitHub repo:

1. Open **Settings**
2. Open **Pages**
3. Under **Build and deployment**, choose **Deploy from a branch**
4. Choose branch `main`
5. Choose folder `/docs`
6. Save

GitHub will give you a public URL for the synthetic demo site.

## Good resume bullet

> Built SiteFit, a Java-based commercial real-estate screening tool that imports 385 Wake County listings, cleans incomplete property data, combines official municipal population-growth data with property economics, and ranks sites with an explainable multi-factor scoring model; added interactive filtering, mapping, and side-by-side comparison in a deployable web interface.

Rewrite that in your own voice before putting it on a resume.

## Next improvements

- Add a real database such as PostgreSQL
- Add historical listing snapshots and price-change tracking
- Pull Census/ACS income, labor-force, and renter-share variables
- Add zoning verification links from local municipalities
- Add user-defined scoring weights
- Add automated tests for the importer and scoring logic
- Move from the zero-dependency server to Spring Boot after the core project is fully understood
