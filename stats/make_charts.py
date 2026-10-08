# Simple charts from the long run of the CodeStreamConsumer.
#
# Input (saved every minute during the run):
#   timers-data.json : one record per processed file, from http://localhost:8080/timers/data
#                      {index, name, lines, total (µs), match (µs), clones}
#   resources.csv    : time, memory, CPU and number of processed files, from `docker stats`
#
# Run:  python3 make_charts.py      (creates chart1..chart4 .png in this folder)

import json, csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

GROUP = 500   # files per bar

# ---- Read the per-file timing data -----------------------------------------
records = json.load(open('timers-data.json'))
records = [r for r in records if '/QualitasCorpus/' in r['name']]   # skip A.java and B.java

# Split the files into groups of 500, in the order they were processed
labels, avg_ms, avg_us_per_line = [], [], []
for start in range(0, len(records), GROUP):
    group = records[start:start + GROUP]
    labels.append(f'{start + 1}–{start + len(group)}')
    avg_ms.append(sum(r['total'] for r in group) / len(group) / 1000)                   # µs → ms
    avg_us_per_line.append(sum(r['total'] for r in group) / sum(r['lines'] for r in group))

# ---- Chart 1: average time per file ---------------------------------------
plt.figure(figsize=(7, 3.5), dpi=150)
plt.bar(labels, avg_ms, color='#4C78A8')
for i, v in enumerate(avg_ms):
    plt.text(i, v, f'{v:.0f}', ha='center', va='bottom')
plt.title('Average processing time per file')
plt.xlabel('Files (in the order they were processed)')
plt.ylabel('Milliseconds')
plt.tight_layout(); plt.savefig('chart1_time_per_file.png'); plt.close()

# ---- Chart 2: average time per line ----------------------------------------
plt.figure(figsize=(7, 3.5), dpi=150)
plt.bar(labels, avg_us_per_line, color='#F58518')
for i, v in enumerate(avg_us_per_line):
    plt.text(i, v, f'{v:.0f}', ha='center', va='bottom')
plt.title('Average processing time per line of code')
plt.xlabel('Files (in the order they were processed)')
plt.ylabel('Microseconds per line')
plt.tight_layout(); plt.savefig('chart2_time_per_line.png'); plt.close()

# ---- Read the per-minute data ------------------------------------------------
minutes, memory, files_done = [], [], []
for i, row in enumerate(csv.reader(open('resources.csv'))):
    minutes.append(i)
    memory.append(float(row[1].split('MiB')[0]))
    files_done.append(int(row[3]))
files_per_minute = [files_done[i] - files_done[i - 1] for i in range(1, len(files_done))]

# ---- Chart 3: files processed per minute ------------------------------------
plt.figure(figsize=(7, 3.5), dpi=150)
plt.bar(minutes[1:], files_per_minute, color='#54A24B')
plt.title('Files processed per minute')
plt.xlabel('Minute of the run')
plt.ylabel('Files')
plt.xticks(minutes[1:])
plt.tight_layout(); plt.savefig('chart3_files_per_minute.png'); plt.close()

# ---- Chart 4: memory used by the consumer -----------------------------------
plt.figure(figsize=(7, 3.5), dpi=150)
plt.plot(minutes, memory, marker='o', color='#E45756')
plt.title('Memory used by the consumer container')
plt.xlabel('Minute of the run')
plt.ylabel('MiB')
plt.xticks(minutes[::2])
plt.grid(alpha=0.3)
plt.tight_layout(); plt.savefig('chart4_memory.png'); plt.close()

print('Groups:', labels)
print('Avg ms per file:', [round(v) for v in avg_ms])
print('Avg µs per line:', [round(v) for v in avg_us_per_line])
print('Files per minute:', files_per_minute)
print('Memory MiB:', memory)
