# Translation quality checklist

Every text item on the 11 test pages, checked at full resolution in `out/<page>-items.jpg`
(original crop beside the translated one, made by `sheet.py`). Model: qwen3-vl:4b-instruct.

Columns: **Tr** translated · **Sense** the English means what the Japanese says · **Erased** no
ghost of the original left · **Bg** background kept as it was · **Fits** see below · **Outl**
outline only where the original had one.

✓ ok · ✗ fails · ~ acceptable but weak · – not there in this run.

**Fits** is checked with `fits.py` and by eye. ✓ needs all of: inside its bubble or source area
with margin; the middle of the English within 15 % of the original lettering's middle (in a closed
bubble, at the height of the bubble's middle); at least 85 % of the size allowed (about the
original lettering's size), unless the lines already fill the original's height; lines on one
centre. ✗ for more than 25 % off-centre, or smaller than 75 % of the allowed size while filling
less than 70 % of the original's height (one long small line where wrapping would allow larger
text). Slanted sound effects are lettered along the original's axis and checked by eye.

## Which run each page's output comes from

All pages: one full run on 2026-11-22 (`run.mjs --unload --pause=30`, one page at a time, the
model loaded again for every page), translator code as of the commit that adds this line, with
the extension's helper models (`models/`, see the end). The translation call now streams: each
bubble is lettered as soon as its line is complete, and the finished page is made as before.

With the model kept loaded, 11 pages one at a time: streaming, the first bubble is ready after
3.2 s on average and the page after 4.2 s (46.7–47.0 s for all 11); without streaming
(`--no-stream`) the page appears whole after 4.3 s (47.1 s for all 11).

Reading ahead (`--concurrency=2`: the first page alone, then two at a time), measured before
streaming: 38.2–38.6 s for the 11 pages, 17.1–17.3 pages a minute against 13.9–14.4 one at a
time. Three at a time is no faster. Ollama runs one request at a time for qwen3-vl ("model
architecture does not currently support parallel requests", whatever OLLAMA_NUM_PARALLEL says),
so the gain is one page's drawing, cleaning and lettering overlapping the other's model calls.

## E01P01 (5 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | …これで 出来上がり | …And that's it. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | translucent bubble kept; two lines like the original |
| 2 | ぱらぱら (SFX) | FLUTTER | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | 4b reads はらはら; should be SPRINKLE. 8b reads it right |
| 3 | …うーん 足りなかった かも | …Hmm, maybe not enough. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | どばどば (SFX) | GLUG GLUG | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 4b reads どはどは; the glossary maps it to GLUG GLUG |
| 5 | ざぶん (SFX) | SPLASH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 4b reads さぶん |

## E01P02 (3 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | うん… カンペキ | Yeah… perfect. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | ダメ！ そんなことしちゃ だめなんだから | No way! You can't do that! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | パシャ (SFX) | SPLISH | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | the yellow splash beside it is kept |

## E35P01 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ごめん もうすぐ リアが 切れそう | Sorry, the rear's about to cut off. | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | リア is Rea (magic energy in this comic). The text block no longer takes in art under the bubble |
| 2 | あれ お目覚めね! | Hey, you're awake! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | split from the bubble chained to it |
| 3 | 大丈夫？ 寒くない？ | You okay? Not too cold? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | オーラも 弱ってきて この寒さから 守れないの | My aura's weakening, can't protect me from this cold anymore. | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | "protect you" |

## E35P02 (13 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 私 バカだった! | I was such a fool! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | was lettered low in the area, and a hair tip below was erased: a bit of art at the panel corner was taken for a line of text. Now I WAS SUCH / A FOOL! where the original was, hair kept |
| 2 | もうすぐ加速もできなくなりそう | I'm gonna lose my speed soon | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | でもあのドラゴンと乗り手は何時間も何時間もスピードを保ってる | But that dragon and its rider have been maintaining top speed for hours and hours | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | 私たちがペースを落としたらすぐ捕まっちゃう | If we slow down, we'll be caught right away | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | すぐにあきらめてしまうと思ったのに! | I thought I'd give up right away! | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | wrong subject: "I thought they'd give up quickly!" |
| 6 | なんとかうまくまければいいのだけど | I just hope I can manage to keep up | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | まく = shake off: "I hope we can lose them somehow" |
| 7 | 捕まえられる前に! | Before they catch us! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 8 | それじゃ足りないあの二人を倒さないと! | I can't let those two get away! | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | "That's not enough, we have to take those two down!" |
| 9 | …つかれた… | I'm so tired… | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 10 | いけない! | No! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 11 | でもわたし… | But me… | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | "But I…" reads better |
| 12 | しっかりしなきゃペッパー! | I gotta stay focused, Pepper! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 13 | …すごく… | So much… | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E35P03 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | そうなったら すぐに攻撃よ | If that's the case, I'll attack right away. | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | the middle line comes close to the outline on the left: the bubble's rows are measured to its light outline, not inside it |
| 2 | まもなく 魔力切れに なりそうだ | I'm about to run out of magic power soon. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | white on a black bubble |
| 3 | ああ この追跡劇も もうすぐ終わる | Ah, this chase scene's almost over. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | white on a black bubble |
| 4 | 今のあれ 見えた？ | Did you see me now? | ✓ | ✗ | ✓ | ✓ | ~ | ✓ | read as 今のおれ; the code before this run reads it the same way now. Lines stepped |

## E36P01 (3 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 謝罪だと? | Apologize? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | 何を言っている! | What are you saying! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | この愚か者を 牢屋に放り込め! | Throw this fool into jail! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E36P02 (5 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | プシュウ… (SFX) | PSSSHH | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | the cell bars behind it are repainted (MI-GAN). The original has a dark drop shadow; ours has none |
| 2 | 魔法牢獄め! ああああ! | Magic prison! Aaah! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | ガラッ! (SFX) | CLANG! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | outlined like the original, rotated to its angle |
| 4 | もう! | Ugh! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | 何もできないってことね! | So nothing can be done, huh? | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | Pepper means herself: "So I can't do anything, huh?" |

## E36P03 (9 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | しーっ ペッパー! | Shh! Pepper! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | translucent bubble |
| 2 | 私 バカだった! | I was a fool! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | was stepped and left of the middle: one row of the spiky bubble stopped at a speck of ink inside the lettering. Now I WAS / A FOOL! on one centre |
| 3 | おとなしく して | Be quiet! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | 一体 誰なの?! | Who are you? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | シュウウ… (SFX) | FSSSH | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | read as シユウウ, still FSSSH. The original's blue glow is not reproduced |
| 6 | しーっ! 静かにして! | Shh! Be quiet! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 7 | 来て | Come here! | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | two lines in the room below the line above; a little left of 来て |
| 8 | ここから 出してあげる | I'll get you out of here! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 9 | シチミ? | Chitami? | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | name: Shichimi |

## E38P01 (7 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | やっと… | Finally… | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | この強敵を 仕留めることが できた! | I finally managed to take down this tough enemy! | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | 15 of 18 px in five lines: long for the bubble |
| 3 | ああ 厄介だった 冒険者たちが 進めなくなるのも よくわかる | Ah, I can see why it was troublesome—those adventurers were really pushing themselves to the limit. | ✓ | ✗ | ✓ | ✓ | ~ | ✓ | "What a pain. No wonder adventurers couldn't get past it." Six lines, slightly stepped where the oval narrows |
| 4 | ブラシックは どうだ? | How's Brushick? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | ブラシック? ブラシック! | Brushick? Brushick! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | split from the side-by-side bubble; a sliver below no longer stretches its box |
| 6 | ヒーラー! 助けて! 今すぐ | Healer! Help me! Now! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | lines on one centre (they were stepped) |
| 7 | くっ! そんなに 深手を負って いたのか! | Huh? You were really hurt that bad? | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | くっ is a grunt, not "Huh" |

## E38P02 (8 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 道を開けて… | Clear the path… | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| – | ズウン (SFX) | – | ✗ | – | – | ✓ | – | – | the art look returned nothing in the final runs, so it is left as drawn; earlier runs of the same pipeline code found it (THOOM, THUD). 4b variance |
| 2 | 傷が… 消えた | The wound… gone. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | さあ急ごう 宝物が 待っている! | Alright, let's rush—treasure awaits! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | そうだ! | Right! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | いつもながら まるで奇跡だ | As always, it's like a miracle. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 6 | ヒーラーのおかげで 俺らは無敵! 次の怪物を 倒しに行こう! | Thanks to the healer, we're invincible! Let's take down the next monster! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 7 | すばらしい ヒーラーの 力だ! | Awesome healer power! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E38P03 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 俺のだ! | Mine! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | いいえ! 私の獲物よ! | No! Mine! | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | loses "my prey" |
| 3 | 自分が何をしているのかわかっているのか? | Do you know what you're doing? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | 我らは何ヶ月もお前を捜していたのだぞ | We've been looking for you for months! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## Totals (65 items)

| | ✓ | ~ | ✗ | – |
|---|---|---|---|---|
| Translated | 64 | | 1 | |
| Sense | 51 | 5 | 8 | 1 |
| Erased, no ghost | 64 | | | 1 |
| Background kept | 65 | | | |
| Fits | 59 | 5 | 0 | 1 |
| Outline matches | 62 | 2 | | 1 |

The previous run: 64 translated; Sense 52 ✓, 5 ~, 7 ✗; Fits 59 ✓, 5 ~. The model gave different
wording on 8 of the 11 pages this time, with the same readings except two (E35P03 #4, E36P03 #5).
That is the model, not the code: run again today, the code before streaming letters E35P02 and
E35P03 pixel for pixel as this run does, and E01P01 the same as the new code run alone. Streaming
or not gives the same answer. The one change in the totals is E35P03 #4, a misread (✗), whose
lines are also stepped (~); E35P02 #2 is shorter now and fits (✓).

Every ✗ in Sense is the 4b model: a misread (ぱらぱら, 今のあれ), a wrong subject or gist, or a name
transliterated (Rea, Shichimi; a names list in settings fixes those: `run.mjs --terms=terms.txt`).

## Found in the last runs

- Lettering made one long line, or sat away from the original's place, in a few items. fitText now
  breaks lines to about the original text's shape, as even as they go, and the lines share one
  centre, at the original's middle where the room allows. A line at the end of a block holding
  one stray mark that lines up with nothing (art at a panel corner, a sliver of outline) no longer
  joins the block; that also stopped the eraser taking a hair tip on E35P02.
- A dedicated Japanese OCR model (manga-ocr-base, ONNX, int8 and fp32) was tried in place of the
  vision model's reading of the bubble crops. On these pages it read worse: it dropped the first
  line of several crops (私, すぐに, して), added stray 「, and misread 間→問, シ→ン, て→で, 力→カ.
  In a full run it caused six new ✗ in Sense and fixed two, and was no faster (60.8 s against
  57.2 s for the vision model with `--source=Japanese`). Not used.
- E38P02 ズウン: see above.

## Running it again

    node build.mjs
    node tools/quality/run.mjs --unload --pause=30          (all pages, gently)
    node tools/quality/run.mjs E36P03 --unload              (one page)
    node tools/quality/run.mjs --no-models                  (without the helper models, the old path)
    node tools/quality/run.mjs --terms=terms.txt            (with a names list)
    node tools/quality/run.mjs --concurrency=2              (reading ahead, two pages at a time)
    python tools/quality/sheet.py E36P03                    (per-item sheet for checking)
    python tools/quality/fits.py                            (centring and size of every item)

The helper models are not in the repository. Put them in `tools/quality/models/` (the extension
downloads the same files, pinned in `extension/detector.js`):

    curl -L -o tools/quality/models/detector_int8.onnx https://huggingface.co/ogkalu/comic-text-and-bubble-detector/resolve/16e8a622f91fabc6b5b65c96d32d1183f8843546/detector_int8.onnx
    curl -L -o tools/quality/models/migan_pipeline_v2.onnx https://huggingface.co/andraniksargsyan/migan/resolve/406830d0fa60666da0071c342ad2fbc8f30c5c64/migan_pipeline_v2.onnx

The extension e2e (`node tools/e2e.mjs`) checks the same pipeline in Edge, including the helper
models (downloaded from Hugging Face on each run). It uses whatever model the extension picks: with
nothing chosen that is qwen3-vl:4b-instruct when installed. With CC Wild Words (or another lettering
font from the settings list) installed, the extension letters dialogue in it, which the harness
does not.
