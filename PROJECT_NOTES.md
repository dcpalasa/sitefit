# Project Notes

## Where this project came from

The first version of SiteFit was a Java console project. It had a `Property` class, file input, budget filtering, a business-suitability lookup, and a method that compared two properties.

The current version keeps that same idea but splits it into three parts:

1. Data import in `scripts/import_crexi.py`
2. A small Java HTTP server in `SiteFitServer.java`
3. The interactive frontend in `docs/app.js`

## Scoring approach

I used a transparent scoring model instead of machine learning because I do not have labeled historical data showing which commercial properties were actually successful for each business type.

The score uses five components:

- Business fit
- Market
- Value
- Financial data
- Data quality

Each business type starts with different weights. The user can change the weights in the interface.

The business-fit rules are also different by business. A restaurant scores highly for restaurant, QSR, storefront, shopping-center, and retail listings. An industrial user scores highly for warehouse, distribution, manufacturing, flex, and industrial listings.

## Biggest limitation

The CREXi export is useful property data, but it does not contain everything needed to decide whether a location is truly good for a business.

Restaurant screening, for example, would be much better with traffic counts, parking, nearby competitors, income, and zoning. The app calls those missing factors out instead of pretending they are already included.

## Things to be able to explain in an interview

- Why the score is a heuristic instead of machine learning
- How the business-fit rules work
- How the weights are normalized to 100%
- Why different businesses use different default weights
- How value is compared with similar listings
- Why missing data affects the score
- Why the full CREXi export is kept out of the public Git repository
- How the Java server serves the frontend and private property data
