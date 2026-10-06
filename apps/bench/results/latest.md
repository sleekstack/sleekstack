# Benchmark results

Run 2026-10-06 14:58 on commit `94a6ba8`, Node v22.20.0, Apple M4, darwin 27.0.0.

Single run per case. Mean time per iteration; **vs SleekStack** is the other library's mean divided by SleekStack's (above 1× means SleekStack is faster, below 1× means it is slower). DOM suites run in jsdom: read them relative to the other libraries only. `n/a`: the library cannot run the case. `±` is the relative margin of error; above 20% treat the row as noise.

Versions: @sleekstack/core 0.0.1, @sleekstack/ui 0.0.1, jotai 3.0.1, solid-js 1.9.15, @builder.io/qwik 1.20.1, @effect-atom/atom 0.7.1, effect 3.21.2, react 19.2.6, react-dom 19.2.6, jsdom 29.1.1, vitest 4.1.9.

## Atoms (micro)

| case                    |   sleekstack |                 jotai |          effect-atom |                 solid |
| ----------------------- | -----------: | --------------------: | -------------------: | --------------------: |
| create                  | 0.128 ms ±3% |  1.138 ms ±5% (8.89×) | 0.182 ms ±1% (1.42×) |  0.042 ms ±1% (0.33×) |
| read                    |  6.17 µs ±0% | 0.146 ms ±1% (23.57×) |  8.11 µs ±0% (1.31×) |   3.36 µs ±1% (0.54×) |
| write                   |  9.69 µs ±0% | 0.538 ms ±1% (55.56×) | 0.025 ms ±0% (2.60×) |   4.68 µs ±1% (0.48×) |
| derived-read            | 0.134 ms ±1% | 1.820 ms ±3% (13.55×) | 0.170 ms ±0% (1.26×) |  0.103 ms ±0% (0.76×) |
| subscribe-notify n=1    |  0.04 µs ±0% |  0.64 µs ±1% (16.86×) |  0.05 µs ±1% (1.35×) |   0.16 µs ±2% (4.21×) |
| subscribe-notify n=100  |  0.46 µs ±1% |   2.38 µs ±1% (5.23×) |  0.69 µs ±0% (1.52×) |  5.21 µs ±0% (11.44×) |
| subscribe-notify n=1000 |  4.25 µs ±0% |  0.016 ms ±0% (3.88×) |  6.95 µs ±0% (1.64×) | 0.054 ms ±0% (12.78×) |
| batch-write             |  7.34 µs ±0% | 0.078 ms ±1% (10.59×) |  9.00 µs ±1% (1.23×) |   6.67 µs ±1% (0.91×) |
| diamond                 | 0.348 ms ±1% | 4.192 ms ±3% (12.03×) | 0.721 ms ±1% (2.07×) |  0.376 ms ±1% (1.08×) |

## Reactive graphs: js-reactivity-benchmark "kairo" and cellx shapes

| case              |   sleekstack |                jotai |           effect-atom |                solid |
| ----------------- | -----------: | -------------------: | --------------------: | -------------------: |
| kairo-deep-50     |  8.46 µs ±1% | 0.061 ms ±3% (7.19×) |  0.017 ms ±1% (2.04×) |  4.59 µs ±1% (0.54×) |
| kairo-broad-50    | 0.028 ms ±1% | 0.199 ms ±3% (7.09×) |  0.029 ms ±1% (1.04×) | 0.012 ms ±0% (0.42×) |
| kairo-diamond-5   |  1.37 µs ±0% |  9.72 µs ±3% (7.08×) |   3.58 µs ±1% (2.61×) |  0.77 µs ±0% (0.56×) |
| kairo-triangle-10 |  2.53 µs ±0% | 0.017 ms ±3% (6.75×) |   9.44 µs ±0% (3.73×) |  1.21 µs ±0% (0.48×) |
| kairo-mux-100     | 0.350 ms ±1% | 1.710 ms ±2% (4.89×) |  0.256 ms ±1% (0.73×) | 0.131 ms ±1% (0.38×) |
| kairo-repeated-30 |  1.47 µs ±0% |  8.32 µs ±2% (5.66×) |   1.08 µs ±0% (0.73×) |  0.60 µs ±0% (0.41×) |
| kairo-avoidable   |  0.54 µs ±0% |  3.52 µs ±2% (6.56×) |   0.45 µs ±0% (0.84×) |  0.31 µs ±0% (0.59×) |
| cellx-10-layers   | 0.016 ms ±0% | 0.109 ms ±3% (6.97×) | 0.296 ms ±1% (18.97×) |  7.86 µs ±1% (0.50×) |
| cellx-100-layers  | 0.117 ms ±1% | 0.604 ms ±3% (5.16×) |                   n/a | 0.058 ms ±1% (0.50×) |
| cellx-500-layers  | 0.531 ms ±1% | 2.765 ms ±4% (5.21×) |                   n/a | 0.273 ms ±1% (0.51×) |

## JSX instance wrapper

| case            |   sleekstack |               direct |
| --------------- | -----------: | -------------------: |
| non-reactive-1k | 1.345 ms ±3% | 0.682 ms ±2% (0.51×) |
| one-reactive-1k | 1.264 ms ±3% | 0.762 ms ±2% (0.60×) |

## String render

| case    |   sleekstack |                react |
| ------- | -----------: | -------------------: |
| list-1k | 1.274 ms ±3% | 2.445 ms ±7% (1.92×) |

## DOM render (jsdom)

| case                                 |    sleekstack |                  react |
| ------------------------------------ | ------------: | ---------------------: |
| mount-1k                             |  6.583 ms ±6% |   8.648 ms ±2% (1.31×) |
| update-1-of-1k                       |  0.104 ms ±3% |   0.252 ms ±2% (2.43×) |
| keyed-reorder-1k                     |  1.237 ms ±3% | 25.927 ms ±1% (20.96×) |
| keyed-update-render-callback-1-of-1k |  1.425 ms ±4% |   3.055 ms ±3% (2.14×) |
| keyed-update-data-1-of-1k            |  1.331 ms ±4% |   2.992 ms ±4% (2.25×) |
| keyed-update-handler-1-of-1k         |  1.405 ms ±5% |   3.525 ms ±5% (2.51×) |
| keyed-update-atom-1-of-1k            |  1.326 ms ±4% |   3.087 ms ±2% (2.33×) |
| atom-bound-text-1k                   |  0.347 ms ±2% |  3.561 ms ±2% (10.26×) |
| keyed-update-hook-miss-1-of-1k       | 10.453 ms ±2% |   5.440 ms ±3% (0.52×) |
| keyed-update-gen-miss-1-of-1k        | 13.668 ms ±3% |   6.592 ms ±3% (0.48×) |

## js-framework-benchmark operations (jsdom)

| case              |       sleekstack |                    react |                   solid |                     qwik |
| ----------------- | ---------------: | -----------------------: | ----------------------: | -----------------------: |
| create-1k         |  112.547 ms ±40% |   96.482 ms ±29% (0.86×) |   55.923 ms ±6% (0.50×) |    71.459 ms ±5% (0.63×) |
| replace-1k        |    81.695 ms ±3% |    80.441 ms ±6% (0.98×) |  67.390 ms ±27% (0.82×) |  135.015 ms ±37% (1.65×) |
| update-every-10th |     5.121 ms ±4% |    21.810 ms ±6% (4.26×) |    1.610 ms ±4% (0.31×) |    13.770 ms ±8% (2.69×) |
| select-row        |     3.708 ms ±3% |    24.896 ms ±6% (6.71×) |    1.018 ms ±3% (0.27×) |    11.255 ms ±1% (3.04×) |
| swap-rows         |    2.308 ms ±27% |   52.616 ms ±7% (22.79×) |    1.921 ms ±3% (0.83×) |   16.277 ms ±42% (7.05×) |
| remove-row        |     8.769 ms ±6% | 125.046 ms ±32% (14.26×) |    7.615 ms ±5% (0.87×) |   39.441 ms ±63% (4.50×) |
| create-10k        | 1348.190 ms ±35% | 1366.589 ms ±38% (1.01×) | 857.366 ms ±47% (0.64×) | 1910.765 ms ±58% (1.42×) |
| append-1k         |  275.673 ms ±94% |  362.901 ms ±81% (1.32×) | 223.178 ms ±69% (0.81×) |  212.622 ms ±67% (0.77×) |
| clear-1k          |  217.896 ms ±78% |  268.875 ms ±72% (1.23×) | 154.096 ms ±77% (0.71×) |  252.691 ms ±90% (1.16×) |

## Regression gate (`pnpm --filter bench compare`)

Ratio = SleekStack mean / reference mean in the same run, compared with `baseline.json`. Only rows that are not `OK` or `NEW` are listed.

| case            | baseline ratio | ratio | status |
| --------------- | -------------: | ----: | ------ |
| jsfb/create-1k  |          0.863 | 1.167 | NOISY  |
| jsfb/swap-rows  |          0.028 | 0.044 | NOISY  |
| jsfb/remove-row |          0.114 | 0.070 | NOISY  |
| jsfb/create-10k |          0.831 | 0.987 | NOISY  |
| jsfb/append-1k  |          0.613 | 0.760 | NOISY  |
| jsfb/clear-1k   |          1.076 | 0.810 | NOISY  |
