# 🎣 FrostFish

An isometric idle "scaling" game — break drifting ice cubes with circular saws,
harvest the fish, cut them into meat, sell to the crowd, and reinvest the cash to
grow your frozen-fish empire. Built from scratch with plain **HTML + Canvas + JS**,
no dependencies.

**▶️ Play: https://henrykun55.github.io/frostfish/**

## The loop

🐟 Fish the river → 🔪 cut into meat at the table → 📦 deliver to the buyers →
💰 collect the cash they leave → ⚙️ deposit it to upgrade your saws & cutting →
repeat, faster and bigger. No caps — grow exponentially.

## Controls

- **Move:** WASD / arrow keys (desktop) or drag anywhere (mobile).
- **Sound:** 🔊 button or `M` to mute (16-bit synth, no audio files).

## Run locally

It uses ES modules, so serve it over HTTP (opening the file directly won't work):

```bash
python3 -m http.server 8123
# then open http://127.0.0.1:8123/
```

## Tech notes

- True isometric projection (`js/iso.js`) with tunable yaw/pitch.
- Pre-rendered iso diamond-tile floor; depth-sorted billboard sprites.
- WebAudio chiptune SFX + music synthesized at runtime.
