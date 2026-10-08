# Statistics from the long run

Collected during a 20-minute run of the CodeStreamConsumer with `DELAY=0`
(2,617 files including the two test files).

| File | Content |
|---|---|
| `timers-data.json` | One record per processed file, saved from `http://localhost:8080/timers/data` every minute: `index`, `name`, `lines`, `total` and `match` time in µs, `clones` found so far |
| `resources.csv` | One row per minute: time, memory, CPU of the consumer container (`docker stats`) and number of processed files |
| `make_charts.py` | Creates the four charts from the two files above: `python3 make_charts.py` |
| `chart1..chart4.png` | Time per file, time per line, files per minute, memory |
