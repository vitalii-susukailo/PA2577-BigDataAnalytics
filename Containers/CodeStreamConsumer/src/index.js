const express = require('express');
const formidable = require('formidable');
const fs = require('fs/promises');
const app = express();
const PORT = 3000;

const Timer = require('./Timer');
const CloneDetector = require('./CloneDetector');
const CloneStorage = require('./CloneStorage');
const FileStorage = require('./FileStorage');


// Express and Formidable stuff to receice a file for further processing
// --------------------
const form = formidable({multiples:false});

app.post('/', fileReceiver );
function fileReceiver(req, res, next) {
    form.parse(req, (err, fields, files) => {
        fs.readFile(files.data.filepath, { encoding: 'utf8' })
            .then( data => { return processFile(fields.name, data); });
    });
    return res.end('');
}

app.get('/', viewClones );
// ADDED: new pages for timing statistics
//   /timers       - summary table and charts for all files (assignment task 2)
//   /timers/data  - the raw timing records as JSON (used by the charts and to save the statistics)
app.get('/timers', viewTimers );
app.get('/timers/data', (req, res) => res.json(timingRecords) );

const server = app.listen(PORT, () => { console.log('Listening for files on port', PORT); });


// Page generation for viewing current progress
// --------------------
function getStatistics() {
    let cloneStore = CloneStorage.getInstance();
    let fileStore = FileStorage.getInstance();
    let output = 'Processed ' + fileStore.numberOfFiles + ' files containing ' + cloneStore.numberOfClones + ' clones.'
    return output;
}

function lastFileTimersHTML() {
    if (!lastFile) return '';
    output = '<p>Timers for last file processed:</p>\n<ul>\n'
    let timers = Timer.getTimers(lastFile);
    for (t in timers) {
        output += '<li>' + t + ': ' + (timers[t] / (1000n)) + ' µs\n'
    }
    output += '</ul>\n';
    return output;
}

function listClonesHTML() {
    let cloneStore = CloneStorage.getInstance();
    let output = '';

    cloneStore.clones.forEach( clone => {
        output += '<hr>\n';
        output += '<h2>Source File: ' + clone.sourceName + '</h2>\n';
        output += '<p>Starting at line: ' + clone.sourceStart + ' , ending at line: ' + clone.sourceEnd + '</p>\n';
        output += '<ul>';
        clone.targets.forEach( target => {
            output += '<li>Found in ' + target.name + ' starting at line ' + target.startLine + '\n';            
        });
        output += '</ul>\n'
        output += '<h3>Contents:</h3>\n<pre><code>\n';
        output += clone.originalCode;
        output += '</code></pre>\n';
    });

    return output;
}

function listProcessedFilesHTML() {
    let fs = FileStorage.getInstance();
    let output = '<HR>\n<H2>Processed Files</H2>\n'
    output += fs.filenames.reduce( (out, name) => {
        out += '<li>' + name + '\n';
        return out;
    }, '<ul>\n');
    output += '</ul>\n';
    return output;
}

function viewClones(req, res, next) {
    let page='<HTML><HEAD><TITLE>CodeStream Clone Detector</TITLE></HEAD>\n';
    page += '<BODY><H1>CodeStream Clone Detector</H1>\n';
    // CHANGED: added a link to the new /timers page
    page += '<P>' + getStatistics() + ' <a href="/timers">Detailed timing statistics</a></P>\n';
    page += lastFileTimersHTML() + '\n';
    page += listClonesHTML() + '\n';
    page += listProcessedFilesHTML() + '\n';
    page += '</BODY></HTML>';
    res.send(page);
}

// ADDED: Timing statistics page (assignment task 2)
// --------------------
// recordTimers() saves the timers of every processed file in timingRecords.
// summarise() calculates averages for a list of records.
// viewTimers() shows a table for all / last 1000 / last 100 / last 10 files and two charts
// (time per file and time per line, with a rolling average over 100 files).
var timingRecords = [];

function recordTimers(file) {
    let timers = Timer.getTimers(file);
    let lines = file.contents.split('\n').length;
    timingRecords.push({
        index: timingRecords.length + 1,
        name: file.name,
        lines: lines,
        total: Number(timers['total'] / 1000n),   // µs
        match: Number(timers['match'] / 1000n),   // µs
        clones: CloneStorage.getInstance().numberOfClones,
    });
    return file;
}

function summarise(records) {
    if (0 == records.length) return null;
    let sum = (key) => records.reduce( (acc, r) => acc + r[key], 0 );
    let lines = sum('lines');
    return {
        files: records.length,
        avgTotal: sum('total') / records.length,
        avgMatch: sum('match') / records.length,
        perLine: sum('total') / lines,
        maxTotal: Math.max(...records.map( r => r.total )),
    };
}

function viewTimers(req, res, next) {
    let windows = [['All files', timingRecords],
                   ['Last 1000 files', timingRecords.slice(-1000)],
                   ['Last 100 files', timingRecords.slice(-100)],
                   ['Last 10 files', timingRecords.slice(-10)]];
    let fmt = (us) => (us / 1000).toFixed(2) + ' ms';

    let page = '<HTML><HEAD><TITLE>CodeStream Timing Statistics</TITLE>\n';
    page += '<meta http-equiv="refresh" content="10">\n';
    page += '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>\n';
    page += '<style>body{font-family:sans-serif;margin:2em} table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:4px 10px;text-align:right} .chart{max-width:1100px;height:320px;margin-bottom:2em}</style>\n';
    page += '</HEAD><BODY><H1>CodeStream Timing Statistics</H1>\n';
    page += '<P>' + getStatistics() + ' <a href="/">Back to clones</a> (page refreshes every 10 s)</P>\n';

    page += '<table><tr><th>Window</th><th>Files</th><th>Avg total</th><th>Avg match</th><th>Avg per line</th><th>Max total</th></tr>\n';
    windows.forEach( ([label, records]) => {
        let s = summarise(records);
        if (s) {
            page += '<tr><th>' + label + '</th><td>' + s.files + '</td><td>' + fmt(s.avgTotal) + '</td><td>' + fmt(s.avgMatch)
                + '</td><td>' + s.perLine.toFixed(1) + ' µs</td><td>' + fmt(s.maxTotal) + '</td></tr>\n';
        }
    });
    page += '</table>\n';

    page += '<h2>Processing time per file</h2><div class="chart"><canvas id="total"></canvas></div>\n';
    page += '<h2>Processing time per line (normalised)</h2><div class="chart"><canvas id="perLine"></canvas></div>\n';
    page += `<script>
fetch('/timers/data').then(r => r.json()).then(records => {
    // Downsample so the charts stay responsive with many files
    const step = Math.max(1, Math.ceil(records.length / 2000));
    const pts = records.filter((r, i) => i % step == 0);
    records.forEach(r => r.perLine = r.total / r.lines);
    const rolling = (key, n) => records.map((r, i) => {
        const w = records.slice(Math.max(0, i - n + 1), i + 1);
        return w.reduce((a, x) => a + x[key], 0) / w.length;
    }).filter((r, i) => i % step == 0);
    const labels = pts.map(r => r.index);
    const opts = { animation: false, maintainAspectRatio: false, elements: { point: { radius: 0 } },
                   scales: { x: { title: { display: true, text: 'File number' } } } };
    new Chart(document.getElementById('total'), { type: 'line', data: { labels, datasets: [
        { label: 'Total time (ms)', data: pts.map(r => r.total / 1000), borderWidth: 1 },
        { label: 'Rolling avg, 100 files (ms)', data: rolling('total', 100).map(v => v / 1000), borderWidth: 2 } ] },
        options: { ...opts, scales: { ...opts.scales, y: { title: { display: true, text: 'ms' } } } } });
    new Chart(document.getElementById('perLine'), { type: 'line', data: { labels, datasets: [
        { label: 'µs per line', data: pts.map(r => r.perLine), borderWidth: 1 },
        { label: 'Rolling avg, 100 files (µs/line)', data: rolling('perLine', 100), borderWidth: 2 } ] },
        options: { ...opts, scales: { ...opts.scales, y: { title: { display: true, text: 'µs / line' } } } } });
});
</script>\n`;
    page += '</BODY></HTML>';
    res.send(page);
}

// Some helper functions
// --------------------
// PASS is used to insert functions in a Promise stream and pass on all input parameters untouched.
PASS = fn => d => {
    try {
        fn(d);
        return d;
    } catch (e) {
        throw e;
    }
};

const STATS_FREQ = 100;
const URL = process.env.URL || 'http://localhost:8080/';
var lastFile = null;

function maybePrintStatistics(file, cloneDetector, cloneStore) {
    if (0 == cloneDetector.numberOfProcessedFiles % STATS_FREQ) {
        console.log('Processed', cloneDetector.numberOfProcessedFiles, 'files and found', cloneStore.numberOfClones, 'clones.');
        let timers = Timer.getTimers(file);
        let str = 'Timers for last file processed: ';
        for (t in timers) {
            str += t + ': ' + (timers[t] / (1000n)) + ' µs '
        }
        console.log(str);
        console.log('List of found clones available at', URL);
    }

    return file;
}

// Processing of the file
// --------------------
function processFile(filename, contents) {
    let cd = new CloneDetector();
    let cloneStore = CloneStorage.getInstance();

    return Promise.resolve({name: filename, contents: contents} )
        //.then( PASS( (file) => console.log('Processing file:', file.name) ))
        .then( (file) => Timer.startTimer(file, 'total') )
        .then( (file) => cd.preprocess(file) )
        .then( (file) => cd.transform(file) )

        .then( (file) => Timer.startTimer(file, 'match') )
        .then( (file) => cd.matchDetect(file) )
        .then( (file) => cloneStore.storeClones(file) )
        .then( (file) => Timer.endTimer(file, 'match') )

        .then( (file) => cd.storeFile(file) )
        .then( (file) => Timer.endTimer(file, 'total') )
        .then( PASS( (file) => lastFile = file ))
        .then( PASS( (file) => recordTimers(file) ))   // ADDED: save the timers of this file for /timers
        .then( PASS( (file) => maybePrintStatistics(file, cd, cloneStore) ))
    // TODO Store the timers from every file (or every 10th file), create a new landing page /timers
    // and display more in depth statistics there. Examples include:
    // average times per file, average times per last 100 files, last 1000 files.
    // Perhaps throw in a graph over all files.
        .catch( console.log );
};

/*
1. Preprocessing: Remove uninteresting code, determine source and comparison units/granularities
2. Transformation: One or more extraction and/or transformation techniques are applied to the preprocessed code to obtain an intermediate representation of the code.
3. Match Detection: Transformed units (and/or metrics for those units) are compared to find similar source units.
4. Formatting: Locations of identified clones in the transformed units are mapped to the original code base by file location and line number.
5. Post-Processing and Filtering: Visualisation of clones and manual analysis to filter out false positives
6. Aggregation: Clone pairs are aggregated to form clone classes or families, in order to reduce the amount of data and facilitate analysis.
*/
