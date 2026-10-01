# SiteFit

SiteFit is a commercial real estate comparison tool I built using property listings from Wake County, NC.

The project originally started as a Java class project where I loaded property data from a CSV file, filtered properties based on a user's budget and business type, and compared two properties by things like price, lot size, city population, and business suitability.

I liked the idea, so I decided to turn it into a larger personal project instead of leaving it as a console program.

The current version has a web interface, more property data, interactive filters, a map, property scoring, and side-by-side comparisons.

## Features

- Search and filter commercial properties
- Filter by city, property type, price, acreage, and building size
- Choose a business type and see which properties fit it better
- Compare up to 3 properties at once
- View properties on an interactive map
- Calculate price per square foot and other property metrics
- Use population and population growth as part of the location score
- Import newer property data from an Excel file
- Run the full application locally with Java
- Host a demo version using GitHub Pages

## Project Structure

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
