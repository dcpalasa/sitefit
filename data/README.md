# Data folders

- `raw/` is for original third-party exports such as the CREXi `.xlsx` file.
- `private/` is for the normalized JSON used by the local Java server.

Both folders are ignored by Git except for `.gitkeep` placeholders. This project ZIP includes the data used during development so the local version runs immediately, but `git add .` will not stage those files.

To rebuild the private JSON from a newer export:

```bash
python scripts/import_crexi.py path/to/Sales_Export.xlsx
```
