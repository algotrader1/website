# Short URLs → ICP mapping

Use these for Meta/TikTok ad links. Each short URL redirects to `/quiz/v3.html?cpp=<ICP>` and preserves all query params (UTM, fbclid, etc.).

| Short URL | ICP | Headline | Notes |
|---|---|---|---|
| `dreaminsight.app/q/fsg` | F-1 | Reconnect with your body | Body disconnect |
| `dreaminsight.app/q/kmr` | F-2 | Release what talk therapy can't | Therapy ceiling |
| `dreaminsight.app/q/zbp` | F-3a | Heal your mother wound | Generational |
| `dreaminsight.app/q/vnt` | F-3b | Heal your attachment pattern | Relationship |
| `dreaminsight.app/q/dkx` | F-4 | Decode your recurring dream | **NIGHTMARE** |
| `dreaminsight.app/q/hlw` | F-5 | Feel alive in your own life | Numbness |
| `dreaminsight.app/q/jrq` | M-1 | Unlock your full potential | Wasted potential |
| `dreaminsight.app/q/gnc` | M-2 | Release what insight alone can't | Therapy ceiling |
| `dreaminsight.app/q/bwp` | M-3 | Master your own patterns | Self-sabotage |
| `dreaminsight.app/q/ztl` | M-4 | Decode the dream that keeps coming back | **NIGHTMARE** |
| `dreaminsight.app/q/fvd` | M-5 | Be fully present for your life | Numbness |
| `dreaminsight.app/q/xmk` | M-6 | Become the father you needed | Father wound |

## How it works

Each folder (`/q/xxx/`) contains an `index.html` that JS-redirects to `/quiz/v3.html?cpp=<ICP>` while preserving `?fbclid=...&utm_source=...` params for attribution. `<meta refresh>` is the fallback if JS is disabled.

## To add new ones

```bash
mkdir /q/NEWCODE && cp /q/fsg/index.html /q/NEWCODE/index.html
# then edit NEWCODE/index.html and replace F-1 with the target ICP
```
