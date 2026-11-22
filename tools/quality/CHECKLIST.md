# Translation quality checklist

Every text item on the 11 test pages, checked at full resolution in `out/<page>-items.jpg`
(original crop beside the translated one, made by `sheet.py`). Model: qwen3-vl:4b-instruct.

Columns: **Tr** translated · **Sense** the English means what the Japanese says · **Erased** no
ghost of the original left · **Bg** background kept as it was · **Fits** inside its bubble or
source area, with margin · **Outl** outline only where the original had one.

✓ ok · ✗ fails · ~ acceptable but weak · ⟳ fixed in code after this output was made, checked
offline (unit test or mask dump), needs a full run to confirm on the page.

## Which run each page's output comes from

- E01P01, E01P02: last run, code as of commit 8ffdf38.
- All other pages: the full run before that, which had the chained-bubble and edge-letter fixes
  but not the loose-SFX colour rule (art next to SFX) or the dangling-comma clean-up.
- The run after that was stopped part way to free the PC. **Every page needs a full run when the
  PC is free** (see the end of this file).

## E01P01 (5 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | …これで 出来上がり | …And that's it, done. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | translucent bubble kept |
| 2 | ぱらぱら (SFX) | FLUTTER | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | 4b reads はらはら; should be SPRINKLE. 8b reads it right |
| 3 | …うーん 足りなかった かも | …Hmm, maybe I still need more. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | どばどば (SFX) | Doh-doh | ✓ | ⟳ | ✓ | ✓ | ✓ | ✓ | 4b reads どはどは; the glossary now maps it to GLUG GLUG |
| 5 | ざぶん (SFX) | Sann | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | 4b reads さなん/きぶん, 8b きぶん; no fix without a better read |

## E01P02 (3 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | うん… カンペキ | Yeah… perfect. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | ダメ！ そんなことしちゃ だめなんだから | No way! You can't do that! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | パシャ (SFX) | SPLISH | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | the yellow splash is now kept and the colour matches. Lettered at 22 px, smaller than the kana: the English is longer and stays within the source width |

## E35P01 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ごめん もうすぐ リアが 切れそう | Sorry, the rear's about to cut out... | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | リア is Rea (magic energy in this comic): "my Rea's about to run out" |
| 2 | あれ お目覚めね! | Hey, you're awake! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | split from the bubble chained to it |
| 3 | 大丈夫？ 寒くない？ | You okay? Not too cold? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | オーラも 弱ってきて この寒さから 守れないの | My aura's weakening—can't protect you from this cold anymore. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E35P02 (13 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 私バカだった! | I was such a fool! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | もうすぐ加速もできなくなりそう | I'm about to lose the ability to accelerate too soon. | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | stiff wording |
| 3 | でもあのドラゴンと乗り手は何時間も何時間もスピードを保ってる | But that dragon and its rider have been maintaining top speed for hours and hours. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | 私たちがペースを落としたらすぐ捕まっちゃう | If we slow down, we'll be caught right away. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | すぐにあきらめてしまうと思ったのに! | I thought I'd give up right away! | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | wrong subject: "I thought they'd give up quickly!" |
| 6 | なんとかうまくまければいいのだけど | I just hope I can manage somehow. | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | まく = shake off: "I hope we can lose them somehow" |
| 7 | 捕まえられる前に! | Before they catch us! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 8 | それじゃ足りないあの二人を倒さないと! | I can't let those two escape! | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | "That's not enough, we have to take those two down!" |
| 9 | …つかれた… | I'm so tired... | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 10 | いけない! | No! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 11 | でもわたし… | But me... | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | "But I..." reads better |
| 12 | しっかりしなきゃペッパー! | I gotta stay focused, Pepper! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 13 | …すごく… | So much... | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E35P03 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | そうなったら すぐに攻撃よ | If that's the case, attack now! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | ああ この追跡劇も もうすぐ終わる | Ah, this chase scene's almost over already. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | white on a black bubble |
| 3 | 今のあれ 見えた？ | Did you see that just now? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | まもなく 魔力切れに なりそうだ | Looks like magic's about to run out soon. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | white on a black bubble |

## E36P01 (3 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 謝罪だと? | Apologize? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | 何を言っている! | What are you saying! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | この愚か者を 牢屋に放り込め! | Throw this fool in jail! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8b left this one untranslated |

## E36P02 (5 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 魔法牢獄め! ああああ! | Magic prison! Aaah! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | プシュウ… (SFX) | PSSSHH | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | the original has a dark drop shadow; ours has none |
| 3 | ガラッ! (SFX) | CLANG! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | outlined like the original, rotated to its angle |
| 4 | もう! | Ugh! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | 何もできないってことね! | So, I can't do anything, huh? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | the て against the bubble edge is now erased |

## E36P03 (9 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | しーっ ペッパー! | Shh! Pepper! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | translucent bubble |
| 2 | 私 バカだった! | I was a fool! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | おとなしく して | Be quiet, | ✓ | ⟳ | ✓ | ✓ | ✓ | ✓ | the dangling comma is now dropped |
| 4 | 一体 誰なの?! | Who are you?! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | シュウウ… (SFX) | FSSSH | ✓ | ✓ | ✓ | ⟳ | ⟳ | ~ | the crystal's glow was erased with it and the word sat too far left. The mask no longer takes the glow (offline mask dump), which also re-centres the word. The original's blue glow is not reproduced |
| 6 | しーっ! 静かにして! | Shh! Be quiet! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 7 | 来て | Come here | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | split from the bubble chained to it |
| 8 | ここから 出してあげる | I'll get you out of here | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 9 | シチミ? | Chitami? | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | name: Shichimi |

## E38P01 (7 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | やっと… | Finally... | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | この強敵を 仕留めることが できた! | I finally managed to take down this tough enemy! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 3 | ああ 厄介だった 冒険者たちが 進めなくなるのも よくわかる | Ah, I see why it was so troublesome—those adventurers can't move forward without them. | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | "What a pain. No wonder adventurers couldn't get past it." Split from the chained bubble below |
| 4 | ブラシックは どうだ? | Brushick, how's he doing? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | くっ! そんなに 深手を負って いたのか! | Huh! He was really hurt that bad? | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | くっ is a grunt, not "Huh". The prompt now gives くっ → Ngh! (not run yet). Stray "!'" from the next bubble is gone |
| 6 | ブラシック? ブラシック! | Brushick? Brushick! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | split from the side-by-side bubble |
| 7 | ヒーラー! 助けて! 今すぐ | Healer! Help me! Now! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E38P02 (8 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 道を開けて… | Clear the path... | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | ズウン (SFX) | THOOM | ✓ | ✓ | ✓ | ⟳ | ✓ | ~ | a small part of the hand below was in the mask; no longer (offline mask dump). Glow not reproduced |
| 3 | 傷が… 消えた | The wound... gone. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | さあ急ごう 宝物が 待っている! | Now, hurry! The treasure awaits! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 5 | そうだ! | Right! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 6 | いつもながら まるで奇跡だ | As always, it's like a miracle. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 7 | ヒーラーのおかげで 俺らは無敵! 次の怪物を 倒しに行こう! | Thanks to the healer, they're invincible! Let's go defeat the next monster! | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | 4b reads 俺 as 倆: "we're invincible" |
| 8 | すばらしい ヒーラーの 力だ! | Awesome healer power! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## E38P03 (4 items, 0 skipped)

| # | Original | English | Tr | Sense | Erased | Bg | Fits | Outl | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 俺のだ! | Mine! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 2 | いいえ! 私の獲物よ! | No! Mine! | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | loses "my prey" |
| 3 | 自分が何をしているのかわかっているのか? | Do you know what you're doing? | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| 4 | 我らは何ヶ月もお前を捜していたのだぞ | We've been looking for you for months! | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## Totals (65 items)

| | ✓ | ~ | ⟳ | ✗ |
|---|---|---|---|---|
| Translated | 65 | | | 0 |
| Sense | 50 | 4 | 2 | 9 |
| Erased, no ghost | 65 | | | 0 |
| Background kept | 63 | | 2 | 0 |
| Fits | 63 | 1 | 1 | 0 |
| Outline matches | 62 | 3 | | 0 |

Skipped: 0 on every page.

Every ✗ in Sense is the 4b model: a misread (ぱらぱら, ざぶん, 俺), a wrong subject or gist, or a
name transliterated (Rea, Shichimi). E35/E36/E38 are at 100% on translated, erased, background
and fits once the ⟳ items are confirmed by a full run. They are not at 100% on sense.

## Needs a full run when the PC is free

Translate with the model unloaded after each page and a pause between pages:

    node build.mjs
    node tools/quality/run.mjs --unload --pause=30          (all pages, gently)
    node tools/quality/run.mjs E36P03 --unload              (one page)
    python tools/quality/sheet.py E36P03                    (per-item sheet for checking)

Then check the ⟳ items above:
- E01P01 #4 should be GLUG GLUG.
- E36P03 #3 should be "Be quiet" with no comma.
- E36P03 #5: the crystal glow should be kept and FSSSH centred on the original.
- E38P02 #2: the hand should be untouched.
- E38P01 #5: does the prompt's くっ → Ngh! take?

Also run the extension e2e (`node tools/e2e.mjs`, with `tools/e2e-setup.mjs` first if it needs it): the lettering changes touch what the extension draws.
