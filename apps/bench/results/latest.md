# Benchmark results

Run 2026-10-07 07:44 on commit `baa42e6`, Node v22.20.0, Apple M4, darwin 27.0.0.

Single run per case. Mean time per iteration; **vs SleekStack** is the other library's mean divided by SleekStack's (above 1× means SleekStack is faster, below 1× means it is slower). DOM suites run in jsdom: read them relative to the other libraries only. `n/a`: the library cannot run the case. `±` is the relative margin of error; above 20% treat the row as noise.

Versions: @sleekstack/core 0.0.1, @sleekstack/ui 0.0.1, jotai 3.0.1, solid-js 1.9.15, @builder.io/qwik 1.20.1, @effect-atom/atom 0.7.1, effect 3.21.2, react 19.2.6, react-dom 19.2.6, jsdom 29.1.1, vitest 4.1.9.

## Atoms (micro)

| case                    |   sleekstack |                 jotai |          effect-atom |                 solid |
| ----------------------- | -----------: | --------------------: | -------------------: | --------------------: |
| create                  | 0.128 ms ±3% |  1.111 ms ±5% (8.69×) | 0.179 ms ±1% (1.40×) |  0.041 ms ±1% (0.32×) |
| read                    |  3.97 µs ±0% | 0.142 ms ±1% (35.77×) |  7.97 µs ±0% (2.01×) |   3.25 µs ±1% (0.82×) |
| write                   |  9.83 µs ±0% | 0.525 ms ±1% (53.46×) | 0.025 ms ±0% (2.59×) |   4.64 µs ±1% (0.47×) |
| derived-read            | 0.128 ms ±0% | 1.795 ms ±2% (13.98×) | 0.172 ms ±0% (1.34×) |  0.105 ms ±1% (0.82×) |
| subscribe-notify n=1    |  0.04 µs ±0% |  0.57 µs ±1% (15.40×) |  0.05 µs ±0% (1.33×) |   0.15 µs ±1% (3.99×) |
| subscribe-notify n=100  |  0.47 µs ±0% |   2.42 µs ±1% (5.17×) |  0.68 µs ±0% (1.46×) |  5.43 µs ±1% (11.62×) |
| subscribe-notify n=1000 |  4.29 µs ±0% |  0.016 ms ±1% (3.83×) |  6.97 µs ±0% (1.63×) | 0.056 ms ±1% (13.05×) |
| batch-write             |  7.46 µs ±1% | 0.080 ms ±1% (10.69×) |  9.57 µs ±1% (1.28×) |   6.57 µs ±1% (0.88×) |
| diamond                 | 0.366 ms ±2% | 4.419 ms ±3% (12.07×) | 0.735 ms ±2% (2.01×) |  0.413 ms ±2% (1.13×) |

## Reactive graphs: js-reactivity-benchmark "kairo" and cellx shapes

| case              |   sleekstack |                jotai |           effect-atom |                solid |
| ----------------- | -----------: | -------------------: | --------------------: | -------------------: |
| kairo-deep-50     |  8.21 µs ±1% | 0.060 ms ±3% (7.29×) |  0.017 ms ±1% (2.09×) |  4.60 µs ±1% (0.56×) |
| kairo-broad-50    | 0.029 ms ±1% | 0.198 ms ±3% (6.82×) |  0.028 ms ±1% (0.98×) | 0.012 ms ±0% (0.41×) |
| kairo-diamond-5   |  1.88 µs ±2% |  9.74 µs ±3% (5.17×) |   3.62 µs ±1% (1.92×) |  0.75 µs ±1% (0.40×) |
| kairo-triangle-10 |  2.51 µs ±0% | 0.017 ms ±3% (6.60×) |   9.40 µs ±1% (3.74×) |  1.21 µs ±1% (0.48×) |
| kairo-mux-100     | 0.337 ms ±1% | 1.725 ms ±2% (5.12×) |  0.254 ms ±1% (0.75×) | 0.129 ms ±0% (0.38×) |
| kairo-repeated-30 |  1.49 µs ±0% |  8.10 µs ±2% (5.45×) |   1.10 µs ±1% (0.74×) |  0.60 µs ±0% (0.40×) |
| kairo-avoidable   |  0.54 µs ±0% |  3.43 µs ±2% (6.31×) |   0.46 µs ±1% (0.84×) |  0.38 µs ±3% (0.70×) |
| cellx-10-layers   | 0.016 ms ±1% | 0.117 ms ±4% (7.24×) | 0.290 ms ±1% (17.97×) |  7.57 µs ±0% (0.47×) |
| cellx-100-layers  | 0.116 ms ±1% | 0.584 ms ±3% (5.04×) |                   n/a | 0.058 ms ±1% (0.50×) |
| cellx-500-layers  | 0.549 ms ±1% | 2.591 ms ±2% (4.72×) |                   n/a | 0.271 ms ±1% (0.49×) |

## JSX instance wrapper

| case            |   sleekstack |               direct |
| --------------- | -----------: | -------------------: |
| non-reactive-1k | 1.348 ms ±3% | 0.694 ms ±2% (0.51×) |
| one-reactive-1k | 1.276 ms ±3% | 0.778 ms ±2% (0.61×) |

## String render

| case    |   sleekstack |                react |
| ------- | -----------: | -------------------: |
| list-1k | 1.313 ms ±3% | 2.238 ms ±6% (1.70×) |

## DOM render (jsdom)

| case                                 |    sleekstack |                  react |
| ------------------------------------ | ------------: | ---------------------: |
| mount-1k                             |  6.571 ms ±3% |   8.885 ms ±2% (1.35×) |
| update-1-of-1k                       |  0.097 ms ±3% |   0.237 ms ±2% (2.45×) |
| keyed-reorder-1k                     |  1.239 ms ±3% | 25.894 ms ±2% (20.90×) |
| keyed-update-render-callback-1-of-1k |  1.423 ms ±4% |   3.484 ms ±5% (2.45×) |
| keyed-update-data-1-of-1k            |  1.070 ms ±3% |   3.043 ms ±3% (2.85×) |
| keyed-update-handler-1-of-1k         |  1.233 ms ±3% |   3.451 ms ±5% (2.80×) |
| keyed-update-atom-1-of-1k            |  1.402 ms ±4% |   3.274 ms ±5% (2.34×) |
| atom-bound-text-1k                   |  0.455 ms ±5% | 4.562 ms ±10% (10.02×) |
| keyed-update-hook-miss-1-of-1k       |  9.768 ms ±2% |   5.540 ms ±4% (0.57×) |
| keyed-update-gen-miss-1-of-1k        | 13.288 ms ±2% |   6.679 ms ±4% (0.50×) |

## js-framework-benchmark operations (jsdom)

| case              |       sleekstack |                    react |                   solid |                     qwik |
| ----------------- | ---------------: | -----------------------: | ----------------------: | -----------------------: |
| create-1k         |   83.978 ms ±21% |   83.681 ms ±17% (1.00×) |  72.448 ms ±35% (0.86×) |    68.001 ms ±4% (0.81×) |
| replace-1k        |    80.682 ms ±3% |    73.854 ms ±5% (0.92×) |  54.835 ms ±14% (0.68×) |    92.625 ms ±1% (1.15×) |
| update-every-10th |    5.273 ms ±16% |    19.902 ms ±6% (3.77×) |    1.456 ms ±3% (0.28×) |   13.456 ms ±22% (2.55×) |
| select-row        |     3.112 ms ±3% |    21.869 ms ±6% (7.03×) |    0.847 ms ±2% (0.27×) |   12.837 ms ±12% (4.13×) |
| swap-rows         |     1.865 ms ±4% |  63.755 ms ±40% (34.18×) |    1.888 ms ±3% (1.01×) |   12.529 ms ±14% (6.72×) |
| remove-row        |     7.458 ms ±7% |    43.338 ms ±7% (5.81×) |    5.843 ms ±6% (0.78×) |   38.519 ms ±56% (5.16×) |
| create-10k        | 1231.466 ms ±31% | 1246.361 ms ±32% (1.01×) | 962.535 ms ±52% (0.78×) | 1749.379 ms ±16% (1.42×) |
| append-1k         |  204.717 ms ±70% |  324.907 ms ±79% (1.59×) | 196.986 ms ±75% (0.96×) |  204.916 ms ±61% (1.00×) |
| clear-1k          |  202.987 ms ±74% |  280.993 ms ±77% (1.38×) | 165.430 ms ±71% (0.81×) |  230.766 ms ±73% (1.14×) |

## Regression gate (`pnpm --filter bench compare`)

Ratio = SleekStack mean / reference mean in the same run, compared with `baseline.json`. Only rows that are not `OK` or `NEW` are listed.

| case                   | baseline ratio | ratio | status    |
| ---------------------- | -------------: | ----: | --------- |
| jsfb/create-1k         |          0.863 | 1.004 | NOISY     |
| jsfb/update-every-10th |          0.169 | 0.265 | REGRESSED |
| jsfb/swap-rows         |          0.028 | 0.029 | NOISY     |
| jsfb/remove-row        |          0.114 | 0.172 | REGRESSED |
| jsfb/create-10k        |          0.831 | 0.988 | NOISY     |
| jsfb/append-1k         |          0.613 | 0.630 | NOISY     |
| jsfb/clear-1k          |          1.076 | 0.722 | NOISY     |
